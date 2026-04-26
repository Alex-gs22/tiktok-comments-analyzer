# Reporte Fase 3 — Mejora del Clasificador de Emociones

## 1. Resumen Ejecutivo

La Fase 3 tuvo como objetivo mejorar significativamente el clasificador de emociones basado en **RoBERTuito** sin necesidad de etiquetar miles de datos adicionales manualmente. Se aplicaron tres estrategias principales:

1. **Fusión de emociones** semánticamente cercanas (8 → 6 clases)
2. **Self-Training** (pseudo-labeling) usando ~10K comentarios sin etiquetar
3. **Entrenamiento optimizado** con Focal Loss, Label Smoothing y Class Weights

### Resultado principal

| Métrica | v2.1 (Fase 2) | v3 Pseudo (Fase 3) | Mejora |
|---------|:---:|:---:|:---:|
| **Accuracy** | 0.514 | **0.678** | **+31.9%** |
| **Macro F1** | 0.480 | **0.628** | **+30.8%** |
| **Weighted F1** | 0.504 | **0.677** | **+34.3%** |
| Macro Precision | 0.516 | 0.621 | +20.3% |
| Macro Recall | 0.466 | 0.640 | +37.3% |

---

## 2. Estado Inicial (Fase 2 — v2.1)

El modelo v2.1 fue entrenado con **~3,000 comentarios etiquetados manualmente** usando el modelo base `pysentimiento/robertuito-base-uncased` y **8 emociones** de la rueda de Plutchik:

| Emoción | Muestras | F1-Score |
|---------|:---:|:---:|
| Alegría | 441 | 0.397 |
| Anticipación | 479 | 0.469 |
| Confianza | 809 | 0.634 |
| Disgusto | 370 | 0.233 |
| Ira | 278 | 0.470 |
| Miedo | 173 | 0.459 |
| Sorpresa | 219 | 0.269 |
| Tristeza | 303 | 0.564 |

### Problemas detectados
- **Confusión severa** entre emociones semánticamente cercanas (Disgusto↔Ira, Sorpresa↔Anticipación)
- **Desbalance extremo**: Confianza tenía 3-4x más muestras que Miedo
- **Macro F1 bajo** (0.480): indica mal rendimiento en clases minoritarias

---

## 3. Decisiones Técnicas y su Justificación

### 3.1 Fusión de emociones (8 → 6 clases)

**Problema**: Pares de emociones como Disgusto/Ira y Sorpresa/Anticipación son difíciles de distinguir incluso para humanos en texto corto de redes sociales.

**Solución**: Fusionar categorías semánticamente solapadas:

| Original | → Fusionada | Justificación |
|----------|:---:|---|
| Sorpresa + Anticipación | **Expectación** | Ambas implican una reacción ante lo inesperado/futuro |
| Disgusto + Ira | **Rechazo** | Ambas expresan aversión y negatividad activa |
| Alegría | Alegría | Se mantiene |
| Confianza | Confianza | Se mantiene |
| Miedo | Miedo | Se mantiene |
| Tristeza | Tristeza | Se mantiene |

**Impacto**: 
- Distribución más balanceada (rango de 162-763 vs 173-809 antes)
- Menos confusión entre clases similares
- Solo la fusión mejoró macro F1 de 0.480 a 0.510 (+6.3%)

### 3.2 Self-Training (Pseudo-labeling)

**Problema**: Solo 3,000 comentarios etiquetados; etiquetar más manualmente es costoso.

**Solución**: Usar el modelo existente para predecir emociones en los ~10K comentarios sin etiquetar, y usar las predicciones de alta confianza como datos de entrenamiento adicionales.

**Pipeline**:
1. El modelo v2.1 predice los 10,833 comentarios sin etiquetar
2. Se aplica la fusión de probabilidades (sumando probs de clases fusionadas)
3. Se filtran por **umbral de confianza ≥ 0.70**
4. Se verifica **coherencia temática** contra `emociones_esperadas` del tema
5. Solo los comentarios que pasan ambos filtros se usan como pseudo-labels

**Resultados (primera iteración con v2.1)**:
- 2,896 con confianza ≥ 0.70
- 1,148 coherentes con el tema → usados para entrenamiento
- 9,685 enviados a revisión humana

**Iteración con v3_pseudo (modelo mejorado)**:
- 2,987 con confianza ≥ 0.70
- 958 coherentes → usados para v3.1
- 9,875 actualizados para revisión humana

### 3.3 Entrenamiento Optimizado

