import json
import re
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


BASE_DIR = Path(__file__).resolve().parent
SEED = 42
CSV_PATH = BASE_DIR.parent / "dataset_emociones_v2.0.csv"

# Modelo seleccionado (se mantiene el run como v2).
MODEL_NAME = "pysentimiento/robertuito-base-uncased"
OUTPUT_DIR = BASE_DIR / "runs" / "robertuito_emociones_v2"
MAX_LENGTH = 128
NUM_EPOCHS = 15

TEXT_SOURCE_COLS = ("texto_raw", "texto_modelo", "texto_limpio")
LABEL_COL = "id_emocion"
LABEL_NAME_COL = "emocion_nombre"
GROUP_COL_CANDIDATES = ("video_id", "id_tema")

TRAIN_SIZE = 0.70
VAL_SIZE = 0.15
TEST_SIZE = 0.15
GROUP_SPLIT_TRIALS = 2000

BRACKET_PATTERN = re.compile(r"\[[^\[\]]+\]")
WHITESPACE_PATTERN = re.compile(r"\s+")


def strip_bracket_annotations(text: str) -> str:
    text = BRACKET_PATTERN.sub(" ", text)
    return WHITESPACE_PATTERN.sub(" ", text).strip()


def pick_source_text(row: pd.Series) -> str:
    for col in TEXT_SOURCE_COLS:
        if col not in row.index:
            continue

        value = row[col]
        if pd.isna(value):
            continue

        cleaned = strip_bracket_annotations(str(value).strip())
        if cleaned:
            return cleaned

    return ""


def normalize_text(text: str) -> str:
    text = strip_bracket_annotations(str(text).strip())
    if not text:
        return ""

    if MODEL_NAME.startswith("pysentimiento/robertuito"):
        text = preprocess_tweet(text)

    return WHITESPACE_PATTERN.sub(" ", text).strip()


def extract_logits(predictions):
    if isinstance(predictions, tuple):
        return predictions[0]

    return predictions


def to_int_label(value: Any) -> int:
    return int(cast(Any, value))


def build_compute_metrics(num_labels: int):
    all_labels = list(range(num_labels))

    def compute_metrics(eval_pred):
        predictions, labels = eval_pred
        logits = extract_logits(predictions)
        labels = np.asarray(labels)
        preds = np.argmax(logits, axis=1)

        precision_macro, recall_macro, f1_macro, _ = precision_recall_fscore_support(
            labels,
            preds,
            labels=all_labels,
            average="macro",
            zero_division=0,
        )
        f1_weighted = f1_score(
            labels,
            preds,
            labels=all_labels,
            average="weighted",
            zero_division=0,
        )
        accuracy = accuracy_score(labels, preds)

        return {
            "accuracy": accuracy,
            "macro_f1": f1_macro,
            "weighted_f1": f1_weighted,
            "macro_precision": precision_macro,
            "macro_recall": recall_macro,
        }

    return compute_metrics


def get_group_column(df: pd.DataFrame) -> str:
    for col in GROUP_COL_CANDIDATES:
        if col in df.columns and df[col].notna().all() and df[col].nunique() >= 3:
            return col

    raise ValueError(
        "No se encontró una columna válida para split agrupado. "
        f"Se esperaba una de: {GROUP_COL_CANDIDATES}"
    )


def score_group_assignment(
    sample_counts: dict[str, int],
    label_counts: dict[str, np.ndarray],
    target_samples: dict[str, float],
    target_label_counts: dict[str, np.ndarray],
) -> float:
    score = 0.0

    for split_name in target_samples:
        observed_samples = sample_counts[split_name]
        expected_samples = target_samples[split_name]
        score += abs(observed_samples - expected_samples) / max(expected_samples, 1.0)

        observed_labels = label_counts[split_name]
        expected_labels = target_label_counts[split_name]
        score += float(
            np.mean(
                np.abs(observed_labels - expected_labels)
                / np.maximum(expected_labels, 1.0)
            )
        )

        missing_classes = ((observed_labels == 0) & (expected_labels >= 1.0)).sum()
        score += float(missing_classes) * 0.10

    return score


