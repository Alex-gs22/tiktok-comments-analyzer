# Fase 3 — Walkthrough de Mejoras al Modelo

## Resumen de Resultados

La combinación de fusión de emociones + pseudo-labels + focal loss produjo una **mejora masiva**:

| Métrica | v2.1 Baseline (8 clases) | v3 Baseline (6 clases) | **v3 Pseudo (6 clases)** | Δ vs v2.1 |
|---------|-------------------------|------------------------|--------------------------|-----------|
| Accuracy | 0.514 | 0.546 | **0.678** | **+32.0%** |
| Macro F1 | 0.480 | 0.510 | **0.628** | **+30.8%** |
| Weighted F1 | 0.504 | 0.548 | **0.677** | **+34.3%** |
| Macro Precision | 0.516 | 0.503 | **0.621** | **+20.3%** |
| Macro Recall | 0.466 | 0.523 | **0.640** | **+37.3%** |

## Classification Report — v3 Pseudo (Mejor Modelo)

```
              precision    recall  f1-score   support

     Alegría     0.4828    0.5600    0.5185        50
   Confianza     0.6864    0.6378    0.6612       127
       Miedo     0.4500    0.4737    0.4615        19
 Expectación     0.7083    0.5903    0.6439       144
    Tristeza     0.6471    0.7719    0.7040        57
     Rechazo     0.7487    0.8046    0.7756       174

    accuracy                         0.6778       571
   macro avg     0.6205    0.6397    0.6275       571
```

> [!TIP]
> **Rechazo** (la fusión de Disgusto+Ira) ahora es la mejor clase con F1=0.776, cuando antes Disgusto e Ira eran las peores (F1=0.23 y 0.47). La fusión fue la decisión correcta.

## Qué se hizo

### 1. Fusión de emociones (8 → 6)
- Sorpresa + Anticipación → **Expectación**
- Disgusto + Ira → **Rechazo**
- Distribución resultante mucho más balanceada

### 2. Pseudo-labeling
- Modelo v2.1 predijo 10,833 comentarios sin etiquetar
- Filtrado por confianza ≥0.70 + coherencia temática
- **1,148 pseudo-labels** de alta confianza agregados al entrenamiento
- Total entrenamiento: 3,805 muestras (vs 2,786 sin pseudo-labels)

### 3. Entrenamiento optimizado
- **Focal Loss** (γ=2.0): enfoca aprendizaje en ejemplos difíciles
- **Label smoothing** (0.1): reduce overfitting
- **Class weights**: compensa desbalance
- **Gradient clipping** (max_norm=1.0): estabilidad
- **Cosine LR scheduler** con warmup 10%

## Archivos generados

```
Fase 3/
├── runs/
│   ├── robertuito_emociones_v3_baseline/   ← Solo datos manuales, 6 clases
│   └── robertuito_emociones_v3_pseudo/     ← Con pseudo-labels ★ MEJOR
├── data/
│   ├── corpus_etiquetado_fusionado.csv     ← 2,951 etiquetados
│   ├── corpus_sin_etiquetar_limpio.csv     ← 10,874 sin etiquetar
│   ├── pseudo_labels_alta_confianza.csv    ← 1,148 para entrenamiento
│   ├── pseudo_labels_revision_humana.csv   ← 9,685 para revisión
│   └── pseudo_labels_completo.csv          ← Todas las predicciones
├── prepare_corpus.py
├── pseudo_label.py
└── train_v3.py
```

## Próximos pasos sugeridos

1. **Revisar pseudo-labels**: El archivo `pseudo_labels_revision_humana.csv` tiene 9,685 comentarios ordenados por entropía. Etiquetar los top 200-300 más inciertos daría otro boost.
2. **Data augmentation** para Miedo y Alegría (las clases más débiles).
3. **Iteración de self-training**: usar el modelo v3_pseudo para re-predecir los 10K y generar pseudo-labels aún mejores.
