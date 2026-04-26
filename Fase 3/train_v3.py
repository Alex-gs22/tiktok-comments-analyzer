"""
Paso 4: Entrenamiento optimizado con emociones fusionadas + pseudo-labels.

Mejoras vs Fase 2:
  - 6 emociones fusionadas (vs 8 originales)
  - Datos etiquetados + pseudo-labels de alta confianza
  - Focal Loss (enfoca aprendizaje en ejemplos difíciles)
  - Class weights normalizados
  - Label smoothing
  - Hyperparámetros optimizados
  - Grouped split por tema (evita data leakage)

Uso:
    python train_v3.py [--no-pseudo] [--lr 2e-5] [--epochs 15]
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
GROUP_COL_CANDIDATES = ("id_tema", "tema_nombre")


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


# ─── Grouped Split ───────────────────────────────────────────────────────────

def get_group_col(df: pd.DataFrame) -> str:
    for col in GROUP_COL_CANDIDATES:
        if col in df.columns and df[col].notna().all() and df[col].nunique() >= 3:
            return col
    raise ValueError(f"No group column found from {GROUP_COL_CANDIDATES}")


def grouped_split(df: pd.DataFrame, group_col: str, label_col: str, seed: int, trials: int = 2000):
    rng = np.random.default_rng(seed)
    label_ids = sorted(df[label_col].unique())
    label_to_idx = {l: i for i, l in enumerate(label_ids)}
    n_labels = len(label_ids)

    groups = []
    for gv, gdf in df.groupby(group_col):
        vec = np.zeros(n_labels, dtype=np.int64)
        for lbl, cnt in gdf[label_col].value_counts().items():
            vec[label_to_idx[int(lbl)]] = int(cnt)
        groups.append({"value": gv, "size": len(gdf), "vec": vec})

    total = len(df)
    total_vec = sum(g["vec"] for g in groups)
    targets = {"train": TRAIN_SIZE, "validation": VAL_SIZE, "test": TEST_SIZE}

    best_score, best_assign = float("inf"), None
    for _ in range(trials):
        order = list(range(len(groups)))
        rng.shuffle(order)
        assign = {s: [] for s in targets}
        counts = {s: 0 for s in targets}
        vecs = {s: np.zeros(n_labels, dtype=np.int64) for s in targets}

        for gi in order:
            g = groups[gi]
            scores = []
            for s in targets:
                tc, tv = counts.copy(), {k: v.copy() for k, v in vecs.items()}
                tc[s] += g["size"]
                tv[s] += g["vec"]
                err = sum(abs(tc[x] - total * targets[x]) / max(total * targets[x], 1) for x in targets)
                scores.append((err, s))
            _, best_s = min(scores)
            assign[best_s].append(g["value"])
            counts[best_s] += g["size"]
            vecs[best_s] += g["vec"]

        score = sum(abs(counts[s] - total * targets[s]) / max(total * targets[s], 1) for s in targets)
        for s in targets:
            if not assign[s]:
                score += 1e6
        if score < best_score:
            best_score, best_assign = score, {k: v[:] for k, v in assign.items()}

    return (
        df[df[group_col].isin(best_assign["train"])].copy(),
        df[df[group_col].isin(best_assign["validation"])].copy(),
        df[df[group_col].isin(best_assign["test"])].copy(),
    )


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


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Entrenamiento v3 con emociones fusionadas")
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
    p.add_argument("--run-name", type=str, default="v3")
    return p


def main():
    args = build_parser().parse_args()
    set_seed(SEED)

    OUTPUT_DIR = BASE_DIR / "runs" / f"robertuito_emociones_{args.run_name}"
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print(f"PASO 4: Entrenamiento Optimizado ({args.run_name})")
    print("=" * 60)

    # ─── Cargar datos etiquetados ─────────────────────────────────────────
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

            cols = ["text", "id_emocion_f", "emocion_f", "data_source"]
            labeled = pd.concat([labeled[cols], pseudo[cols]], ignore_index=True)
        else:
            print(f"\n2. No se encontraron pseudo-labels en {pseudo_path}")
    else:
        print("\n2. Pseudo-labels desactivados (--no-pseudo)")

    # Unificar columnas necesarias
    df = labeled[["text", "id_emocion_f", "emocion_f", "data_source"]].copy()

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
    print(f"   Total para entrenamiento: {len(df)}")

    # ─── Split ────────────────────────────────────────────────────────────
    print("\n3. Dividiendo datos (stratified)...")
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
        }, f, ensure_ascii=False, indent=2)

    # ─── Tokenize ─────────────────────────────────────────────────────────
    print("\n4. Tokenizando...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, use_fast=True)

    def make_dataset(split_df):
        ds = Dataset.from_pandas(split_df[["text", "label"]].reset_index(drop=True))
        return ds.map(lambda b: tokenizer(b["text"], truncation=True, max_length=MAX_LENGTH), batched=True, remove_columns=["text"])

    tok_train = make_dataset(train_df)
    tok_val = make_dataset(val_df)
    tok_test = make_dataset(test_df)

    # ─── Model ────────────────────────────────────────────────────────────
    print("\n5. Cargando modelo base...")
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

    print(f"\n6. Entrenando (lr={args.lr}, epochs={args.epochs}, focal_gamma={args.focal_gamma}, "
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
    print("\n7. Evaluando en test...")
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
