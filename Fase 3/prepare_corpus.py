"""
Paso 1: Preparar y unificar el corpus para Fase 3.

Este script toma los CSVs exportados de Supabase y:
1. Unifica los datos etiquetados (de Fase 2 o del SQL unificado)
2. Carga los datos sin etiquetar de corpus_v2
3. Aplica la fusión de emociones (Sorpresa+Anticipación, Disgusto+Ira)
4. Genera los archivos finales listos para el pipeline de entrenamiento

Uso:
    python prepare_corpus.py

Archivos de entrada esperados en Fase 3/data/:
    - corpus_etiquetado.csv   (exportado con 002_exportar_corpus_etiquetado_unificado.sql)
    - corpus_sin_etiquetar.csv (exportado con 001_exportar_corpus_v2_sin_etiquetar.sql)
    
    O alternativamente:
    - Se usa el dataset_emociones_v2.0.csv existente como fuente etiquetada

Archivos de salida en Fase 3/data/:
    - corpus_etiquetado_fusionado.csv    (etiquetados con emociones fusionadas)
    - corpus_sin_etiquetar_limpio.csv    (sin etiquetar, preprocesado)
    - emociones_fusionadas.csv           (catálogo de emociones fusionadas)
    - corpus_summary.json                (resumen estadístico)
"""

import json
import re
from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
FASE2_DATA = BASE_DIR.parent / "data"

# ─── Catálogo de emociones original ───────────────────────────────────────────
EMOCIONES_ORIGINALES = {
    1: "Alegría",
    2: "Confianza",
    3: "Miedo",
    4: "Sorpresa",
    5: "Tristeza",
    6: "Disgusto",
    7: "Ira",
    8: "Anticipación",
}

# ─── Mapeo de fusión ─────────────────────────────────────────────────────────
# Sorpresa (4) + Anticipación (8) → Expectación
# Disgusto (6) + Ira (7) → Rechazo
FUSION_MAP = {
    1: {"id_nuevo": 1, "nombre_nuevo": "Alegría"},
    2: {"id_nuevo": 2, "nombre_nuevo": "Confianza"},
    3: {"id_nuevo": 3, "nombre_nuevo": "Miedo"},
    4: {"id_nuevo": 4, "nombre_nuevo": "Expectación"},   # Sorpresa → Expectación
    5: {"id_nuevo": 5, "nombre_nuevo": "Tristeza"},
    6: {"id_nuevo": 6, "nombre_nuevo": "Rechazo"},        # Disgusto → Rechazo
    7: {"id_nuevo": 6, "nombre_nuevo": "Rechazo"},        # Ira → Rechazo
    8: {"id_nuevo": 4, "nombre_nuevo": "Expectación"},    # Anticipación → Expectación
}

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


def strip_bracket_annotations(text: str) -> str:
    """Elimina anotaciones entre corchetes como [ironía] pero preserva el texto."""
    text = BRACKET_PATTERN.sub(" ", text)
    return WHITESPACE_PATTERN.sub(" ", text).strip()


def pick_best_text(row: pd.Series) -> str:
    """Selecciona el mejor texto fuente de un comentario."""
    for col in ("texto_modelo", "texto_limpio", "texto_raw"):
        if col not in row.index:
            continue
        value = row[col]
        if pd.isna(value):
            continue
        cleaned = str(value).strip()
        if cleaned:
            return cleaned
    return ""


def apply_fusion(df: pd.DataFrame) -> pd.DataFrame:
    """Aplica la fusión de emociones al DataFrame."""
    df = df.copy()

    df["id_emocion_original"] = df["id_emocion"]
    df["emocion_nombre_original"] = df["emocion_nombre"]

    df["id_emocion_fusionado"] = df["id_emocion"].map(
        lambda x: FUSION_MAP[int(x)]["id_nuevo"] if pd.notna(x) and int(x) in FUSION_MAP else None
    )
    df["emocion_nombre_fusionado"] = df["id_emocion"].map(
        lambda x: FUSION_MAP[int(x)]["nombre_nuevo"] if pd.notna(x) and int(x) in FUSION_MAP else None
    )

    return df


