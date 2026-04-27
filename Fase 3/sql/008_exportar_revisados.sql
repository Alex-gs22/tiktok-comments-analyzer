-- ============================================================
-- 008: Exportar datos revisados desde pseudo_labels_review
-- ============================================================
-- Ejecutar en Supabase SQL Editor.
-- Copiar resultados como CSV y guardar en data/
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- EXPORT 1: Para v3.2 (6 emociones)
-- Solo confirmados y corregidos. Guardar como: revisados_v32.csv
-- ─────────────────────────────────────────────────────────────
SELECT
    id,
    texto_raw,
    texto_limpio,
    pred_emocion_id,
    pred_emocion_nombre,
    pred_confianza,
    entropia,
    revision_emocion_id,
    revision_emocion_nombre,
    revision_estado,
    tema_nombre,
    categoria
FROM pseudo_labels_review
WHERE revision_estado IN ('confirmado', 'corregido')
ORDER BY id;

-- ─────────────────────────────────────────────────────────────
-- EXPORT 2: Para v3.2.1 (7 emociones, incluye Neutral)
-- Confirmados + corregidos + descartados.
-- Los descartados se exportan con emocion "Neutral" (id=7).
-- Guardar como: revisados_v321.csv
-- ─────────────────────────────────────────────────────────────
SELECT
    id,
    texto_raw,
    texto_limpio,
    pred_emocion_id,
    pred_emocion_nombre,
    pred_confianza,
    entropia,
    -- Para confirmados/corregidos: usar la emoción revisada
    -- Para descartados: asignar Neutral (id=7)
    CASE
        WHEN revision_estado = 'descartado' THEN 7::SMALLINT
        ELSE revision_emocion_id
    END AS revision_emocion_id,
    CASE
        WHEN revision_estado = 'descartado' THEN 'Neutral'
        ELSE revision_emocion_nombre
    END AS revision_emocion_nombre,
    revision_estado,
    tema_nombre,
    categoria
FROM pseudo_labels_review
WHERE revision_estado IN ('confirmado', 'corregido', 'descartado')
ORDER BY id;

-- ─────────────────────────────────────────────────────────────
-- ESTADÍSTICAS (informativo, no exportar)
-- ─────────────────────────────────────────────────────────────
SELECT
    revision_estado,
    COUNT(*) AS total,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS porcentaje
FROM pseudo_labels_review
WHERE revision_estado != 'pendiente'
GROUP BY revision_estado
ORDER BY total DESC;

-- Distribución de emociones revisadas (para v3.2)
SELECT
    COALESCE(revision_emocion_nombre, pred_emocion_nombre) AS emocion,
    COUNT(*) AS total
FROM pseudo_labels_review
WHERE revision_estado IN ('confirmado', 'corregido')
GROUP BY emocion
ORDER BY total DESC;