def grouped_train_val_test_split(
    df: pd.DataFrame,
    *,
    group_col: str,
    label_col: str,
    train_size: float,
    val_size: float,
    test_size: float,
    seed: int,
    trials: int,
):
    if not np.isclose(train_size + val_size + test_size, 1.0):
        raise ValueError("Los tamaños del split deben sumar 1.0.")

    label_ids = sorted(df[label_col].unique().tolist())
    label_to_idx = {label: idx for idx, label in enumerate(label_ids)}
    group_stats: list[dict[str, Any]] = []

    for group_value, group_df in df.groupby(group_col):
        label_vector = np.zeros(len(label_ids), dtype=np.int64)
        for label, count in group_df[label_col].value_counts().items():
            label_value = to_int_label(label)
            label_vector[label_to_idx[label_value]] = int(count)

        group_stats.append(
            {
                "group_value": group_value,
                "size": int(len(group_df)),
                "label_vector": label_vector,
            }
        )

    split_names = ("train", "validation", "test")
    split_sizes = {
        "train": train_size,
        "validation": val_size,
        "test": test_size,
    }
    total_rows = len(df)
    total_label_counts = np.zeros(len(label_ids), dtype=np.int64)
    for item in group_stats:
        total_label_counts += item["label_vector"]

    target_samples = {
        split_name: total_rows * split_sizes[split_name] for split_name in split_names
    }
    target_label_counts = {
        split_name: total_label_counts * split_sizes[split_name]
        for split_name in split_names
    }

    base_rng = np.random.default_rng(seed)
    best_score = None
    best_groups = None
    best_sample_counts = None
    best_label_counts = None

    for _ in range(trials):
        trial_rng = np.random.default_rng(base_rng.integers(0, 2**32 - 1))
        order = list(range(len(group_stats)))
        noise = trial_rng.random(len(order))
        order.sort(
            key=lambda idx: (
                int(group_stats[idx]["label_vector"].max()),
                int(group_stats[idx]["size"]),
                float(noise[idx]),
            ),
            reverse=True,
        )

        split_groups = {split_name: [] for split_name in split_names}
        sample_counts = {split_name: 0 for split_name in split_names}
        label_counts = {
            split_name: np.zeros(len(label_ids), dtype=np.int64)
            for split_name in split_names
        }

        for group_idx in order:
            group_item = group_stats[group_idx]
            candidate_scores = []

            for split_name in split_names:
                candidate_sample_counts = sample_counts.copy()
                candidate_label_counts = {
                    name: values.copy() for name, values in label_counts.items()
                }
                candidate_sample_counts[split_name] += group_item["size"]
                candidate_label_counts[split_name] += group_item["label_vector"]

                score = score_group_assignment(
                    candidate_sample_counts,
                    candidate_label_counts,
                    target_samples,
                    target_label_counts,
                )
                candidate_scores.append((score, split_name))

            _, best_split = min(candidate_scores, key=lambda item: item[0])
            split_groups[best_split].append(group_item["group_value"])
            sample_counts[best_split] += group_item["size"]
            label_counts[best_split] += group_item["label_vector"]

        final_score = score_group_assignment(
            sample_counts,
            label_counts,
            target_samples,
            target_label_counts,
        )

        for split_name in split_names:
            if not split_groups[split_name]:
                final_score += 1_000_000.0

        if best_score is None or final_score < best_score:
            best_score = final_score
            best_groups = {name: values[:] for name, values in split_groups.items()}
            best_sample_counts = sample_counts.copy()
            best_label_counts = {
                name: values.copy() for name, values in label_counts.items()
            }

    if (
        best_groups is None
        or best_sample_counts is None
        or best_label_counts is None
        or best_score is None
    ):
        raise RuntimeError("No se pudo construir un split agrupado válido.")

    train_df = df[df[group_col].isin(best_groups["train"])].copy()
    val_df = df[df[group_col].isin(best_groups["validation"])].copy()
    test_df = df[df[group_col].isin(best_groups["test"])].copy()

    metadata = {
        "group_column": group_col,
        "split_groups": {
            split_name: [str(value) for value in best_groups[split_name]]
            for split_name in split_names
        },
        "split_rows": {split_name: int(best_sample_counts[split_name]) for split_name in split_names},
        "split_label_counts": {
            split_name: {
                str(label_ids[idx]): int(best_label_counts[split_name][idx])
                for idx in range(len(label_ids))
            }
            for split_name in split_names
        },
        "score": float(best_score),
        "trials": trials,
    }

    return train_df, val_df, test_df, metadata


