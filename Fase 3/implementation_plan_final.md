# Fase 3 — Cierre: Reentrenamiento con Datos Revisados

## Contexto

Después de usar el reviewer para confirmar/corregir pseudo-labels, tendremos datos verificados por humano que son más valiosos que los pseudo-labels automáticos. El objetivo es integrarlos al corpus y entrenar el modelo final de Fase 3.

---

## Propuesta de Cambios

### Paso 1: Exportar datos revisados desde Supabase

#### [NEW] `Fase 3/sql/005_exportar_revisados.sql`
- Query para exportar los comentarios con `revision_estado IN ('confirmado', 'corregido')` 
- Incluye: `texto_raw`, `texto_limpio`, `revision_emocion_id`, `revision_emocion_nombre`, `revision_estado`
- Los descartados se excluyen del entrenamiento

#### [NEW] `Fase 3/export_reviewed.py`
- Script Python que se conecta a Supabase vía API y descarga los revisados directamente
- Guarda en `data/revisados_humanos.csv`
- Genera resumen: cuántos confirmados, cuántos corregidos, distribución por emoción

> [!NOTE]
> Alternativa: el usuario puede exportar manualmente desde Supabase Table Editor con filtros. El script es por conveniencia.

---

### Paso 2: Integrar al corpus de entrenamiento

#### [MODIFY] `Fase 3/prepare_corpus.py`
- Agregar flag `--include-reviewed` que incorpore `revisados_humanos.csv`
- Los **confirmados** se agregan con su emoción predicha (ya validada)
- Los **corregidos** se agregan con la emoción corregida por el humano
- Deduplicación por `id_comment` para no duplicar con pseudo-labels anteriores
- Genera `corpus_final_v3.csv` con todos los datos combinados:
  - Datos etiquetados manualmente originales (~2,950)
  - Pseudo-labels de alta confianza automáticos (~958)
  - Datos revisados por humano (variable, depende de cuántos se revisen)

---

### Paso 3: Entrenamiento final (v3.2)

#### Usar `Fase 3/train_v3.py` existente
- Mismo script, con `--run-name v3.2`
- Los datos revisados por humano son "gold standard" — más confiables que pseudo-labels
- Se esperaría una mejora principalmente en las clases que más se corrigieron

---

### Paso 4: Evaluación comparativa final

#### [NEW] `Fase 3/compare_models.py`
- Carga los reportes de métricas de todos los runs (`v3_baseline`, `v3_pseudo`, `v3.1`, `v3.2`)
- Genera tabla comparativa de macro F1, accuracy, F1 por clase
- Identifica qué clases mejoraron más con la revisión humana
- Exporta resumen en `data/comparacion_modelos.json`

---

### Paso 5: Actualizar reporte final

#### [MODIFY] `Fase 3/REPORTE_FASE_3.md`
- Agregar sección con resultados del modelo v3.2
- Tabla comparativa completa: v2.1 → v3_baseline → v3_pseudo → v3.2
- Estadísticas de la revisión humana (cuántos confirmados/corregidos/descartados)
- Conclusiones finales de Fase 3

---

## Open Questions

> [!IMPORTANT]
> 1. **¿Cuántos comentarios piensas revisar?** ¿Todos los 9,875 o un subconjunto (ej. los primeros 500-1000 más inciertos)? Esto determina el impacto esperado.
> 2. **¿Quieres que el script de exportación se conecte directo a Supabase** (requiere la service key) o prefieres **exportar manualmente el CSV** desde Table Editor?

---

## Verificación

### Automatizada
- El entrenamiento v3.2 completa sin errores
- Macro F1 de v3.2 ≥ macro F1 de v3_pseudo (0.628)

### Manual
- Verificar que los datos revisados se integraron correctamente (sin duplicados)
- Revisar classification report por clase para confirmar mejora en clases débiles
