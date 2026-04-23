-- =====================================================================
--  Migración incremental: tiempo planificado del recorrido (segundos)
--  Ejecutar en proyectos que ya tenían `lanzadas` sin esta columna.
-- =====================================================================

alter table public.lanzadas
    add column if not exists tiempo_recorrido_seg integer
    check (tiempo_recorrido_seg is null or tiempo_recorrido_seg >= 0);

drop view if exists public.v_efectividad_lanzada;

create view public.v_efectividad_lanzada
with (security_invoker = true) as
select
    l.id                                                    as lanzada_id,
    l.coach_id,
    l.equipo_id,
    l.nombre,
    l.base,
    l.tiempo_recorrido_seg,
    l.orientacion,
    l.numero_posicion,
    l.direccion,
    l.orden,
    count(distinct lm.mision_id)                            as misiones_asignadas,
    count(distinct pm.partida_id) filter (where pm.id is not null)
                                                            as partidas_registradas,
    count(pm.id)                                            as intentos_totales,
    count(pm.id) filter (where pm.completada)               as completadas,
    count(pm.id) filter (where pm.fallada)                  as falladas,
    case when count(pm.id) = 0 then 0
         else round(100.0 * count(pm.id) filter (where pm.completada)
                          / count(pm.id), 2)
    end                                                     as efectividad_pct,
    coalesce(sum(pm.puntaje), 0)                            as puntos_totales,
    case when count(distinct pm.partida_id) = 0 then 0
         else round(sum(pm.puntaje)::numeric
                  / count(distinct pm.partida_id), 2)
    end                                                     as promedio_puntos_por_partida
from      public.lanzadas           l
left join public.lanzadas_misiones  lm on lm.lanzada_id = l.id
left join public.partidas_misiones  pm on pm.mision_id  = lm.mision_id
left join public.partidas           p  on p.id = pm.partida_id
                                      and p.estado = 'finalizada'
                                      and p.equipo_id = l.equipo_id
group by l.id, l.coach_id, l.equipo_id, l.nombre, l.base, l.tiempo_recorrido_seg,
         l.orientacion, l.numero_posicion, l.direccion, l.orden;
