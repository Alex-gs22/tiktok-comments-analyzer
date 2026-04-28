-- ============================================================
-- 010 — Fix: Timeline usa fecha del comentario, no de análisis
-- ============================================================
-- La vista v_timeline_semanal usaba `created_at` (fecha del análisis)
-- en vez de `fecha_comentario` (fecha real del comentario en TikTok).
--
-- Se recrea la vista usando COALESCE(fecha_comentario, created_at)
-- para que la timeline refleje CUÁNDO se publicó el comentario,
-- no cuándo se procesó. Si no hay fecha_comentario (ej. análisis
-- individual), se usa created_at como fallback.
-- ============================================================

-- Índice para queries por fecha_comentario
create index if not exists idx_pred_fecha_comentario
    on public.predicciones (fecha_comentario);

-- Recrear la vista con la fecha correcta
create or replace view public.v_timeline_semanal as
select
    date_trunc('week', coalesce(fecha_comentario, created_at))::date  as semana,
    emocion_predicha,
    count(*)::int                                                      as total
from public.predicciones
where not es_incierto
group by 1, 2
order by semana, total desc;
