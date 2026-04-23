-- =====================================================================
--  Migración: LANZADAS (recorridos)
-- ---------------------------------------------------------------------
--  Cambio conceptual: las "posiciones de lanzamiento" ya no son por
--  misión individual, sino por LANZADA (recorrido que abarca 1..N
--  misiones). Un equipo configura sus lanzadas y arrastra las misiones
--  que quedan agrupadas dentro de cada una.
--
--  Beneficios:
--   - El análisis se hace por lanzada: puntos promedio y %
--     de efectividad — permite ajustar los recorridos que rinden poco.
--   - Se respetan las restricciones (una misión solo puede estar en una
--     lanzada por equipo).
--
--  Nota: la tabla `posiciones_mision` se mantiene por compatibilidad
--  pero deja de usarse en la UI.
-- =====================================================================

-- ---------- TABLA: lanzadas (una lanzada = un recorrido del equipo) --
create table if not exists public.lanzadas (
    id               uuid primary key default gen_random_uuid(),
    coach_id         uuid not null references auth.users(id) on delete cascade,
    equipo_id        uuid not null references public.equipos(id) on delete cascade,
    nombre           text not null,
    descripcion      text,
    -- Base de salida y posición de lanzamiento asociadas al recorrido
    base             text check (base in ('azul','roja')),
    orientacion      text check (orientacion in ('horizontal','vertical')),
    numero_posicion  integer,
    direccion        text check (direccion in ('izq_der','der_izq')),
    -- Tiempo planificado del recorrido (segundos), para comparar lanzadas
    tiempo_recorrido_seg integer check (tiempo_recorrido_seg is null or tiempo_recorrido_seg >= 0),
    orden            integer not null default 0,
    activa           boolean not null default true,
    creado_en        timestamptz not null default now(),
    actualizado_en   timestamptz not null default now(),
    constraint lanzadas_nombre_unico_por_equipo unique (equipo_id, nombre)
);
create index if not exists idx_lanzadas_equipo on public.lanzadas(equipo_id);
create index if not exists idx_lanzadas_coach  on public.lanzadas(coach_id);

-- ---------- TABLA: lanzadas_misiones (N:N con orden) -----------------
-- `equipo_id` se duplica para garantizar que una misión solo puede estar
-- en UNA lanzada por equipo (constraint unique(equipo_id, mision_id)).
create table if not exists public.lanzadas_misiones (
    lanzada_id  uuid not null references public.lanzadas(id)  on delete cascade,
    mision_id   uuid not null references public.misiones(id)  on delete restrict,
    equipo_id   uuid not null references public.equipos(id)   on delete cascade,
    orden       integer not null default 0,
    creado_en   timestamptz not null default now(),
    primary key (lanzada_id, mision_id),
    constraint lanmis_mision_unica_por_equipo unique (equipo_id, mision_id)
);
create index if not exists idx_lanmis_lanzada on public.lanzadas_misiones(lanzada_id);
create index if not exists idx_lanmis_mision  on public.lanzadas_misiones(mision_id);
create index if not exists idx_lanmis_equipo  on public.lanzadas_misiones(equipo_id);

-- =====================================================================
--  VISTA: efectividad por lanzada
--  Agrupa intentos / completadas / falladas de todas las misiones
--  asignadas a cada lanzada, dentro de las partidas finalizadas del
--  equipo dueño de la lanzada.
-- =====================================================================
create or replace view public.v_efectividad_lanzada
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

-- =====================================================================
--  RLS
-- =====================================================================
alter table public.lanzadas           enable row level security;
alter table public.lanzadas_misiones  enable row level security;

drop policy if exists "lanzadas_select_propios" on public.lanzadas;
create policy "lanzadas_select_propios" on public.lanzadas
    for select using (coach_id = auth.uid());

drop policy if exists "lanzadas_insert_propios" on public.lanzadas;
create policy "lanzadas_insert_propios" on public.lanzadas
    for insert with check (coach_id = auth.uid());

drop policy if exists "lanzadas_update_propios" on public.lanzadas;
create policy "lanzadas_update_propios" on public.lanzadas
    for update using (coach_id = auth.uid())
               with check (coach_id = auth.uid());

drop policy if exists "lanzadas_delete_propios" on public.lanzadas;
create policy "lanzadas_delete_propios" on public.lanzadas
    for delete using (coach_id = auth.uid());

-- lanzadas_misiones: la autorización se deriva de la lanzada padre.
drop policy if exists "lanmis_select_propios" on public.lanzadas_misiones;
create policy "lanmis_select_propios" on public.lanzadas_misiones
    for select using (
        exists (select 1 from public.lanzadas l
                where l.id = lanzadas_misiones.lanzada_id
                  and l.coach_id = auth.uid())
    );

drop policy if exists "lanmis_insert_propios" on public.lanzadas_misiones;
create policy "lanmis_insert_propios" on public.lanzadas_misiones
    for insert with check (
        exists (select 1 from public.lanzadas l
                where l.id = lanzadas_misiones.lanzada_id
                  and l.coach_id = auth.uid())
    );

drop policy if exists "lanmis_update_propios" on public.lanzadas_misiones;
create policy "lanmis_update_propios" on public.lanzadas_misiones
    for update using (
        exists (select 1 from public.lanzadas l
                where l.id = lanzadas_misiones.lanzada_id
                  and l.coach_id = auth.uid())
    ) with check (
        exists (select 1 from public.lanzadas l
                where l.id = lanzadas_misiones.lanzada_id
                  and l.coach_id = auth.uid())
    );

drop policy if exists "lanmis_delete_propios" on public.lanzadas_misiones;
create policy "lanmis_delete_propios" on public.lanzadas_misiones
    for delete using (
        exists (select 1 from public.lanzadas l
                where l.id = lanzadas_misiones.lanzada_id
                  and l.coach_id = auth.uid())
    );

-- Añadir al realtime publication.
do $$
begin
    execute 'alter publication supabase_realtime add table
        public.lanzadas, public.lanzadas_misiones';
exception when duplicate_object then null;
         when others then null;
end $$;
