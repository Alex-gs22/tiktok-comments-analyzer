-- ============================================================================
-- 002_exportar_corpus_etiquetado_unificado.sql
-- Exporta los ~3K comentarios ya etiquetados del corpus original + 
-- corpus_training, unificados en un solo formato.
--
-- Ejecutar en Supabase SQL Editor y exportar resultado como CSV.
-- ============================================================================

-- Corpus original etiquetado (las tablas corpus + temas del esquema original)
SELECT
    c.id                     AS corpus_id,
    c.id_comment,
    c.video_id,
    c.texto_raw,
    c.texto_limpio,
    COALESCE(c.texto_limpio, c.texto_raw) AS texto_modelo,
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
    c.id_tema,
    t.nombre                 AS tema_nombre,
    t.descripcion            AS tema_descripcion,
    t.categoria,
    t.emociones_esperadas::text,
    c.likes,
    c.fecha,
    'corpus'                 AS origen
FROM
    public.corpus c
INNER JOIN
    public.emociones e ON c.id_emocion = e.id
LEFT JOIN
    public.temas t ON c.id_tema = t.id
WHERE
    c.id_emocion IS NOT NULL

UNION ALL

-- Corpus de training etiquetado (corpus_training + temas_training)
SELECT
    ct.id                    AS corpus_id,
    ct.id_comment,
    ct.video_id,
    ct.texto_raw,
    ct.texto_limpio,
    COALESCE(ct.texto_limpio, ct.texto_raw) AS texto_modelo,
    ct.id_emocion,
    e.nombre                 AS emocion_nombre,
    e.intensidad_min,
    e.intensidad_max,
    ct.intensidad,
    CASE
        WHEN ct.intensidad = 1 THEN e.intensidad_min
        WHEN ct.intensidad = 4 THEN e.intensidad_max
        WHEN ct.intensidad IS NOT NULL THEN e.nombre
        ELSE NULL
    END                      AS intensidad_nombre,
    ct.id_tema,
    tt.nombre                AS tema_nombre,
    tt.descripcion           AS tema_descripcion,
    tt.categoria,
    tt.emociones_esperadas::text,
    ct.likes,
    ct.fecha,
    'corpus_training'        AS origen
FROM
    public.corpus_training ct
INNER JOIN
    public.emociones e ON ct.id_emocion = e.id
LEFT JOIN
    public.temas_training tt ON ct.id_tema = tt.id
WHERE
    ct.id_emocion IS NOT NULL

ORDER BY
    origen, corpus_id;
