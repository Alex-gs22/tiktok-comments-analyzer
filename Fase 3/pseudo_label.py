"""
Paso 2: Pseudo-labeling con Self-Training.

Usa el modelo v2.1 (RoBERTuito 8 emociones) para predecir los ~10K
comentarios sin etiquetar, filtra por confianza, aplica la fusión de
emociones y genera archivos separados para:
  - Pseudo-labels de alta confianza (para entrenamiento)
  - Pseudo-labels de baja confianza (para revisión humana)
  - Reporte completo de todas las predicciones

Uso:
    python pseudo_label.py [--threshold 0.85] [--model-path PATH]

Archivos de entrada (de prepare_corpus.py):
    - data/corpus_sin_etiquetar_limpio.csv

Archivos de salida en data/:
    - pseudo_labels_alta_confianza.csv      → para agregar al entrenamiento
    - pseudo_labels_baja_confianza.csv      → para revisión humana
    - pseudo_labels_completo.csv            → todas las predicciones
    - pseudo_label_report.json              → resumen estadístico
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

# Modelo de Fase 2 (v2.1, el mejor hasta ahora).
DEFAULT_MODEL_PATH = (
    BASE_DIR.parent / "Fase 2" / "runs" / "robertuito_emociones_v2.1" / "best_model"
)

# Umbral de confianza para considerar un pseudo-label como "de alta confianza".
DEFAULT_THRESHOLD = 0.85

# Batch size para inferencia (ajustar según memoria disponible).
INFERENCE_BATCH_SIZE = 64
MAX_LENGTH = 128

# ─── Fusión de emociones ─────────────────────────────────────────────────────
# El modelo v2.1 predice 8 emociones. Mapeamos a 6 fusionadas.
# id2label del modelo: {0: Alegría, 1: Confianza, 2: Miedo, 3: Sorpresa,
#                       4: Tristeza, 5: Disgusto, 6: Ira, 7: Anticipación}

MODELO_ID2LABEL = {
    0: "Alegría",
    1: "Confianza",
    2: "Miedo",
    3: "Sorpresa",
    4: "Tristeza",
    5: "Disgusto",
    6: "Ira",
    7: "Anticipación",
}

# Mapeo: id del modelo → id fusionado
FUSION_MODEL_ID = {
    0: 1,  # Alegría → 1 (Alegría)
    1: 2,  # Confianza → 2 (Confianza)
    2: 3,  # Miedo → 3 (Miedo)
    3: 4,  # Sorpresa → 4 (Expectación)
    4: 5,  # Tristeza → 5 (Tristeza)
    5: 6,  # Disgusto → 6 (Rechazo)
    6: 6,  # Ira → 6 (Rechazo)
    7: 4,  # Anticipación → 4 (Expectación)
}

EMOCIONES_FUSIONADAS = {
    1: "Alegría",
    2: "Confianza",
    3: "Miedo",
    4: "Expectación",
    5: "Tristeza",
    6: "Rechazo",
}

# Emociones fusionadas: al fusionar, sumamos las probabilidades de las
# emociones que se combinan para obtener la confianza fusionada.
# Sorpresa (3) + Anticipación (7) → Expectación
# Disgusto (5) + Ira (6) → Rechazo
FUSION_PROB_GROUPS = {
    1: [0],      # Alegría: solo prob de Alegría
    2: [1],      # Confianza: solo prob de Confianza
    3: [2],      # Miedo: solo prob de Miedo
    4: [3, 7],   # Expectación: prob de Sorpresa + Anticipación
    5: [4],      # Tristeza: solo prob de Tristeza
    6: [5, 6],   # Rechazo: prob de Disgusto + Ira
}

BRACKET_PATTERN = re.compile(r"\[[^\[\]]+\]")
WHITESPACE_PATTERN = re.compile(r"\s+")


def strip_bracket_annotations(text: str) -> str:
    text = BRACKET_PATTERN.sub(" ", text)
    return WHITESPACE_PATTERN.sub(" ", text).strip()


def preprocess_for_model(text: str) -> str:
    """Preprocesa texto para el modelo RoBERTuito."""
    text = strip_bracket_annotations(str(text).strip())
    if not text:
        return ""

    try:
        from pysentimiento.preprocessing import preprocess_tweet
        text = preprocess_tweet(text)
    except ImportError:
        pass

    return WHITESPACE_PATTERN.sub(" ", text).strip()


def fuse_probabilities(probs: np.ndarray, num_model_labels: int) -> tuple[np.ndarray, np.ndarray]:
    """
    Fusiona las probabilidades a 6 clases fusionadas.
    Si el modelo ya tiene 6 clases, se usa directamente sin fusionar.

    Returns:
        fused_probs: array de shape (N, 6) con probabilidades fusionadas.
        fused_ids: array de shape (N,) con el id fusionado predicho (1-indexed).
    """
    if num_model_labels == 6:
        # Modelo ya fusionado — las probs son directamente las 6 clases
        fused_pred_idx = np.argmax(probs, axis=1)
        fused_ids = fused_pred_idx + 1  # 0-indexed → 1-indexed
        return probs.astype(np.float32), fused_ids

    # Modelo de 8 clases — fusionar
    n_samples = probs.shape[0]
    n_fused = len(EMOCIONES_FUSIONADAS)
    fused_probs = np.zeros((n_samples, n_fused), dtype=np.float32)

    for fused_id, model_ids in FUSION_PROB_GROUPS.items():
        fused_idx = fused_id - 1
        for model_id in model_ids:
            fused_probs[:, fused_idx] += probs[:, model_id]

    fused_pred_idx = np.argmax(fused_probs, axis=1)
    fused_ids = fused_pred_idx + 1

    return fused_probs, fused_ids


def load_model(model_path: Path, device: str | None = None):
    """Carga modelo y tokenizer."""
    if not model_path.exists():
        raise FileNotFoundError(f"No se encontró el modelo en: {model_path}")

    if device is None:
        if torch.cuda.is_available():
            device = "cuda"
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            device = "mps"
        else:
            device = "cpu"

    print(f"  Dispositivo: {device}")
    print(f"  Modelo: {model_path}")

    tokenizer = AutoTokenizer.from_pretrained(str(model_path), use_fast=True)
    model = AutoModelForSequenceClassification.from_pretrained(str(model_path))
    model.to(device)
    model.eval()

    num_labels = model.config.num_labels
    model_id2label = {int(k): v for k, v in model.config.id2label.items()}
    print(f"  Clases del modelo: {num_labels} → {model_id2label}")

    return model, tokenizer, device, num_labels, model_id2label


def predict_batch_raw(
    texts: list[str],
    model,
    tokenizer,
    device: str,
    batch_size: int = INFERENCE_BATCH_SIZE,
) -> np.ndarray:
    """
    Predice probabilidades para una lista de textos.

    Returns:
        probs: array de shape (N, 8) con probabilidades softmax originales.
    """
    all_probs = []

    for i in range(0, len(texts), batch_size):
        batch_texts = texts[i : i + batch_size]

        encoded = tokenizer(
            batch_texts,
            truncation=True,
            padding=True,
            max_length=MAX_LENGTH,
            return_tensors="pt",
        )
        encoded = {k: v.to(device) for k, v in encoded.items()}

        with torch.inference_mode():
            outputs = model(**encoded)
            probs = torch.softmax(outputs.logits, dim=-1)
            all_probs.append(probs.cpu().numpy())

        if (i + batch_size) % (batch_size * 10) == 0 or i + batch_size >= len(texts):
            processed = min(i + batch_size, len(texts))
            print(f"    {processed}/{len(texts)} procesados", end="\r")

    print()
    return np.vstack(all_probs)


def build_cli_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Pseudo-labeling: predecir emociones en datos sin etiquetar."
    )
    parser.add_argument(
        "--model-path",
        type=str,
        default=str(DEFAULT_MODEL_PATH),
        help="Ruta al modelo fine-tuned.",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=DEFAULT_THRESHOLD,
        help="Umbral de confianza para pseudo-labels de alta confianza (default: 0.85).",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=INFERENCE_BATCH_SIZE,
        help="Batch size para inferencia.",
    )
    parser.add_argument(
        "--device",
        type=str,
        default=None,
        help="Dispositivo: cpu, cuda, mps. Auto-detecta si se omite.",
    )
    return parser


def main():
    args = build_cli_parser().parse_args()

    print("=" * 60)
    print("PASO 2: Pseudo-labeling con Self-Training")
    print("=" * 60)

    # ─── Cargar datos sin etiquetar ───────────────────────────────────────
    unlabeled_path = DATA_DIR / "corpus_sin_etiquetar_limpio.csv"
    if not unlabeled_path.exists():
        print(f"Error: No se encontró {unlabeled_path}")
        print("Ejecuta primero prepare_corpus.py (Paso 1).")
        sys.exit(1)

    print("\n1. Cargando datos sin etiquetar...")
    df = pd.read_csv(unlabeled_path)
    print(f"   {len(df)} comentarios cargados")

    # Preprocesar texto para el modelo
    print("\n2. Preprocesando texto para el modelo...")
    df["text_processed"] = df["texto_para_modelo_limpio"].apply(preprocess_for_model)
    df = df[df["text_processed"].str.len() > 0].copy()
    print(f"   {len(df)} comentarios válidos después de preprocesamiento")

    # ─── Cargar modelo ────────────────────────────────────────────────────
    print("\n3. Cargando modelo...")
    model_path = Path(args.model_path)
    model, tokenizer, device, num_model_labels, model_id2label = load_model(model_path, args.device)

    # ─── Inferencia ───────────────────────────────────────────────────────
    print(f"\n4. Ejecutando inferencia (batch_size={args.batch_size})...")
    texts = df["text_processed"].tolist()
    raw_probs = predict_batch_raw(texts, model, tokenizer, device, args.batch_size)

    # ─── Fusión de probabilidades ─────────────────────────────────────────
    if num_model_labels == 6:
        print("5. Modelo ya tiene 6 clases fusionadas — sin fusión adicional.")
    else:
        print("5. Fusionando probabilidades (8 → 6 emociones)...")
    fused_probs, fused_ids = fuse_probabilities(raw_probs, num_model_labels)
    fused_confidence = np.max(fused_probs, axis=1)

    # Agregar predicciones originales al DataFrame
    raw_pred_ids = np.argmax(raw_probs, axis=1)
    raw_confidence = np.max(raw_probs, axis=1)
    df["pred_original_id"] = raw_pred_ids
    active_id2label = model_id2label if num_model_labels == 6 else MODELO_ID2LABEL
    df["pred_original_nombre"] = [active_id2label.get(i, f"LABEL_{i}") for i in raw_pred_ids]
    df["pred_original_confianza"] = raw_confidence.round(4)

    # Agregar predicciones fusionadas
    df["pred_fusionado_id"] = fused_ids
    df["pred_fusionado_nombre"] = [EMOCIONES_FUSIONADAS[i] for i in fused_ids]
    df["pred_fusionado_confianza"] = fused_confidence.round(4)

    # Agregar probabilidades por clase fusionada
    for fused_id, nombre in EMOCIONES_FUSIONADAS.items():
        df[f"prob_{nombre.lower()}"] = fused_probs[:, fused_id - 1].round(4)

    # Entropía (incertidumbre) — útil para active learning futuro
    entropy = -np.sum(fused_probs * np.log(fused_probs + 1e-10), axis=1)
    df["entropia"] = entropy.round(4)

    # Margen entre top-1 y top-2 (menor margen = más incierto)
    sorted_probs = np.sort(fused_probs, axis=1)[:, ::-1]
    margin = sorted_probs[:, 0] - sorted_probs[:, 1]
    df["margen_top2"] = margin.round(4)

    # ─── Separar por confianza ────────────────────────────────────────────
    threshold = args.threshold
    print(f"\n6. Separando por umbral de confianza ({threshold})...")

    high_conf = df[df["pred_fusionado_confianza"] >= threshold].copy()
    low_conf = df[df["pred_fusionado_confianza"] < threshold].copy()

    print(f"   Alta confianza (≥{threshold}): {len(high_conf)} ({len(high_conf)/len(df)*100:.1f}%)")
    print(f"   Baja confianza (<{threshold}): {len(low_conf)} ({len(low_conf)/len(df)*100:.1f}%)")

    # ─── Coherencia temática (filtro extra) ───────────────────────────────
    # Si el tema tiene emociones_esperadas, verificar coherencia
    print("\n7. Verificando coherencia temática...")
    incoherent_count = 0
    coherence_flags = []

    for _, row in high_conf.iterrows():
        esperadas_raw = row.get("emociones_esperadas")
        is_coherent = True

        if pd.notna(esperadas_raw) and esperadas_raw not in ("null", ""):
            try:
                esperadas = json.loads(str(esperadas_raw))
                if isinstance(esperadas, list) and len(esperadas) > 0:
                    pred_original_id = int(row["pred_original_id"])
                    # Los IDs en emociones_esperadas son 1-indexed (del catálogo original)
                    pred_emocion_original_id = pred_original_id + 1  # model 0-indexed → DB 1-indexed
                    if pred_emocion_original_id not in esperadas:
                        is_coherent = False
                        incoherent_count += 1
            except (json.JSONDecodeError, TypeError, ValueError):
                pass

        coherence_flags.append(is_coherent)

    high_conf["coherente_con_tema"] = coherence_flags
    coherent = high_conf[high_conf["coherente_con_tema"]].copy()
    incoherent = high_conf[~high_conf["coherente_con_tema"]].copy()

    print(f"   Coherentes: {len(coherent)}")
    print(f"   Incoherentes (tema no esperado): {len(incoherent)}")
    print(f"   → Los incoherentes se mueven a revisión humana")

    # Los incoherentes van a revisión
    review_set = pd.concat([low_conf, incoherent], ignore_index=True)
    review_set = review_set.sort_values("entropia", ascending=False)

    # ─── Guardar archivos ─────────────────────────────────────────────────
    print("\n8. Guardando archivos...")

    # Alta confianza (para entrenamiento)
    alta_path = DATA_DIR / "pseudo_labels_alta_confianza.csv"
    coherent.to_csv(alta_path, index=False)
    print(f"   ✓ {alta_path.name} ({len(coherent)} filas)")

    # Para revisión humana (baja confianza + incoherentes)
    review_path = DATA_DIR / "pseudo_labels_revision_humana.csv"
    review_set.to_csv(review_path, index=False)
    print(f"   ✓ {review_path.name} ({len(review_set)} filas)")

    # Completo (todas las predicciones sin filtrar)
    completo_path = DATA_DIR / "pseudo_labels_completo.csv"
    df.to_csv(completo_path, index=False)
    print(f"   ✓ {completo_path.name} ({len(df)} filas)")

    # ─── Reporte ──────────────────────────────────────────────────────────
    report = {
        "modelo": str(model_path),
        "umbral_confianza": threshold,
        "total_sin_etiquetar": int(len(df)),
        "alta_confianza_total": int(len(high_conf)),
        "alta_confianza_coherentes": int(len(coherent)),
        "alta_confianza_incoherentes": int(len(incoherent)),
        "baja_confianza": int(len(low_conf)),
        "para_revision_humana": int(len(review_set)),
        "distribucion_alta_confianza": coherent["pred_fusionado_nombre"]
            .value_counts()
            .sort_index()
            .to_dict() if len(coherent) > 0 else {},
        "distribucion_revision": review_set["pred_fusionado_nombre"]
            .value_counts()
            .sort_index()
            .to_dict() if len(review_set) > 0 else {},
        "estadisticas_confianza": {
            "mean": float(df["pred_fusionado_confianza"].mean()),
            "median": float(df["pred_fusionado_confianza"].median()),
            "std": float(df["pred_fusionado_confianza"].std()),
            "min": float(df["pred_fusionado_confianza"].min()),
            "max": float(df["pred_fusionado_confianza"].max()),
        },
        "estadisticas_entropia": {
            "mean": float(df["entropia"].mean()),
            "median": float(df["entropia"].median()),
            "std": float(df["entropia"].std()),
        },
    }

    report_path = DATA_DIR / "pseudo_label_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"   ✓ {report_path.name}")

    # ─── Resumen final ────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("Paso 2 completado.")
    print(f"  Total procesados:        {len(df)}")
    print(f"  Alta confianza (train):  {len(coherent)} ({len(coherent)/len(df)*100:.1f}%)")
    print(f"  Para revisión humana:    {len(review_set)} ({len(review_set)/len(df)*100:.1f}%)")
    print()
    print("  Distribución de pseudo-labels (alta confianza):")
    if len(coherent) > 0:
        for nombre, count in coherent["pred_fusionado_nombre"].value_counts().sort_index().items():
            print(f"    {nombre}: {count}")
    print()
    print("  Próximo paso: python train_v3.py")
    print("=" * 60)


if __name__ == "__main__":
    main()
