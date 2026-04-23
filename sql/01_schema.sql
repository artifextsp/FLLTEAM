-- =====================================================================
--  Sistema de Entrenamientos FLL - Esquema de Base de Datos (Supabase)
--  Temporada: UNEARTHED 2025-2026
-- ---------------------------------------------------------------------
--  Convenciones:
--   - Todas las tablas del esquema `public` tienen RLS habilitado.
--   - Cada fila guarda el `coach_id` (= auth.uid()) para aislar datos
--     entre coaches.
--   - `misiones` es una tabla GLOBAL (compartida por todos los coaches),
--     solo lectura desde la API. Se edita directamente en la DB.
-- =====================================================================

-- Extensiones necesarias
create extension if not exists "pgcrypto";

-- =====================================================================
--  1. EQUIPOS
-- =====================================================================
create table if not exists public.equipos (
    id          uuid primary key default gen_random_uuid(),
    coach_id    uuid not null references auth.users(id) on delete cascade,
    nombre      text not null,
    descripcion text,
    creado_en   timestamptz not null default now(),
    constraint equipos_nombre_unico_por_coach unique (coach_id, nombre)
);
create index if not exists idx_equipos_coach on public.equipos(coach_id);

-- =====================================================================
--  2. JUGADORES
-- =====================================================================
create table if not exists public.jugadores (
    id         uuid primary key default gen_random_uuid(),
    coach_id   uuid not null references auth.users(id) on delete cascade,
    equipo_id  uuid not null references public.equipos(id) on delete cascade,
    nombre     text not null,
    activo     boolean not null default true,
    creado_en  timestamptz not null default now(),
    constraint jugadores_nombre_unico_por_equipo unique (equipo_id, nombre)
);
create index if not exists idx_jugadores_coach  on public.jugadores(coach_id);
create index if not exists idx_jugadores_equipo on public.jugadores(equipo_id);

-- =====================================================================
--  3. MISIONES (globales - temporada UNEARTHED)
--     Editables SOLO desde la base de datos (RLS: solo SELECT via API)
-- =====================================================================
create table if not exists public.misiones (
    id              uuid primary key default gen_random_uuid(),
    codigo          text not null unique,          -- ej. 'M01', 'M02'
    nombre_es       text not null,
    descripcion     text,
    puntos_base     integer not null default 0,
    bonus           jsonb not null default '[]'::jsonb,
    -- bonus: arreglo de objetos {"codigo":"b1","nombre":"...","puntos":10}
    orden           integer not null default 0,
    temporada       text not null default 'UNEARTHED 2025-2026',
    activo          boolean not null default true,
    creado_en       timestamptz not null default now()
);
create index if not exists idx_misiones_orden on public.misiones(orden);

-- =====================================================================
--  4. POSICIONES DE LANZAMIENTO POR MISIÓN (por equipo)
-- =====================================================================
create table if not exists public.posiciones_mision (
    id          uuid primary key default gen_random_uuid(),
    coach_id    uuid not null references auth.users(id) on delete cascade,
    equipo_id   uuid not null references public.equipos(id)   on delete cascade,
    mision_id   uuid not null references public.misiones(id)  on delete cascade,
    orientacion text not null check (orientacion in ('horizontal','vertical')),
    numero      integer,                                         -- identificador libre
    direccion   text not null check (direccion in ('izq_der','der_izq')),
    actualizado_en timestamptz not null default now(),
    constraint posicion_unica_por_equipo_mision unique (equipo_id, mision_id)
);
create index if not exists idx_posiciones_equipo  on public.posiciones_mision(equipo_id);
create index if not exists idx_posiciones_mision  on public.posiciones_mision(mision_id);

-- =====================================================================
--  5. SESIONES DE ENTRENAMIENTO (jornadas)
-- =====================================================================
create table if not exists public.sesiones_entrenamiento (
    id         uuid primary key default gen_random_uuid(),
    coach_id   uuid not null references auth.users(id) on delete cascade,
    equipo_id  uuid not null references public.equipos(id) on delete cascade,
    fecha      date not null default current_date,
    notas      text,
    creado_en  timestamptz not null default now()
);
create index if not exists idx_sesiones_equipo on public.sesiones_entrenamiento(equipo_id);
create index if not exists idx_sesiones_fecha  on public.sesiones_entrenamiento(fecha);