def compute_class_weights(labels: pd.Series, num_labels: int) -> torch.Tensor:
    class_counts = (
        labels.value_counts().sort_index().reindex(range(num_labels), fill_value=0)
    )
    missing_labels = class_counts[class_counts == 0].index.tolist()
    if missing_labels:
        raise ValueError(
            "El split de entrenamiento quedó sin ejemplos para las clases: "
            f"{missing_labels}"
        )

    weights = len(labels) / (num_labels * class_counts.to_numpy(dtype=np.float32))
    weights = weights / weights.mean()
    return torch.tensor(weights, dtype=torch.float32)


class WeightedTrainer(Trainer):
    def __init__(self, *args, class_weights: torch.Tensor | None = None, **kwargs):
        super().__init__(*args, **kwargs)
        self.class_weights = class_weights

    def compute_loss(
        self,
        model,
        inputs,
        return_outputs=False,
        num_items_in_batch=None,
    ):
        inputs = dict(inputs)
        labels = cast(torch.Tensor | None, inputs.pop("labels", None))
        outputs = model(**inputs)

        if labels is None:
            loss = outputs["loss"] if isinstance(outputs, dict) else outputs.loss
        else:
            logits = cast(
                torch.Tensor,
                outputs["logits"] if isinstance(outputs, dict) else outputs.logits,
            )
            loss = torch.nn.functional.cross_entropy(
                logits.view(-1, logits.size(-1)),
                labels.view(-1),
                weight=(
                    self.class_weights.to(logits.device)
                    if self.class_weights is not None
                    else None
                ),
            )

        return (loss, outputs) if return_outputs else loss