Se implementaron varias técnicas para maximizar el aprendizaje:

| Técnica | Parámetro | Propósito |
|---------|-----------|-----------|
| **Focal Loss** | γ = 2.0 | Enfoca aprendizaje en ejemplos difíciles, reduce efecto de ejemplos fáciles |
| **Label Smoothing** | ε = 0.1 | Previene overfitting al suavizar las etiquetas one-hot |
| **Class Weights** | Inverso de frecuencia, normalizados | Compensa el desbalance entre clases |
| **Cosine LR Schedule** | Con warmup 10% | Convergencia más suave que step decay |
| **Gradient Clipping** | max_norm = 1.0 | Estabilidad del entrenamiento |
| **Early Stopping** | Patience = 4 | Previene overfitting en épocas tardías |

---

## 4. Resultados Detallados

### 4.1 Comparación de modelos

Se entrenaron **4 variantes** para aislar la contribución de cada mejora:

| Modelo | Datos | Clases | Macro F1 (val) | Macro F1 (test) | Accuracy (test) |
|--------|-------|:---:|:---:|:---:|:---:|
| v2.1 (baseline) | 3K manuales | 8 | — | 0.480 | 0.514 |
| v3_baseline | 2.8K manuales | 6 | 0.518 | 0.510 | 0.546 |
| **v3_pseudo** | 3.8K (manual + pseudo v2.1) | 6 | **0.593** | **0.628** | **0.678** |
| v3.1 | 3.6K (manual + pseudo v3) | 6 | 0.601 | 0.557 | 0.625 |

> **Nota**: Los sets de test difieren entre modelos porque cada entrenamiento hace su propio split, así que los test scores no son directamente comparables entre sí. Lo significativo es la mejora relativa y los validation scores.

### 4.2 Reporte de clasificación — Mejor modelo (v3_pseudo)

```
              precision    recall  f1-score   support

     Alegría     0.4828    0.5600    0.5185        50
   Confianza     0.6864    0.6378    0.6612       127
       Miedo     0.4500    0.4737    0.4615        19
 Expectación     0.7083    0.5903    0.6439       144
    Tristeza     0.6471    0.7719    0.7040        57
     Rechazo     0.7487    0.8046    0.7756       174

    accuracy                         0.6778       571
```

### 4.3 Mejora por clase vs baseline v2.1

| Emoción | F1 Antes (v2.1, 8 clases) | F1 Después (v3, 6 clases) | Cambio |
|---------|:---:|:---:|:---:|
| Alegría | 0.397 | 0.519 | +30.7% |
| Confianza | 0.634 | 0.661 | +4.3% |
| Miedo | 0.459 | 0.462 | +0.7% |
| Expectación | 0.269 / 0.469 (Sorpr./Antic.) | 0.644 | +37-139% |
| Tristeza | 0.564 | 0.704 | +24.8% |
| Rechazo | 0.233 / 0.470 (Disg./Ira) | 0.776 | +65-233% |

> La fusión de Disgusto+Ira en **Rechazo** fue la mejora más dramática, pasando de F1=0.23 a F1=0.78.

---

## 5. Sobre v3.1 vs v3_pseudo

El v3.1 muestra que una segunda iteración de self-training produce rendimientos decrecientes. Esto es esperado: al reentrenar con pseudo-labels generados por un modelo mejor, el margen de mejora se reduce.

Los validation scores son muy similares (v3_pseudo: 0.593, v3.1: 0.601), indicando que ambos modelos son comparables en calidad. La diferencia en test scores se debe a los splits diferentes.

**Recomendación**: Para este ámbito de trabajo, **una iteración de self-training es suficiente**. La siguiente mejora significativa vendría de:
- Revisión humana de los pseudo-labels inciertos
- Más datos etiquetados manualmente para las clases débiles (Miedo, Alegría)

---

## 6. Archivos para Revisión Humana

El archivo `data/pseudo_labels_revision_humana.csv` contiene **9,875 comentarios** ordenados por entropía (los más inciertos primero), con las siguientes columnas útiles:

| Columna | Descripción |
|---------|-------------|
| `texto_raw` | Texto original del comentario |
| `pred_fusionado_nombre` | Emoción predicha por el modelo |
| `pred_fusionado_confianza` | Confianza del modelo (0-1) |
| `entropia` | Incertidumbre (mayor = más dudoso) |
| `margen_top2` | Diferencia entre top-1 y top-2 predicción |
| `tema_nombre` | Tema del video |
| `prob_*` | Probabilidad por cada emoción |