def load_labeled_data() -> pd.DataFrame:
    """
    Carga los datos etiquetados. Intenta primero el CSV exportado de Supabase,
    si no existe, usa el dataset_emociones_v2.0.csv de Fase 2.
    """
    supabase_export = DATA_DIR / "corpus_etiquetado.csv"
    fase2_dataset = FASE2_DATA / "dataset_emociones_v2.0.csv"

    if supabase_export.exists():
        print(f"  Cargando datos etiquetados de: {supabase_export}")
        df = pd.read_csv(supabase_export)
    elif fase2_dataset.exists():
        print(f"  Usando dataset existente de Fase 2: {fase2_dataset}")
        df = pd.read_csv(fase2_dataset)
    else:
        raise FileNotFoundError(
            "No se encontró ninguna fuente de datos etiquetados.\n"
            f"  Opción 1: Exportar con SQL y guardar como: {supabase_export}\n"
            f"  Opción 2: Copiar dataset existente a: {fase2_dataset}"
        )

    # Filtrar solo los que tienen etiqueta
    df = df[df["id_emocion"].notna()].copy()
    df["id_emocion"] = df["id_emocion"].astype(int)

    print(f"  → {len(df)} comentarios etiquetados cargados")
    return df


def load_unlabeled_data() -> pd.DataFrame | None:
    """Carga los datos sin etiquetar del corpus_v2."""
    unlabeled_path = DATA_DIR / "corpus_sin_etiquetar.csv"

    if not unlabeled_path.exists():
        print(f"  ⚠ No se encontró: {unlabeled_path}")
        print("    Exporta los datos con 001_exportar_corpus_v2_sin_etiquetar.sql")
        print("    y guárdalos como corpus_sin_etiquetar.csv en Fase 3/data/")
        return None

    df = pd.read_csv(unlabeled_path)

    # Separar etiquetados de no etiquetados (por si el export incluye ambos)
    unlabeled = df[df["id_emocion"].isna()].copy()
    already_labeled = df[df["id_emocion"].notna()]

    if len(already_labeled) > 0:
        print(f"  ℹ {len(already_labeled)} comentarios ya etiquetados encontrados en corpus_v2")
        print(f"    (se excluyen del set sin etiquetar)")

    print(f"  → {len(unlabeled)} comentarios sin etiquetar cargados")
    return unlabeled


def clean_text_column(df: pd.DataFrame) -> pd.DataFrame:
    """Prepara la columna 'texto_modelo' seleccionando el mejor texto disponible."""
    df = df.copy()
    df["texto_para_modelo"] = df.apply(pick_best_text, axis=1)
    df["texto_para_modelo_limpio"] = df["texto_para_modelo"].apply(strip_bracket_annotations)

    # Filtrar textos vacíos
    before = len(df)
    df = df[df["texto_para_modelo_limpio"].str.len() > 0].copy()
    removed = before - len(df)
    if removed > 0:
        print(f"  ⚠ {removed} filas eliminadas por texto vacío")

    return df


def deduplicate(df: pd.DataFrame, subset_col: str = "id_comment") -> pd.DataFrame:
    """Elimina duplicados por id_comment."""
    if subset_col not in df.columns:
        return df

    before = len(df)
    df = df.drop_duplicates(subset=[subset_col]).copy()
    removed = before - len(df)
    if removed > 0:
        print(f"  ℹ {removed} duplicados eliminados por {subset_col}")

    return df


