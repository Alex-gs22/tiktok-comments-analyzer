import json
from pathlib import Path
from typing import Any, cast

import numpy as np
import pandas as pd
import torch
from datasets import Dataset, DatasetDict
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_recall_fscore_support,
)
from sklearn.model_selection import train_test_split
from torch.utils.data import Dataset as TorchDataset
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    DataCollatorWithPadding,
    EarlyStoppingCallback,
    Trainer,
    TrainingArguments,
    set_seed,
)

from pysentimiento.preprocessing import preprocess_tweet


SEED = 42
CSV_PATH = "../dataset_emociones_v2.0.csv"

# Modelo seleccionado (puede ser otro compatible con Hugging Face)
MODEL_NAME = "pysentimiento/robertuito-base-uncased"

OUTPUT_DIR = Path("runs/robertuito_emociones_v2.1")
MAX_LENGTH = 128

TEXT_COL = "texto_modelo"
LABEL_COL = "id_emocion"
LABEL_NAME_COL = "emocion_nombre"
    

def normalize_text(text: str) -> str:
    text = str(text).strip()
    if not text:
        return ""

    if MODEL_NAME.startswith("pysentimiento/robertuito"):
        return preprocess_tweet(text)

    return text


def compute_metrics(eval_pred):
    predictions, labels = eval_pred
    logits = extract_logits(predictions)
    labels = np.asarray(labels)
    preds = np.argmax(logits, axis=1)

    precision_macro, recall_macro, f1_macro, _ = precision_recall_fscore_support(
        labels, preds, average="macro", zero_division=0
    )
    f1_weighted = f1_score(labels, preds, average="weighted", zero_division=0)
    accuracy = accuracy_score(labels, preds)

    return {
        "accuracy": accuracy,
        "macro_f1": f1_macro,
        "weighted_f1": f1_weighted,
        "macro_precision": precision_macro,
        "macro_recall": recall_macro,
    }


def extract_logits(predictions):
    if isinstance(predictions, tuple):
        return predictions[0]

    return predictions