-- =====================================================================
--  6. CUADRILLAS (grupo nombrado de 4 jugadores)
-- =====================================================================
create table if not exists public.cuadrillas (
    id           uuid primary key default gen_random_uuid(),
    coach_id     uuid not null references auth.users(id) on delete cascade,
    equipo_id    uuid not null references public.equipos(id) on delete cascade,
    nombre       text not null,
    jugador1_id  uuid not null references public.jugadores(id) on delete cascade,
    jugador2_id  uuid not null references public.jugadores(id) on delete cascade,
    jugador3_id  uuid not null references public.jugadores(id) on delete cascade,
    jugador4_id  uuid not null references public.jugadores(id) on delete cascade,
    creado_en    timestamptz not null default now(),
    constraint cuadrillas_nombre_unico_por_equipo unique (equipo_id, nombre)
);
create index if not exists idx_cuadrillas_equipo on public.cuadrillas(equipo_id);

-- =====================================================================
--  7. DUPLAS (grupo nombrado de 2 jugadores)
-- =====================================================================
create table if not exists public.duplas (
    id           uuid primary key default gen_random_uuid(),
    coach_id     uuid not null references auth.users(id) on delete cascade,
    equipo_id    uuid not null references public.equipos(id) on delete cascade,
    nombre       text not null,
    jugador_a_id uuid not null references public.jugadores(id) on delete cascade,
    jugador_b_id uuid not null references public.jugadores(id) on delete cascade,
    creado_en    timestamptz not null default now(),
    constraint duplas_nombre_unico_por_equipo unique (equipo_id, nombre)
);
create index if not exists idx_duplas_equipo on public.duplas(equipo_id);

-- =====================================================================
--  8. PARTIDAS (un lanzamiento de 2:30)
-- =====================================================================
create table if not exists public.partidas (
    id                uuid primary key default gen_random_uuid(),
    coach_id          uuid not null references auth.users(id) on delete cascade,
    equipo_id         uuid not null references public.equipos(id) on delete cascade,
    sesion_id         uuid references public.sesiones_entrenamiento(id) on delete set null,
    cuadrilla_id      uuid references public.cuadrillas(id) on delete set null,
    dupla_azul_id     uuid references public.duplas(id)     on delete set null,
    dupla_roja_id     uuid references public.duplas(id)     on delete set null,
    cuadrilla_nombre  text,   -- nombre libre al vuelo (si no hay cuadrilla_id)
    dupla_azul_nombre text,
    dupla_roja_nombre text,
    fecha_hora        timestamptz not null default now(),
    duracion_segundos integer not null default 150,
    puntaje_total     integer not null default 0,
    estado            text not null default 'finalizada'
                      check (estado in ('finalizada','descartada')),
    notas             text,
    creado_en         timestamptz not null default now()
);
create index if not exists idx_partidas_coach      on public.partidas(coach_id);
create index if not exists idx_partidas_equipo     on public.partidas(equipo_id);
create index if not exists idx_partidas_sesion     on public.partidas(sesion_id);
create index if not exists idx_partidas_fecha_hora on public.partidas(fecha_hora desc);

-- =====================================================================
--  9. PARTIDAS_JUGADORES (4 filas por partida: 2 azul + 2 roja)
-- =====================================================================
create table if not exists public.partidas_jugadores (
    id                 uuid primary key default gen_random_uuid(),
    partida_id         uuid not null references public.partidas(id)  on delete cascade,
    jugador_id         uuid not null references public.jugadores(id) on delete cascade,
    base               text not null check (base in ('azul','roja')),
    companero_id       uuid references public.jugadores(id) on delete set null,
    puntaje_individual integer not null default 0,
    creado_en          timestamptz not null default now(),
    constraint partidas_jugador_unico unique (partida_id, jugador_id)
);
create index if not exists idx_partidas_jug_partida on public.partidas_jugadores(partida_id);
create index if not exists idx_partidas_jug_jugador on public.partidas_jugadores(jugador_id);
create index if not exists idx_partidas_jug_base    on public.partidas_jugadores(base);

