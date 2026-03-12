-- Ejecutar en Supabase SQL Editor
-- Función que devuelve comentarios pendientes en orden aleatorio desde el servidor
CREATE OR REPLACE FUNCTION get_random_pending(cantidad int DEFAULT 1)
RETURNS SETOF corpus_training
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM corpus_training
  WHERE id_emocion IS NULL
  ORDER BY random()
  LIMIT cantidad;
$$;