def main():
    set_seed(SEED)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(CSV_PATH)
    initial_rows = len(df)

    # Filtros básicos.
    df = df[df[LABEL_COL].notna()].copy()

    if "id_comment" in df.columns:
        df = df.drop_duplicates(subset=["id_comment"]).copy()
    elif "corpus_id" in df.columns:
        df = df.drop_duplicates(subset=["corpus_id"]).copy()

    df["source_text"] = df.apply(pick_source_text, axis=1)
    df = df[df["source_text"] != ""].copy()
    df["text"] = df["source_text"].apply(normalize_text)
    df = df[df["text"].str.len() > 0].copy()

    # Mapeo de labels a 0..N-1.
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

    # Remover textos ambiguos: mismos textos con más de una emoción.
    ambiguous_mask = df.groupby("text")["label"].transform("nunique") > 1
    ambiguous_rows = df.loc[ambiguous_mask].copy()
    ambiguous_text_count = int(ambiguous_rows["text"].nunique())
    if ambiguous_text_count:
        ambiguous_rows.sort_values(["text", LABEL_COL]).to_csv(
            OUTPUT_DIR / "ambiguous_texts.csv",
            index=False,
        )
        df = df.loc[~ambiguous_mask].copy()

    # Reducir fuga por comentarios exactos repetidos con la misma etiqueta.
    rows_before_text_dedup = len(df)
    df = df.drop_duplicates(subset=["text", "label"]).copy()
    duplicate_text_label_rows_removed = rows_before_text_dedup - len(df)

    group_col = get_group_column(df)
    train_df, val_df, test_df, split_metadata = grouped_train_val_test_split(
        df,
        group_col=group_col,
        label_col="label",
        train_size=TRAIN_SIZE,
        val_size=VAL_SIZE,
        test_size=TEST_SIZE,
        seed=SEED,
        trials=GROUP_SPLIT_TRIALS,
    )

    # Guardar splits para reproducibilidad.
    train_df.to_csv(OUTPUT_DIR / "train.csv", index=False)
    val_df.to_csv(OUTPUT_DIR / "val.csv", index=False)
    test_df.to_csv(OUTPUT_DIR / "test.csv", index=False)

    dataset_summary = {
        "model_name": MODEL_NAME,
        "seed": SEED,
        "csv_path": str(CSV_PATH),
        "initial_rows": int(initial_rows),
        "rows_after_basic_filters": int(len(df)),
        "ambiguous_texts_removed": ambiguous_text_count,
        "duplicate_text_label_rows_removed": int(duplicate_text_label_rows_removed),
        "group_split": split_metadata,
        "split_label_names": {
            split_name: train_or_eval_df[LABEL_NAME_COL].value_counts().sort_index().to_dict()
            for split_name, train_or_eval_df in {
                "train": train_df,
                "validation": val_df,
                "test": test_df,
            }.items()
        },
    }

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

    with open(OUTPUT_DIR / "dataset_summary.json", "w", encoding="utf-8") as f:
        json.dump(dataset_summary, f, ensure_ascii=False, indent=2)

    # Dataset HF.
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

    class_weights = compute_class_weights(train_df["label"], num_labels=len(id2label))
    with open(OUTPUT_DIR / "class_weights.json", "w", encoding="utf-8") as f:
        json.dump(
            {
                id2label[idx]: float(weight)
                for idx, weight in enumerate(class_weights.tolist())
            },
            f,
            ensure_ascii=False,
            indent=2,
        )

    use_bf16 = torch.cuda.is_available() and torch.cuda.is_bf16_supported()
    use_fp16 = torch.cuda.is_available() and not use_bf16

    training_args = TrainingArguments(
        output_dir=str(OUTPUT_DIR / "checkpoints"),
        learning_rate=2e-5,
        per_device_train_batch_size=16,
        per_device_eval_batch_size=32,
        gradient_accumulation_steps=2,
        num_train_epochs=NUM_EPOCHS,
        weight_decay=0.01,
        warmup_ratio=0.1,
        lr_scheduler_type="cosine",
        eval_strategy="epoch",
        save_strategy="epoch",
        logging_strategy="steps",
        logging_steps=25,
        load_best_model_at_end=True,
        metric_for_best_model="macro_f1",
        greater_is_better=True,
        save_total_limit=2,
        report_to="none",
        seed=SEED,
        bf16=use_bf16,
        fp16=use_fp16,
    )

    compute_metrics = build_compute_metrics(num_labels=len(id2label))

    trainer = WeightedTrainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_datasets["train"],
        eval_dataset=tokenized_datasets["validation"],
        processing_class=tokenizer,
        data_collator=data_collator,
        compute_metrics=compute_metrics,
        callbacks=[EarlyStoppingCallback(early_stopping_patience=3)],
        class_weights=class_weights,
    )

    trainer.train()

    # Evaluación final en test.
    test_dataset = cast(TorchDataset[Any], tokenized_datasets["test"])
    test_output = trainer.predict(test_dataset)
    test_logits = extract_logits(test_output.predictions)
    if test_output.label_ids is None:
        raise ValueError("La evaluación en test no devolvió etiquetas.")
    test_labels = np.asarray(test_output.label_ids)
    test_preds = np.argmax(test_logits, axis=1)
    all_labels = list(range(len(id2label)))

    metrics = compute_metrics((test_logits, test_labels))
    report = classification_report(
        test_labels,
        test_preds,
        labels=all_labels,
        target_names=[id2label[i] for i in all_labels],
        digits=4,
        zero_division=0,
        output_dict=True,
    )
    cm = confusion_matrix(test_labels, test_preds, labels=all_labels).tolist()

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
            labels=all_labels,
            target_names=[id2label[i] for i in all_labels],
            digits=4,
            zero_division=0,
        )
    )

    print("\nEntrenamiento finalizado.")
    print(f"Modelo guardado en: {OUTPUT_DIR / 'best_model'}")


if __name__ == "__main__":
    main()