-- =====================================================================
-- 10. PARTIDAS_MISIONES (registro por misión tocada)
-- =====================================================================
create table if not exists public.partidas_misiones (
    id               uuid primary key default gen_random_uuid(),
    partida_id       uuid not null references public.partidas(id) on delete cascade,
    mision_id        uuid not null references public.misiones(id) on delete restrict,
    completada       boolean not null default false,
    fallada          boolean not null default false,
    bonus_obtenidos  jsonb   not null default '[]'::jsonb,  -- ['b1','b2']
    puntaje          integer not null default 0,
    creado_en        timestamptz not null default now(),
    constraint partidas_mision_unica unique (partida_id, mision_id)
);
create index if not exists idx_partidas_mis_partida on public.partidas_misiones(partida_id);
create index if not exists idx_partidas_mis_mision  on public.partidas_misiones(mision_id);

-- =====================================================================
--  VISTAS DE ESTADÍSTICAS
--  NOTA: security_invoker = true hace que la vista respete la RLS del
--  usuario que consulta (necesario en Postgres 15+).
-- =====================================================================

-- Estadísticas acumuladas por jugador
create or replace view public.v_estadisticas_jugador
with (security_invoker = true) as
select
    j.id                                             as jugador_id,
    j.coach_id,
    j.equipo_id,
    j.nombre,
    count(pj.id)                                     as lanzamientos_totales,
    coalesce(sum(pj.puntaje_individual), 0)          as puntos_totales,
    round(coalesce(avg(pj.puntaje_individual), 0)::numeric, 2) as promedio,
    coalesce(sum(pj.puntaje_individual)
             filter (where pj.base = 'azul'), 0)     as puntos_base_azul,
    coalesce(sum(pj.puntaje_individual)
             filter (where pj.base = 'roja'), 0)     as puntos_base_roja,
    count(pj.id) filter (where pj.base = 'azul')     as lanzamientos_azul,
    count(pj.id) filter (where pj.base = 'roja')     as lanzamientos_roja
from public.jugadores j
left join public.partidas_jugadores pj on pj.jugador_id = j.id
left join public.partidas p on p.id = pj.partida_id and p.estado = 'finalizada'
group by j.id, j.coach_id, j.equipo_id, j.nombre;

-- Efectividad por misión
create or replace view public.v_efectividad_mision
with (security_invoker = true) as
select
    m.id                                           as mision_id,
    m.codigo,
    m.nombre_es,
    p.coach_id,
    count(pm.id)                                   as veces_intentada,
    count(pm.id) filter (where pm.completada)      as veces_completada,
    count(pm.id) filter (where pm.fallada)         as veces_fallada,
    case when count(pm.id) = 0 then 0
         else round(100.0 * count(pm.id) filter (where pm.completada)
                          / count(pm.id), 2)
    end                                            as efectividad_pct
from public.misiones m
left join public.partidas_misiones pm on pm.mision_id = m.id
left join public.partidas p on p.id = pm.partida_id and p.estado = 'finalizada'
group by m.id, m.codigo, m.nombre_es, p.coach_id;

-- =====================================================================
--  HABILITAR RLS
-- =====================================================================
alter table public.equipos                enable row level security;
alter table public.jugadores              enable row level security;
alter table public.misiones               enable row level security;
alter table public.posiciones_mision      enable row level security;
alter table public.sesiones_entrenamiento enable row level security;
alter table public.cuadrillas             enable row level security;
alter table public.duplas                 enable row level security;
alter table public.partidas               enable row level security;
alter table public.partidas_jugadores     enable row level security;
alter table public.partidas_misiones      enable row level security;

-- =====================================================================
--  POLÍTICAS RLS
--  Patrón general: el coach autenticado solo ve/escribe filas con
--  coach_id = auth.uid().
-- =====================================================================

-- ---------- EQUIPOS ----------
drop policy if exists "equipos_select_propios" on public.equipos;
create policy "equipos_select_propios" on public.equipos
    for select using (coach_id = auth.uid());

drop policy if exists "equipos_insert_propios" on public.equipos;
create policy "equipos_insert_propios" on public.equipos
    for insert with check (coach_id = auth.uid());

drop policy if exists "equipos_update_propios" on public.equipos;
create policy "equipos_update_propios" on public.equipos
    for update using (coach_id = auth.uid())
               with check (coach_id = auth.uid());

drop policy if exists "equipos_delete_propios" on public.equipos;
create policy "equipos_delete_propios" on public.equipos
    for delete using (coach_id = auth.uid());

