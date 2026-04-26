-- ============================================================
-- 006: Fix – Eliminar overloads antiguos que causan conflicto
-- ============================================================
-- PostgreSQL mantiene AMBAS firmas si los parámetros difieren.
-- Supabase PostgREST puede resolver a la versión sin locks.
-- ============================================================

-- 1. Eliminar las versiones antiguas (sin session_id)
DROP FUNCTION IF EXISTS get_next_review(INTEGER);
DROP FUNCTION IF EXISTS save_review(INTEGER, SMALLINT, TEXT);

-- 2. Verificar que solo quedan las versiones nuevas
-- (esto debería devolver exactamente 2 filas: get_next_review y save_review)
SELECT p.proname, pg_get_function_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('get_next_review', 'save_review')
ORDER BY p.proname;
