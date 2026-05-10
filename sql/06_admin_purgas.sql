-- =====================================================================
--  Funciones RPC para que un administrador purgue datos de un equipo
-- ---------------------------------------------------------------------
--  Dos acciones independientes:
--    * admin_purgar_ranking_equipo(equipo_id):
--        elimina TODAS las partidas del equipo (cabecera + jugadores +
--        misiones por cascada). Deja rankings y análisis vacíos.
--
--    * admin_purgar_analisis_misiones_equipo(equipo_id):
--        elimina solo las filas de partidas_misiones (efectividad por
--        misión). Las partidas y sus puntajes por jugador se conservan,
--        de forma que los rankings sigan funcionando.
--
--  Reglas de seguridad:
--    - Solo el rol 'admin' activo puede ejecutarlas.
--    - Adicionalmente se exige que el equipo pertenezca al coach
--      autenticado (no se purgan equipos de otros coaches).
--
--  Devuelve el número de filas afectadas.
-- =====================================================================

create or replace function public.admin_purgar_ranking_equipo(
    p_equipo_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_equipo_coach uuid;
    v_borradas     integer;
begin
    if not public.es_admin_actual() then
        raise exception 'Solo un administrador puede purgar datos del equipo';
    end if;
    if p_equipo_id is null then
        raise exception 'equipo_id es obligatorio';
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
      and coach_id  = auth.uid();

    get diagnostics v_borradas = row_count;
    return v_borradas;
end;
$$;

create or replace function public.admin_purgar_analisis_misiones_equipo(
    p_equipo_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_equipo_coach uuid;
    v_borradas     integer;
begin
    if not public.es_admin_actual() then
        raise exception 'Solo un administrador puede purgar datos del equipo';
    end if;
    if p_equipo_id is null then
        raise exception 'equipo_id es obligatorio';
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
      and p.equipo_id   = p_equipo_id
      and p.coach_id    = auth.uid();

    get diagnostics v_borradas = row_count;
    return v_borradas;
end;
$$;

grant execute on function public.admin_purgar_ranking_equipo(uuid) to authenticated;
grant execute on function public.admin_purgar_analisis_misiones_equipo(uuid) to authenticated;