-- ---------- JUGADORES ----------
drop policy if exists "jugadores_select_propios" on public.jugadores;
create policy "jugadores_select_propios" on public.jugadores
    for select using (coach_id = auth.uid());

drop policy if exists "jugadores_insert_propios" on public.jugadores;
create policy "jugadores_insert_propios" on public.jugadores
    for insert with check (coach_id = auth.uid());

drop policy if exists "jugadores_update_propios" on public.jugadores;
create policy "jugadores_update_propios" on public.jugadores
    for update using (coach_id = auth.uid())
               with check (coach_id = auth.uid());

drop policy if exists "jugadores_delete_propios" on public.jugadores;
create policy "jugadores_delete_propios" on public.jugadores
    for delete using (coach_id = auth.uid());

-- ---------- MISIONES (globales: cualquier coach autenticado puede leer,
--                      solo editables directamente en la DB) ----------
drop policy if exists "misiones_select_publico" on public.misiones;
create policy "misiones_select_publico" on public.misiones
    for select to authenticated using (true);

-- Sin políticas INSERT/UPDATE/DELETE: así la API REST no puede modificar
-- las misiones. Los administradores las editan desde el panel de Supabase
-- o vía SQL directo (service_role).

-- ---------- POSICIONES_MISION ----------
drop policy if exists "pos_select_propios" on public.posiciones_mision;
create policy "pos_select_propios" on public.posiciones_mision
    for select using (coach_id = auth.uid());

drop policy if exists "pos_insert_propios" on public.posiciones_mision;
create policy "pos_insert_propios" on public.posiciones_mision
    for insert with check (coach_id = auth.uid());

drop policy if exists "pos_update_propios" on public.posiciones_mision;
create policy "pos_update_propios" on public.posiciones_mision
    for update using (coach_id = auth.uid())
               with check (coach_id = auth.uid());

drop policy if exists "pos_delete_propios" on public.posiciones_mision;
create policy "pos_delete_propios" on public.posiciones_mision
    for delete using (coach_id = auth.uid());

-- ---------- SESIONES ENTRENAMIENTO ----------
drop policy if exists "sesiones_select_propios" on public.sesiones_entrenamiento;
create policy "sesiones_select_propios" on public.sesiones_entrenamiento
    for select using (coach_id = auth.uid());

drop policy if exists "sesiones_insert_propios" on public.sesiones_entrenamiento;
create policy "sesiones_insert_propios" on public.sesiones_entrenamiento
    for insert with check (coach_id = auth.uid());

drop policy if exists "sesiones_update_propios" on public.sesiones_entrenamiento;
create policy "sesiones_update_propios" on public.sesiones_entrenamiento
    for update using (coach_id = auth.uid())
               with check (coach_id = auth.uid());

drop policy if exists "sesiones_delete_propios" on public.sesiones_entrenamiento;
create policy "sesiones_delete_propios" on public.sesiones_entrenamiento
    for delete using (coach_id = auth.uid());

-- ---------- CUADRILLAS ----------
drop policy if exists "cuadrillas_select_propios" on public.cuadrillas;
create policy "cuadrillas_select_propios" on public.cuadrillas
    for select using (coach_id = auth.uid());

drop policy if exists "cuadrillas_insert_propios" on public.cuadrillas;
create policy "cuadrillas_insert_propios" on public.cuadrillas
    for insert with check (coach_id = auth.uid());

drop policy if exists "cuadrillas_update_propios" on public.cuadrillas;
create policy "cuadrillas_update_propios" on public.cuadrillas
    for update using (coach_id = auth.uid())
               with check (coach_id = auth.uid());

drop policy if exists "cuadrillas_delete_propios" on public.cuadrillas;
create policy "cuadrillas_delete_propios" on public.cuadrillas
    for delete using (coach_id = auth.uid());

-- ---------- DUPLAS ----------
drop policy if exists "duplas_select_propios" on public.duplas;
create policy "duplas_select_propios" on public.duplas
    for select using (coach_id = auth.uid());

drop policy if exists "duplas_insert_propios" on public.duplas;
create policy "duplas_insert_propios" on public.duplas
    for insert with check (coach_id = auth.uid());

drop policy if exists "duplas_update_propios" on public.duplas;
create policy "duplas_update_propios" on public.duplas
    for update using (coach_id = auth.uid())
               with check (coach_id = auth.uid());