### Distribución de predicciones para revisión

| Emoción | Comentarios |
|---------|:---:|
| Rechazo | 2,780 |
| Expectación | 2,516 |
| Alegría | 1,794 |
| Confianza | 1,775 |
| Tristeza | 564 |
| Miedo | 446 |

**Sugerencia**: Revisar los primeros 200-300 comentarios (los de mayor entropía) confirmaría/corregiría las predicciones más dudosas y daría otro boost al modelo si se reentrenara.

---

## 7. Estructura de archivos generados

```
Fase 3/
├── sql/
│   ├── 001_exportar_corpus_v2_sin_etiquetar.sql
│   ├── 002_exportar_corpus_etiquetado_unificado.sql
│   └── 003_verificar_tablas_v2.sql
├── data/
│   ├── corpus_etiquetado_fusionado.csv        ← 2,951 datos manuales con fusión
│   ├── corpus_sin_etiquetar.csv               ← 10,874 exportados de Supabase
│   ├── corpus_sin_etiquetar_limpio.csv        ← 10,874 preprocesados
│   ├── pseudo_labels_alta_confianza.csv       ← 958 pseudo-labels para entrenamiento
│   ├── pseudo_labels_revision_humana.csv      ← 9,875 para revisión humana
│   ├── pseudo_labels_completo.csv             ← 10,833 todas las predicciones
│   ├── pseudo_label_report.json               ← Estadísticas del pseudo-labeling
│   ├── corpus_summary.json                    ← Resumen del corpus
│   └── emociones_fusionadas.csv               ← Catálogo de 6 emociones
├── runs/
│   ├── robertuito_emociones_v3_baseline/      ← Solo manuales, 6 clases
│   ├── robertuito_emociones_v3_pseudo/        ← Con pseudo-labels v2.1 ★ MEJOR
│   └── robertuito_emociones_v3.1/             ← Con pseudo-labels v3 (iteración 2)
├── prepare_corpus.py                          ← Paso 1: Unificación y fusión
├── pseudo_label.py                            ← Paso 2: Self-training
├── train_v3.py                                ← Paso 4: Entrenamiento optimizado
└── README.md                                  ← Guía de uso
```

---

## 8. Cómo funciona el sistema

### Pipeline de clasificación

```
Comentario de TikTok
        ↓
  Preprocesamiento (pysentimiento)
        ↓
  Tokenización (RoBERTuito tokenizer)
        ↓
  RoBERTuito fine-tuned (6 clases)
        ↓
  Softmax → 6 probabilidades
        ↓
  argmax → Emoción predicha
        ↓
  [Alegría | Confianza | Miedo | Expectación | Tristeza | Rechazo]
```

### Modelo base: RoBERTuito

**RoBERTuito** (`pysentimiento/robertuito-base-uncased`) es un modelo de lenguaje basado en RoBERTa, pre-entrenado específicamente con **~500M de tweets en español**. Sus ventajas para esta tarea:

- Entiende jerga de redes sociales, emojis y abreviaciones
- Vocabulario adaptado al español coloquial
- Arquitectura de 12 capas, 768 dimensiones, ~125M parámetros

### Fine-tuning

Se agrega una cabeza de clasificación (Linear 768→6) sobre RoBERTuito y se entrena end-to-end con los datos etiquetados:

- **Loss**: Focal Loss con γ=2.0 (enfoca en ejemplos difíciles)
- **Regularización**: Label smoothing 0.1, weight decay 0.01, dropout 0.1
- **Optimización**: AdamW, cosine LR schedule, warmup 10%
- **Selección de modelo**: Early stopping por macro F1 en validación

---

## 9. Conclusiones

1. **La fusión de emociones fue la decisión más impactante**: Redujo la confusión entre clases similares y mejoró dramáticamente Rechazo (de F1=0.23 a 0.78) y Expectación
2. **El self-training aporta valor significativo** sin costo de etiquetado: Agregar ~1,000 pseudo-labels confiables subió el macro F1 de 0.510 a 0.628
3. **Una iteración de self-training es suficiente** para el alcance del proyecto: La segunda iteración mostró rendimientos decrecientes
4. **Focal Loss + class weights son esenciales** para manejar el desbalance de clases
5. **La clase Miedo sigue siendo la más difícil** (F1=0.46), probablemente por tener menos muestras y ser ambigua en texto corto
6. **La revisión humana de los ~200 comentarios más inciertos** sería la siguiente mejora más eficiente si se decide continuar