def main():
    set_seed(SEED)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(CSV_PATH)

    # Filtros básicos
    df = df[df[LABEL_COL].notna()].copy()
    df[TEXT_COL] = df[TEXT_COL].fillna("").astype(str).str.strip()
    df = df[df[TEXT_COL] != ""].copy()

    # Evitar duplicados exactos por comentario si existen
    if "id_comment" in df.columns:
        df = df.drop_duplicates(subset=["id_comment"]).copy()
    elif "corpus_id" in df.columns:
        df = df.drop_duplicates(subset=["corpus_id"]).copy()

    # Normalización para el modelo
    df["text"] = df[TEXT_COL].apply(normalize_text)
    df = df[df["text"].str.len() > 0].copy()

    # Mapeo de labels a 0..N-1
    label_df = (
        df[[LABEL_COL, LABEL_NAME_COL]]
        .drop_duplicates()
        .sort_values(LABEL_COL)
        .reset_index(drop=True)
    )

    old_to_new = {int(old): idx for idx, old in enumerate(label_df[LABEL_COL].tolist())}
    new_to_old = {idx: int(old) for old, idx in old_to_new.items()}
    id2label = {
        idx: str(name)
        for idx, name in enumerate(label_df[LABEL_NAME_COL].tolist())
    }
    label2id = {name: idx for idx, name in id2label.items()}

    df["label"] = df[LABEL_COL].astype(int).map(old_to_new)

    # Split estratificado 70 / 15 / 15
    train_df, temp_df = train_test_split(
        df,
        test_size=0.30,
        random_state=SEED,
        stratify=df["label"],
    )

    val_df, test_df = train_test_split(
        temp_df,
        test_size=0.50,
        random_state=SEED,
        stratify=temp_df["label"],
    )

    # Guardar splits para reproducibilidad
    train_df.to_csv(OUTPUT_DIR / "train.csv", index=False)
    val_df.to_csv(OUTPUT_DIR / "val.csv", index=False)
    test_df.to_csv(OUTPUT_DIR / "test.csv", index=False)

    with open(OUTPUT_DIR / "label_mapping.json", "w", encoding="utf-8") as f:
        json.dump(
            {
                "model_name": MODEL_NAME,
                "seed": SEED,
                "old_to_new": old_to_new,
                "new_to_old": new_to_old,
                "id2label": {str(k): v for k, v in id2label.items()},
                "label2id": label2id,
            },
            f,
            ensure_ascii=False,
            indent=2,
        )

    # Dataset HF
    dataset = DatasetDict(
        {
            "train": Dataset.from_pandas(
                train_df[["text", "label"]].reset_index(drop=True)
            ),
            "validation": Dataset.from_pandas(
                val_df[["text", "label"]].reset_index(drop=True)
            ),
            "test": Dataset.from_pandas(
                test_df[["text", "label"]].reset_index(drop=True)
            ),
        }
    )

    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, use_fast=True)

    def tokenize_function(batch):
        return tokenizer(
            batch["text"],
            truncation=True,
            max_length=MAX_LENGTH,
        )

    tokenized_datasets = cast(
        DatasetDict,
        dataset.map(
            tokenize_function,
            batched=True,
            remove_columns=["text"],
        ),
    )
    data_collator = DataCollatorWithPadding(tokenizer=tokenizer)

    model = AutoModelForSequenceClassification.from_pretrained(
        MODEL_NAME,
        num_labels=len(id2label),
        id2label=id2label,
        label2id=label2id,
    )

    use_bf16 = torch.cuda.is_available() and torch.cuda.is_bf16_supported()
    use_fp16 = torch.cuda.is_available() and not use_bf16

    training_args = TrainingArguments(
        output_dir=str(OUTPUT_DIR / "checkpoints"),
        learning_rate=2e-5,
        per_device_train_batch_size=16,
        per_device_eval_batch_size=32,
        num_train_epochs=15,
        weight_decay=0.01,
        eval_strategy="epoch",
        save_strategy="epoch",
        logging_strategy="steps",
        logging_steps=50,
        load_best_model_at_end=True,
        metric_for_best_model="macro_f1",
        greater_is_better=True,
        save_total_limit=2,
        report_to="none",
        seed=SEED,
        bf16=use_bf16,
        fp16=use_fp16,
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_datasets["train"],
        eval_dataset=tokenized_datasets["validation"],
        processing_class=tokenizer,
        data_collator=data_collator,
        compute_metrics=compute_metrics,
        callbacks=[EarlyStoppingCallback(early_stopping_patience=3)],
    )

    trainer.train()

    # Evaluación final en test
    test_dataset = cast(TorchDataset[Any], tokenized_datasets["test"])
    test_output = trainer.predict(test_dataset)
    test_logits = extract_logits(test_output.predictions)
    if test_output.label_ids is None:
        raise ValueError("La evaluación en test no devolvió etiquetas.")
    test_labels = np.asarray(test_output.label_ids)
    test_preds = np.argmax(test_logits, axis=1)

    metrics = compute_metrics((test_logits, test_labels))
    report = classification_report(
        test_labels,
        test_preds,
        target_names=[id2label[i] for i in range(len(id2label))],
        digits=4,
        zero_division=0,
        output_dict=True,
    )
    cm = confusion_matrix(test_labels, test_preds).tolist()

    with open(OUTPUT_DIR / "test_metrics.json", "w", encoding="utf-8") as f:
        json.dump(metrics, f, ensure_ascii=False, indent=2)

    with open(OUTPUT_DIR / "classification_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    with open(OUTPUT_DIR / "confusion_matrix.json", "w", encoding="utf-8") as f:
        json.dump(cm, f, ensure_ascii=False, indent=2)

    trainer.save_model(str(OUTPUT_DIR / "best_model"))
    tokenizer.save_pretrained(str(OUTPUT_DIR / "best_model"))

    print("\n=== TEST METRICS ===")
    for k, v in metrics.items():
        print(f"{k}: {v:.4f}")

    print("\n=== CLASSIFICATION REPORT ===")
    print(
        classification_report(
            test_labels,
            test_preds,
            target_names=[id2label[i] for i in range(len(id2label))],
            digits=4,
            zero_division=0,
        )
    )

    print("\nEntrenamiento finalizado.")
    print(f"Modelo guardado en: {OUTPUT_DIR / 'best_model'}")


if __name__ == "__main__":
    main()