drop policy if exists "duplas_delete_propios" on public.duplas;
create policy "duplas_delete_propios" on public.duplas
    for delete using (coach_id = auth.uid());

-- ---------- PARTIDAS ----------
drop policy if exists "partidas_select_propios" on public.partidas;
create policy "partidas_select_propios" on public.partidas
    for select using (coach_id = auth.uid());

drop policy if exists "partidas_insert_propios" on public.partidas;
create policy "partidas_insert_propios" on public.partidas
    for insert with check (coach_id = auth.uid());

drop policy if exists "partidas_update_propios" on public.partidas;
create policy "partidas_update_propios" on public.partidas
    for update using (coach_id = auth.uid())
               with check (coach_id = auth.uid());

drop policy if exists "partidas_delete_propios" on public.partidas;
create policy "partidas_delete_propios" on public.partidas
    for delete using (coach_id = auth.uid());

-- ---------- PARTIDAS_JUGADORES (se valida via partida padre) ----------
drop policy if exists "pj_select_propios" on public.partidas_jugadores;
create policy "pj_select_propios" on public.partidas_jugadores
    for select using (
        exists (select 1 from public.partidas p
                where p.id = partidas_jugadores.partida_id
                  and p.coach_id = auth.uid())
    );

drop policy if exists "pj_insert_propios" on public.partidas_jugadores;
create policy "pj_insert_propios" on public.partidas_jugadores
    for insert with check (
        exists (select 1 from public.partidas p
                where p.id = partidas_jugadores.partida_id
                  and p.coach_id = auth.uid())
    );

drop policy if exists "pj_update_propios" on public.partidas_jugadores;
create policy "pj_update_propios" on public.partidas_jugadores
    for update using (
        exists (select 1 from public.partidas p
                where p.id = partidas_jugadores.partida_id
                  and p.coach_id = auth.uid())
    ) with check (
        exists (select 1 from public.partidas p
                where p.id = partidas_jugadores.partida_id
                  and p.coach_id = auth.uid())
    );

drop policy if exists "pj_delete_propios" on public.partidas_jugadores;
create policy "pj_delete_propios" on public.partidas_jugadores
    for delete using (
        exists (select 1 from public.partidas p
                where p.id = partidas_jugadores.partida_id
                  and p.coach_id = auth.uid())
    );

-- ---------- PARTIDAS_MISIONES ----------
drop policy if exists "pm_select_propios" on public.partidas_misiones;
create policy "pm_select_propios" on public.partidas_misiones
    for select using (
        exists (select 1 from public.partidas p
                where p.id = partidas_misiones.partida_id
                  and p.coach_id = auth.uid())
    );

drop policy if exists "pm_insert_propios" on public.partidas_misiones;
create policy "pm_insert_propios" on public.partidas_misiones
    for insert with check (
        exists (select 1 from public.partidas p
                where p.id = partidas_misiones.partida_id
                  and p.coach_id = auth.uid())
    );

drop policy if exists "pm_update_propios" on public.partidas_misiones;
create policy "pm_update_propios" on public.partidas_misiones
    for update using (
        exists (select 1 from public.partidas p
                where p.id = partidas_misiones.partida_id
                  and p.coach_id = auth.uid())
    ) with check (
        exists (select 1 from public.partidas p
                where p.id = partidas_misiones.partida_id
                  and p.coach_id = auth.uid())
    );

drop policy if exists "pm_delete_propios" on public.partidas_misiones;
create policy "pm_delete_propios" on public.partidas_misiones
    for delete using (
        exists (select 1 from public.partidas p
                where p.id = partidas_misiones.partida_id
                  and p.coach_id = auth.uid())
    );

-- =====================================================================
--  PUBLICACIÓN REALTIME (para sincronización en tiempo real)
-- =====================================================================
-- Añade las tablas al canal de realtime de Supabase.
-- (Si ya existe la publicación, se ignora el error.)
do $$
begin
    execute 'alter publication supabase_realtime add table
        public.equipos, public.jugadores, public.misiones,
        public.posiciones_mision, public.sesiones_entrenamiento,
        public.cuadrillas, public.duplas, public.partidas,
        public.partidas_jugadores, public.partidas_misiones';
exception when duplicate_object then null;
         when others then null;
end $$;
