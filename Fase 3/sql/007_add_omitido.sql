-- ============================================================
-- 007: Añadir estado "omitido"
-- ============================================================

-- 1. Actualizar el constraint de la columna para permitir 'omitido'
ALTER TABLE pseudo_labels_review DROP CONSTRAINT IF EXISTS pseudo_labels_review_revision_estado_check;
ALTER TABLE pseudo_labels_review ADD CONSTRAINT pseudo_labels_review_revision_estado_check CHECK (revision_estado IN ('pendiente', 'confirmado', 'corregido', 'descartado', 'omitido'));

-- 2. Recrear la función de estadísticas para incluir los omitidos
DROP FUNCTION IF EXISTS get_review_stats();

CREATE OR REPLACE FUNCTION get_review_stats()
RETURNS TABLE (
    total       BIGINT,
    pendientes  BIGINT,
    confirmados BIGINT,
    corregidos  BIGINT,
    descartados BIGINT,
    omitidos    BIGINT
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        COUNT(*)                                          AS total,
        COUNT(*) FILTER (WHERE revision_estado = 'pendiente')   AS pendientes,
        COUNT(*) FILTER (WHERE revision_estado = 'confirmado')  AS confirmados,
        COUNT(*) FILTER (WHERE revision_estado = 'corregido')   AS corregidos,
        COUNT(*) FILTER (WHERE revision_estado = 'descartado')  AS descartados,
        COUNT(*) FILTER (WHERE revision_estado = 'omitido')     AS omitidos
    FROM pseudo_labels_review;
$$;
