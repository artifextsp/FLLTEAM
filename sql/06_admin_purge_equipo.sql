-- =====================================================================
--  Purga de datos por equipo (solo administrador activo)
--  - Ranking / lanzamientos: elimina partidas completas (cascade).
--  - Análisis / efectividad misiones: elimina solo partidas_misiones.
-- =====================================================================

create or replace function public.admin_purgar_ranking_equipo(p_equipo_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_equipo_coach uuid;
    v_n int;
begin
    if not public.es_admin_actual() then
        raise exception 'Solo un administrador puede purgar datos de ranking';
    end if;
    if p_equipo_id is null then
        raise exception 'Equipo no indicado';
    end if;

    select e.coach_id into v_equipo_coach
    from public.equipos e
    where e.id = p_equipo_id;

    if v_equipo_coach is null then
        raise exception 'Equipo no encontrado';
    end if;
    if v_equipo_coach <> auth.uid() then
        raise exception 'No puedes purgar datos de equipos de otro coach';
    end if;

    delete from public.partidas
    where equipo_id = p_equipo_id
      and coach_id = auth.uid();

    get diagnostics v_n = row_count;
    return v_n;
end;
$$;

create or replace function public.admin_purgar_analisis_misiones_equipo(p_equipo_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_equipo_coach uuid;
    v_n int;
begin
    if not public.es_admin_actual() then
        raise exception 'Solo un administrador puede purgar datos de análisis';
    end if;
    if p_equipo_id is null then
        raise exception 'Equipo no indicado';
    end if;

    select e.coach_id into v_equipo_coach
    from public.equipos e
    where e.id = p_equipo_id;

    if v_equipo_coach is null then
        raise exception 'Equipo no encontrado';
    end if;
    if v_equipo_coach <> auth.uid() then
        raise exception 'No puedes purgar datos de equipos de otro coach';
    end if;

    delete from public.partidas_misiones pm
    using public.partidas p
    where pm.partida_id = p.id
      and p.equipo_id = p_equipo_id
      and p.coach_id = auth.uid();

    get diagnostics v_n = row_count;
    return v_n;
end;
$$;

grant execute on function public.admin_purgar_ranking_equipo(uuid) to authenticated;
grant execute on function public.admin_purgar_analisis_misiones_equipo(uuid) to authenticated;