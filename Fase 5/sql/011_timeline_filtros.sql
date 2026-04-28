-- ============================================================
-- 011 — Vista timeline mensual + vista con id_video para filtros
-- ============================================================
-- Agrega una vista mensual y una vista con id_video para
-- permitir filtrado por tema en el frontend.
-- ============================================================

-- Vista: Timeline mensual
create or replace view public.v_timeline_mensual as
select
    date_trunc('month', coalesce(fecha_comentario, created_at))::date  as mes,
    emocion_predicha,
    count(*)::int                                                       as total
from public.predicciones
where not es_incierto
group by 1, 2
order by mes, total desc;

-- Vista: Timeline semanal con id_video (para filtrar por tema)
create or replace view public.v_timeline_semanal_detalle as
select
    date_trunc('week', coalesce(fecha_comentario, created_at))::date   as semana,
    emocion_predicha,
    id_video,
    count(*)::int                                                       as total
from public.predicciones
where not es_incierto
group by 1, 2, 3
order by semana, total desc;

-- Vista: Timeline mensual con id_video (para filtrar por tema)
create or replace view public.v_timeline_mensual_detalle as
select
    date_trunc('month', coalesce(fecha_comentario, created_at))::date  as mes,
    emocion_predicha,
    id_video,
    count(*)::int                                                       as total
from public.predicciones
where not es_incierto
group by 1, 2, 3
order by mes, total desc;
