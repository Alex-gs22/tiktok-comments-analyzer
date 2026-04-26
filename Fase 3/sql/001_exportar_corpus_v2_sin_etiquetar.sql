-- ============================================================================
-- 001_exportar_corpus_v2_sin_etiquetar.sql
-- Exporta los ~10K comentarios sin etiquetar de corpus_v2 + temas_v2
-- 
-- Ejecutar en Supabase SQL Editor y exportar resultado como CSV.
-- ============================================================================

-- Vista para exportar el corpus v2 sin etiquetar con su info de tema.
-- Misma estructura de columnas que dataset_emociones_v2.0.csv para
-- que sea compatible con el pipeline existente.

SELECT
    c.id                     AS corpus_id,
    c.id_comment,
    c.video_id,
    c.texto_raw,
    c.texto_limpio,
    -- texto_modelo: usar texto_limpio si existe, sino texto_raw
    COALESCE(c.texto_limpio, c.texto_raw) AS texto_modelo,
    -- Campos de emoción vacíos (sin etiquetar)
    c.id_emocion,
    e.nombre                 AS emocion_nombre,
    e.intensidad_min,
    e.intensidad_max,
    c.intensidad,
    CASE
        WHEN c.intensidad = 1 THEN e.intensidad_min
        WHEN c.intensidad = 4 THEN e.intensidad_max
        WHEN c.intensidad IS NOT NULL THEN e.nombre
        ELSE NULL
    END                      AS intensidad_nombre,
    -- Info del tema
    c.id_tema,
    t.nombre                 AS tema_nombre,
    t.descripcion            AS tema_descripcion,
    t.categoria,
    t.emociones_esperadas::text,
    -- Metadata
    c.likes,
    c.fecha
FROM
    public.corpus_v2 c
LEFT JOIN
    public.temas_v2 t ON c.id_tema = t.id
LEFT JOIN
    public.emociones e ON c.id_emocion = e.id
ORDER BY
    c.id_tema, c.fecha, c.id;
