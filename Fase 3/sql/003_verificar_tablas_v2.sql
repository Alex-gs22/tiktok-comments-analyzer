-- ============================================================================
-- 003_verificar_tablas_v2.sql
-- Consultas de diagnóstico para entender la estructura de corpus_v2 y temas_v2
-- antes de exportar. Ejecutar cada bloque por separado.
-- ============================================================================

-- 1. Ver estructura de temas_v2
SELECT * FROM public.temas_v2 ORDER BY id;

-- 2. Contar comentarios por tema en corpus_v2
SELECT
    t.id,
    t.nombre AS tema,
    t.categoria,
    COUNT(c.id) AS total_comentarios,
    COUNT(c.id_emocion) AS ya_etiquetados,
    COUNT(c.id) - COUNT(c.id_emocion) AS sin_etiquetar
FROM
    public.temas_v2 t
LEFT JOIN
    public.corpus_v2 c ON c.id_tema = t.id
GROUP BY
    t.id, t.nombre, t.categoria
ORDER BY
    total_comentarios DESC;

-- 3. Total general
SELECT
    COUNT(*) AS total,
    COUNT(id_emocion) AS etiquetados,
    COUNT(*) - COUNT(id_emocion) AS sin_etiquetar
FROM
    public.corpus_v2;

-- 4. Ver columnas de corpus_v2 (para confirmar esquema)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'corpus_v2'
ORDER BY ordinal_position;

-- 5. Ver columnas de temas_v2 (para confirmar esquema)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'temas_v2'
ORDER BY ordinal_position;
