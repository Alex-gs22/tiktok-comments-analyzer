"""
Entrenamiento v3.2: 6 emociones fusionadas + datos revisados por humano.

Basado en train_v3.py, incorpora los datos exportados del reviewer:
  - Confirmados → se agregan con la emoción predicha (validada)
  - Corregidos → se agregan con la emoción corregida por el humano
  - Descartados/omitidos → se excluyen

Uso:
    python train_v3_reviewed.py --reviewed-csv data/revisados_v32.csv [--no-pseudo] [--lr 2e-5] [--epochs 15]
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any, cast

import numpy as np
import pandas as pd
import torch
import torch.nn.functional as F
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

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

MODEL_NAME = "pysentimiento/robertuito-base-uncased"
SEED = 42
MAX_LENGTH = 128

EMOCIONES_FUSIONADAS = {
    1: "Alegría",
    2: "Confianza",
    3: "Miedo",
    4: "Expectación",
    5: "Tristeza",
    6: "Rechazo",
}

BRACKET_PATTERN = re.compile(r"\[[^\[\]]+\]")
WHITESPACE_PATTERN = re.compile(r"\s+")

TRAIN_SIZE = 0.70
VAL_SIZE = 0.15
TEST_SIZE = 0.15


def strip_brackets(text: str) -> str:
    return WHITESPACE_PATTERN.sub(" ", BRACKET_PATTERN.sub(" ", text)).strip()


def normalize_text(text: str) -> str:
    text = strip_brackets(str(text).strip())
    if not text:
        return ""
    try:
        from pysentimiento.preprocessing import preprocess_tweet
        text = preprocess_tweet(text)
    except ImportError:
        pass
    return WHITESPACE_PATTERN.sub(" ", text).strip()


def pick_text(row: pd.Series) -> str:
    for col in ("texto_para_modelo_limpio", "texto_para_modelo", "texto_modelo", "texto_limpio", "texto_raw"):
        if col in row.index and pd.notna(row[col]):
            val = str(row[col]).strip()
            if val:
                return val
    return ""


def pick_text_reviewed(row: pd.Series) -> str:
    """Selecciona texto para un registro del reviewer export."""
    for col in ("texto_limpio", "texto_raw"):
        if col in row.index and pd.notna(row[col]):
            val = str(row[col]).strip()
            if val:
                return val
    return ""


# ─── Focal Loss Trainer ──────────────────────────────────────────────────────

class FocalLossTrainer(Trainer):
    def __init__(self, *args, class_weights: torch.Tensor | None = None,
                 focal_gamma: float = 2.0, label_smoothing: float = 0.0, **kwargs):
        super().__init__(*args, **kwargs)
        self.class_weights = class_weights
        self.focal_gamma = focal_gamma
        self.label_smoothing = label_smoothing

    def compute_loss(self, model, inputs, return_outputs=False, num_items_in_batch=None):
        inputs = dict(inputs)
        labels = cast(torch.Tensor | None, inputs.pop("labels", None))
        outputs = model(**inputs)

        if labels is None:
            loss = outputs.loss if hasattr(outputs, "loss") else outputs["loss"]
            return (loss, outputs) if return_outputs else loss

        logits = outputs.logits if hasattr(outputs, "logits") else outputs["logits"]
        n_classes = logits.size(-1)

        # Label smoothing
        if self.label_smoothing > 0:
            smooth = self.label_smoothing / n_classes
            targets = torch.full_like(logits, smooth)
            targets.scatter_(1, labels.unsqueeze(1), 1.0 - self.label_smoothing + smooth)
        else:
            targets = F.one_hot(labels, n_classes).float()

        log_probs = F.log_softmax(logits, dim=-1)
        probs = torch.exp(log_probs)

        # Focal modulation: (1 - p_t)^gamma
        focal_weight = (1.0 - (probs * targets).sum(dim=-1)) ** self.focal_gamma

        # Cross-entropy per sample
        ce = -(targets * log_probs).sum(dim=-1)

        # Class weights
        if self.class_weights is not None:
            w = self.class_weights.to(logits.device)
            sample_weights = w[labels]
            ce = ce * sample_weights

        loss = (focal_weight * ce).mean()
        return (loss, outputs) if return_outputs else loss


def compute_class_weights(labels: pd.Series, num_labels: int) -> torch.Tensor:
    counts = labels.value_counts().sort_index().reindex(range(num_labels), fill_value=0)
    weights = len(labels) / (num_labels * counts.to_numpy(dtype=np.float32).clip(min=1))
    weights = weights / weights.mean()
    return torch.tensor(weights, dtype=torch.float32)


def build_compute_metrics(num_labels: int):
    all_labels = list(range(num_labels))

    def compute_metrics(eval_pred):
        predictions, labels = eval_pred
        logits = predictions[0] if isinstance(predictions, tuple) else predictions
        preds = np.argmax(logits, axis=1)
        labels = np.asarray(labels)

        p, r, f1, _ = precision_recall_fscore_support(labels, preds, labels=all_labels, average="macro", zero_division=0)
        return {
            "accuracy": accuracy_score(labels, preds),
            "macro_f1": f1,
            "weighted_f1": f1_score(labels, preds, labels=all_labels, average="weighted", zero_division=0),
            "macro_precision": p,
            "macro_recall": r,
        }
    return compute_metrics


def load_reviewed_data(csv_path: Path, emociones: dict[int, str]) -> pd.DataFrame:
    """Carga datos revisados del CSV exportado de Supabase."""
    print(f"\n   Cargando datos revisados de: {csv_path}")
    rev = pd.read_csv(csv_path)

    # Filtrar solo confirmados y corregidos
    rev = rev[rev["revision_estado"].isin(["confirmado", "corregido"])].copy()
    print(f"   {len(rev)} registros (confirmados + corregidos)")

    # Texto
    rev["source_text"] = rev.apply(pick_text_reviewed, axis=1)
    rev = rev[rev["source_text"] != ""].copy()
    rev["text"] = rev["source_text"].apply(normalize_text)
    rev = rev[rev["text"].str.len() > 0].copy()

    # Emoción revisada (ya es 1-indexed, coincide con EMOCIONES_FUSIONADAS)
    rev["id_emocion_f"] = rev["revision_emocion_id"].astype(int)
    rev["emocion_f"] = rev["id_emocion_f"].map(emociones)
    rev["data_source"] = rev["revision_estado"].apply(
        lambda x: "reviewed_confirmed" if x == "confirmado" else "reviewed_corrected"
    )

    # Validar que todas las emociones son válidas
    valid = rev["id_emocion_f"].isin(emociones.keys())
    if not valid.all():
        invalid = rev[~valid]
        print(f"   ⚠ {len(invalid)} registros con emoción inválida, excluidos")
        rev = rev[valid].copy()

    confirmed = len(rev[rev["data_source"] == "reviewed_confirmed"])
    corrected = len(rev[rev["data_source"] == "reviewed_corrected"])
    print(f"   → {confirmed} confirmados, {corrected} corregidos")
    print(f"   Distribución:")
    for emo_name, count in rev["emocion_f"].value_counts().sort_index().items():
        print(f"     {emo_name}: {count}")

    return rev[["text", "id_emocion_f", "emocion_f", "data_source"]].copy()


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Entrenamiento v3.2 con datos revisados por humano")
    p.add_argument("--reviewed-csv", type=str, required=True, help="Ruta al CSV de datos revisados (de Supabase)")
    p.add_argument("--no-pseudo", action="store_true", help="Entrenar solo con datos etiquetados (sin pseudo-labels)")
    p.add_argument("--lr", type=float, default=2e-5)
    p.add_argument("--epochs", type=int, default=15)
    p.add_argument("--batch-size", type=int, default=16)
    p.add_argument("--grad-accum", type=int, default=2)
    p.add_argument("--label-smoothing", type=float, default=0.1)
    p.add_argument("--focal-gamma", type=float, default=2.0)
    p.add_argument("--dropout", type=float, default=None, help="Override classifier dropout")
    p.add_argument("--warmup-ratio", type=float, default=0.1)
    p.add_argument("--weight-decay", type=float, default=0.01)
    p.add_argument("--patience", type=int, default=4)
    p.add_argument("--run-name", type=str, default="v3.2")
    return p


def main():
    args = build_parser().parse_args()
    set_seed(SEED)

    OUTPUT_DIR = BASE_DIR / "runs" / f"robertuito_emociones_{args.run_name}"
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print(f"ENTRENAMIENTO v3.2: 6 Emociones + Datos Revisados ({args.run_name})")
    print("=" * 60)

    # ─── Cargar datos etiquetados manualmente ─────────────────────────────
    print("\n1. Cargando datos etiquetados fusionados...")
    labeled_path = DATA_DIR / "corpus_etiquetado_fusionado.csv"
    if not labeled_path.exists():
        raise FileNotFoundError(f"No existe: {labeled_path}\nEjecuta primero prepare_corpus.py")

    labeled = pd.read_csv(labeled_path)
    labeled["source_text"] = labeled.apply(pick_text, axis=1)
    labeled = labeled[labeled["source_text"] != ""].copy()
    labeled["text"] = labeled["source_text"].apply(normalize_text)
    labeled = labeled[labeled["text"].str.len() > 0].copy()
    labeled["id_emocion_f"] = labeled["id_emocion_fusionado"].astype(int)
    labeled["emocion_f"] = labeled["emocion_nombre_fusionado"]
    labeled["data_source"] = "manual"
    print(f"   {len(labeled)} etiquetados manualmente")

    all_dfs = [labeled[["text", "id_emocion_f", "emocion_f", "data_source"]]]

    # ─── Cargar pseudo-labels ─────────────────────────────────────────────
    pseudo_count = 0
    if not args.no_pseudo:
        pseudo_path = DATA_DIR / "pseudo_labels_alta_confianza.csv"
        if pseudo_path.exists():
            print("\n2. Cargando pseudo-labels de alta confianza...")
            pseudo = pd.read_csv(pseudo_path)
            pseudo["source_text"] = pseudo.apply(pick_text, axis=1)
            pseudo = pseudo[pseudo["source_text"] != ""].copy()
            pseudo["text"] = pseudo["source_text"].apply(normalize_text)
            pseudo = pseudo[pseudo["text"].str.len() > 0].copy()
            pseudo["id_emocion_f"] = pseudo["pred_fusionado_id"].astype(int)
            pseudo["emocion_f"] = pseudo["pred_fusionado_nombre"]
            pseudo["data_source"] = "pseudo"
            pseudo_count = len(pseudo)
            print(f"   {pseudo_count} pseudo-labels cargados")
            all_dfs.append(pseudo[["text", "id_emocion_f", "emocion_f", "data_source"]])
        else:
            print(f"\n2. No se encontraron pseudo-labels en {pseudo_path}")
    else:
        print("\n2. Pseudo-labels desactivados (--no-pseudo)")

    # ─── Cargar datos revisados por humano ────────────────────────────────
    print("\n3. Cargando datos revisados por humano...")
    reviewed_path = Path(args.reviewed_csv)
    if not reviewed_path.is_absolute():
        reviewed_path = BASE_DIR / reviewed_path
    if not reviewed_path.exists():
        raise FileNotFoundError(f"No existe el CSV de revisados: {reviewed_path}")

    reviewed = load_reviewed_data(reviewed_path, EMOCIONES_FUSIONADAS)
    reviewed_count = len(reviewed)
    all_dfs.append(reviewed)

    # ─── Combinar todos los datos ─────────────────────────────────────────
    df = pd.concat(all_dfs, ignore_index=True)

    # Remapear ids fusionados a 0..N-1
    fused_ids_sorted = sorted(df["id_emocion_f"].unique())
    old_to_new = {old: idx for idx, old in enumerate(fused_ids_sorted)}
    id2label = {idx: EMOCIONES_FUSIONADAS[old] for old, idx in old_to_new.items()}
    label2id = {v: k for k, v in id2label.items()}
    df["label"] = df["id_emocion_f"].map(old_to_new)
    num_labels = len(id2label)

    # Dedup por texto+label
    before = len(df)
    df = df.drop_duplicates(subset=["text", "label"]).copy()
    print(f"\n   Textos duplicados eliminados: {before - len(df)}")

    # Resumen de fuentes
    source_counts = df["data_source"].value_counts()
    print(f"\n   === Composición del dataset ===")
    for src, cnt in source_counts.items():
        print(f"     {src}: {cnt}")
    print(f"     TOTAL: {len(df)}")

    # ─── Split ────────────────────────────────────────────────────────────
    print("\n4. Dividiendo datos (stratified)...")
    from sklearn.model_selection import train_test_split

    train_df, temp_df = train_test_split(df, test_size=0.30, random_state=SEED, stratify=df["label"])
    val_df, test_df = train_test_split(temp_df, test_size=0.50, random_state=SEED, stratify=temp_df["label"])

    for name, split_df in [("Train", train_df), ("Val", val_df), ("Test", test_df)]:
        print(f"   {name}: {len(split_df)}")

    # Guardar splits
    train_df.to_csv(OUTPUT_DIR / "train.csv", index=False)
    val_df.to_csv(OUTPUT_DIR / "val.csv", index=False)
    test_df.to_csv(OUTPUT_DIR / "test.csv", index=False)

    # ─── Label mapping ────────────────────────────────────────────────────
    with open(OUTPUT_DIR / "label_mapping.json", "w", encoding="utf-8") as f:
        json.dump({
            "model_name": MODEL_NAME,
            "seed": SEED,
            "num_labels": num_labels,
            "id2label": {str(k): v for k, v in id2label.items()},
            "label2id": label2id,
            "fusion": {"Sorpresa+Anticipación": "Expectación", "Disgusto+Ira": "Rechazo"},
            "pseudo_labels_used": pseudo_count,
            "reviewed_data_used": reviewed_count,
        }, f, ensure_ascii=False, indent=2)

    # ─── Tokenize ─────────────────────────────────────────────────────────
    print("\n5. Tokenizando...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, use_fast=True)

    def make_dataset(split_df):
        ds = Dataset.from_pandas(split_df[["text", "label"]].reset_index(drop=True))
        return ds.map(lambda b: tokenizer(b["text"], truncation=True, max_length=MAX_LENGTH), batched=True, remove_columns=["text"])

    tok_train = make_dataset(train_df)
    tok_val = make_dataset(val_df)
    tok_test = make_dataset(test_df)

    # ─── Model ────────────────────────────────────────────────────────────
    print("\n6. Cargando modelo base...")
    model = AutoModelForSequenceClassification.from_pretrained(
        MODEL_NAME, num_labels=num_labels, id2label=id2label, label2id=label2id,
    )

    if args.dropout is not None:
        if hasattr(model.config, "classifier_dropout"):
            model.config.classifier_dropout = args.dropout
        if hasattr(model, "classifier") and hasattr(model.classifier, "dropout"):
            model.classifier.dropout = torch.nn.Dropout(args.dropout)
        print(f"   Dropout ajustado a {args.dropout}")

    # ─── Class weights ────────────────────────────────────────────────────
    class_weights = compute_class_weights(train_df["label"], num_labels)
    print(f"\n   Class weights: {dict(zip([id2label[i] for i in range(num_labels)], class_weights.tolist()))}")

    with open(OUTPUT_DIR / "class_weights.json", "w", encoding="utf-8") as f:
        json.dump({id2label[i]: float(w) for i, w in enumerate(class_weights.tolist())}, f, indent=2)

    # ─── Training ─────────────────────────────────────────────────────────
    use_bf16 = torch.cuda.is_available() and torch.cuda.is_bf16_supported()
    use_fp16 = torch.cuda.is_available() and not use_bf16

    training_args = TrainingArguments(
        output_dir=str(OUTPUT_DIR / "checkpoints"),
        learning_rate=args.lr,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=32,
        gradient_accumulation_steps=args.grad_accum,
        num_train_epochs=args.epochs,
        weight_decay=args.weight_decay,
        warmup_ratio=args.warmup_ratio,
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
        max_grad_norm=1.0,
    )

    compute_metrics = build_compute_metrics(num_labels)

    print(f"\n7. Entrenando (lr={args.lr}, epochs={args.epochs}, focal_gamma={args.focal_gamma}, "
          f"label_smoothing={args.label_smoothing}, patience={args.patience})...\n")

    trainer = FocalLossTrainer(
        model=model,
        args=training_args,
        train_dataset=tok_train,
        eval_dataset=tok_val,
        processing_class=tokenizer,
        data_collator=DataCollatorWithPadding(tokenizer=tokenizer),
        compute_metrics=compute_metrics,
        callbacks=[EarlyStoppingCallback(early_stopping_patience=args.patience)],
        class_weights=class_weights,
        focal_gamma=args.focal_gamma,
        label_smoothing=args.label_smoothing,
    )

    trainer.train()

    # ─── Evaluación en test ───────────────────────────────────────────────
    print("\n8. Evaluando en test...")
    test_output = trainer.predict(cast(TorchDataset[Any], tok_test))
    test_logits = test_output.predictions[0] if isinstance(test_output.predictions, tuple) else test_output.predictions
    test_labels = np.asarray(test_output.label_ids)
    test_preds = np.argmax(test_logits, axis=1)
    all_labels = list(range(num_labels))

    metrics = compute_metrics((test_logits, test_labels))
    target_names = [id2label[i] for i in all_labels]
    report = classification_report(test_labels, test_preds, labels=all_labels,
                                   target_names=target_names, digits=4, zero_division=0, output_dict=True)
    cm = confusion_matrix(test_labels, test_preds, labels=all_labels).tolist()

    with open(OUTPUT_DIR / "test_metrics.json", "w", encoding="utf-8") as f:
        json.dump(metrics, f, ensure_ascii=False, indent=2)
    with open(OUTPUT_DIR / "classification_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    with open(OUTPUT_DIR / "confusion_matrix.json", "w", encoding="utf-8") as f:
        json.dump(cm, f, ensure_ascii=False, indent=2)

    trainer.save_model(str(OUTPUT_DIR / "best_model"))
    tokenizer.save_pretrained(str(OUTPUT_DIR / "best_model"))

    print("\n" + "=" * 60)
    print("=== TEST METRICS ===")
    for k, v in metrics.items():
        print(f"  {k}: {v:.4f}")
    print("\n=== CLASSIFICATION REPORT ===")
    print(classification_report(test_labels, test_preds, labels=all_labels,
                                target_names=target_names, digits=4, zero_division=0))
    print(f"Modelo guardado en: {OUTPUT_DIR / 'best_model'}")
    print("=" * 60)


if __name__ == "__main__":
    main()
