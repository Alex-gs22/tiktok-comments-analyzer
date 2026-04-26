# Fase 3 — Mejora del Modelo de Emociones

Pipeline para mejorar el clasificador de emociones RoBERTuito sin etiquetar miles de datos manualmente.

## Estructura

```
Fase 3/
├── sql/
│   ├── 001_exportar_corpus_v2_sin_etiquetar.sql   ← Exportar 10K de Supabase
│   ├── 002_exportar_corpus_etiquetado_unificado.sql ← Re-exportar etiquetados
│   └── 003_verificar_tablas_v2.sql                 ← Diagnóstico de tablas
├── data/
│   ├── corpus_etiquetado_fusionado.csv  ← Generado por prepare_corpus.py
│   ├── corpus_sin_etiquetar.csv         ← TÚ: exportar de Supabase
│   ├── corpus_sin_etiquetar_limpio.csv  ← Generado por prepare_corpus.py
│   ├── emociones_fusionadas.csv         ← Catálogo de 6 emociones
│   └── corpus_summary.json             ← Resumen estadístico
├── prepare_corpus.py     ← Paso 1: Unificar y fusionar emociones
├── pseudo_label.py       ← Paso 2: Self-training (próximo)
├── augment_data.py       ← Paso 3: Data augmentation (próximo)
└── train_v3.py           ← Paso 4: Entrenamiento optimizado (próximo)
```

## Pasos a seguir

### Paso 1: Preparar el corpus ✅

1. **Ejecutar en Supabase SQL Editor** las consultas de `003_verificar_tablas_v2.sql` para verificar el esquema
2. **Ejecutar** `001_exportar_corpus_v2_sin_etiquetar.sql` y guardar el CSV como `Fase 3/data/corpus_sin_etiquetar.csv`
3. **Ejecutar** `python prepare_corpus.py` para generar el corpus fusionado

### Fusión de emociones aplicada

| Original | → Fusionada |
|----------|------------|
| Alegría | Alegría |
| Confianza | Confianza |
| Miedo | Miedo |
| Tristeza | Tristeza |
| Sorpresa + Anticipación | **Expectación** |
| Disgusto + Ira | **Rechazo** |

Se preservan las etiquetas originales en columnas `id_emocion_original` y `emocion_nombre_original`.