def generate_summary(
    labeled: pd.DataFrame,
    unlabeled: pd.DataFrame | None,
) -> dict:
    """Genera un resumen estadístico del corpus."""
    summary = {
        "total_etiquetados": int(len(labeled)),
        "emociones_originales": {
            "total_clases": 8,
            "distribucion": labeled["emocion_nombre_original"]
                .value_counts()
                .sort_index()
                .to_dict(),
        },
        "emociones_fusionadas": {
            "total_clases": 6,
            "catalogo": EMOCIONES_FUSIONADAS,
            "distribucion": labeled["emocion_nombre_fusionado"]
                .value_counts()
                .sort_index()
                .to_dict(),
        },
        "fusion_aplicada": {
            "Sorpresa + Anticipación": "Expectación",
            "Disgusto + Ira": "Rechazo",
        },
        "temas": labeled["tema_nombre"]
            .value_counts()
            .to_dict() if "tema_nombre" in labeled.columns else {},
    }

    if unlabeled is not None:
        summary["total_sin_etiquetar"] = int(len(unlabeled))
        if "tema_nombre" in unlabeled.columns:
            summary["temas_sin_etiquetar"] = unlabeled["tema_nombre"] \
                .value_counts() \
                .to_dict()

    return summary


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("PASO 1: Preparación del Corpus - Fase 3")
    print("=" * 60)

    # ─── Cargar datos ─────────────────────────────────────────────────────
    print("\n1. Cargando datos etiquetados...")
    labeled = load_labeled_data()
    labeled = deduplicate(labeled)
    labeled = clean_text_column(labeled)

    print("\n2. Cargando datos sin etiquetar...")
    unlabeled = load_unlabeled_data()
    if unlabeled is not None:
        unlabeled = deduplicate(unlabeled)
        unlabeled = clean_text_column(unlabeled)

    # ─── Aplicar fusión de emociones ──────────────────────────────────────
    print("\n3. Aplicando fusión de emociones...")
    labeled = apply_fusion(labeled)

    print("   Mapeo aplicado:")
    print("     Sorpresa (4) + Anticipación (8) → Expectación (4)")
    print("     Disgusto (6) + Ira (7) → Rechazo (6)")

    print("\n   Distribución original:")
    for nombre, count in labeled["emocion_nombre_original"].value_counts().sort_index().items():
        print(f"     {nombre}: {count}")

    print("\n   Distribución fusionada:")
    for nombre, count in labeled["emocion_nombre_fusionado"].value_counts().sort_index().items():
        print(f"     {nombre}: {count}")

    # ─── Guardar archivos ─────────────────────────────────────────────────
    print("\n4. Guardando archivos...")

    # Corpus etiquetado con fusión
    labeled_path = DATA_DIR / "corpus_etiquetado_fusionado.csv"
    labeled.to_csv(labeled_path, index=False)
    print(f"   ✓ {labeled_path.name} ({len(labeled)} filas)")

    # Corpus sin etiquetar limpio
    if unlabeled is not None:
        unlabeled_path = DATA_DIR / "corpus_sin_etiquetar_limpio.csv"
        unlabeled.to_csv(unlabeled_path, index=False)
        print(f"   ✓ {unlabeled_path.name} ({len(unlabeled)} filas)")

    # Catálogo de emociones fusionadas
    emociones_df = pd.DataFrame([
        {"id": k, "nombre": v}
        for k, v in EMOCIONES_FUSIONADAS.items()
    ])
    emociones_path = DATA_DIR / "emociones_fusionadas.csv"
    emociones_df.to_csv(emociones_path, index=False)
    print(f"   ✓ {emociones_path.name}")

    # Resumen
    summary = generate_summary(labeled, unlabeled)
    summary_path = DATA_DIR / "corpus_summary.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    print(f"   ✓ {summary_path.name}")

    print("\n" + "=" * 60)
    print("Paso 1 completado.")
    print(f"  Etiquetados: {len(labeled)} (con emociones fusionadas)")
    if unlabeled is not None:
        print(f"  Sin etiquetar: {len(unlabeled)} (listos para pseudo-labeling)")
    print(f"  Clases: {len(EMOCIONES_FUSIONADAS)} emociones fusionadas")
    print("=" * 60)


if __name__ == "__main__":
    main()
