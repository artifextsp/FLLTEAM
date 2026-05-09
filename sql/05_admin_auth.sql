-- =====================================================================
--  Administración de usuarios (admin/coaches) para FLL Team
-- ---------------------------------------------------------------------
--  Incluye:
--   - Tabla de perfiles (rol, activo, flags)
--   - Trigger para crear perfil al registrarse en auth.users
--   - Funciones RPC para:
--       * crear usuario (solo admin)
--       * resetear contraseña (solo admin)
--       * cambiar contraseña propia
-- =====================================================================

create extension if not exists pgcrypto;

create table if not exists public.perfiles_usuario (
    user_id                 uuid primary key references auth.users(id) on delete cascade,
    email                   text not null unique,
    nombre                  text,
    rol                     text not null default 'coach'
                            check (rol in ('admin', 'coach')),
    activo                  boolean not null default true,
    debe_cambiar_password   boolean not null default false,
    creado_en               timestamptz not null default now(),
    actualizado_en          timestamptz not null default now()
);

create index if not exists idx_perfiles_rol on public.perfiles_usuario(rol);

create or replace function public.fn_touch_actualizado_en()
returns trigger
language plpgsql
as $$
begin
    new.actualizado_en = now();
    return new;
end;
$$;

drop trigger if exists trg_perfiles_touch_actualizado_en on public.perfiles_usuario;
create trigger trg_perfiles_touch_actualizado_en
before update on public.perfiles_usuario
for each row execute function public.fn_touch_actualizado_en();

create or replace function public.fn_crear_perfil_desde_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.perfiles_usuario (user_id, email, rol, activo, debe_cambiar_password)
    values (new.id, new.email, 'coach', true, false)
    on conflict (user_id) do update
    set email = excluded.email;
    return new;
end;
$$;

drop trigger if exists trg_auth_user_creado_perfil on auth.users;
create trigger trg_auth_user_creado_perfil
after insert on auth.users
for each row execute function public.fn_crear_perfil_desde_auth();

insert into public.perfiles_usuario (user_id, email, rol, activo, debe_cambiar_password)
select u.id, u.email, 'coach', true, false
from auth.users u
left join public.perfiles_usuario p on p.user_id = u.id
where p.user_id is null;

alter table public.perfiles_usuario enable row level security;

drop policy if exists "perfiles_select_propios_o_admin" on public.perfiles_usuario;
create policy "perfiles_select_propios_o_admin" on public.perfiles_usuario
for select to authenticated
using (
    user_id = auth.uid()
    or exists (
        select 1
        from public.perfiles_usuario p
        where p.user_id = auth.uid()
          and p.rol = 'admin'
          and p.activo = true
    )
);

drop policy if exists "perfiles_update_admin" on public.perfiles_usuario;
create policy "perfiles_update_admin" on public.perfiles_usuario
for update to authenticated
using (
    exists (
        select 1
        from public.perfiles_usuario p
        where p.user_id = auth.uid()
          and p.rol = 'admin'
          and p.activo = true
    )
)
with check (
    rol in ('admin', 'coach')
);

drop policy if exists "perfiles_insert_admin" on public.perfiles_usuario;
create policy "perfiles_insert_admin" on public.perfiles_usuario
for insert to authenticated
with check (
    exists (
        select 1
        from public.perfiles_usuario p
        where p.user_id = auth.uid()
          and p.rol = 'admin'
          and p.activo = true
    )
);

create or replace function public.es_admin_actual()
returns boolean
language sql
stable
as $$
    select exists (
        select 1
        from public.perfiles_usuario p
        where p.user_id = auth.uid()
          and p.rol = 'admin'
          and p.activo = true
    );
$$;

create or replace function public.admin_crear_usuario(
    p_email text,
    p_password text,
    p_nombre text default null,
    p_rol text default 'coach',
    p_activo boolean default true,
    p_debe_cambiar_password boolean default true
)
returns public.perfiles_usuario
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_admin boolean;
    v_user_id uuid;
    v_email_norm text;
    v_rol_norm text;
    v_perfil public.perfiles_usuario;
begin
    v_admin := public.es_admin_actual();
    if not v_admin then
        raise exception 'Solo un administrador puede crear usuarios';
    end if;

    v_email_norm := lower(trim(coalesce(p_email, '')));
    if v_email_norm = '' then
        raise exception 'El correo es obligatorio';
    end if;
    if position('@' in v_email_norm) = 0 then
        raise exception 'Correo inválido';
    end if;
    if length(coalesce(p_password, '')) < 6 then
        raise exception 'La contraseña temporal debe tener al menos 6 caracteres';
    end if;

    v_rol_norm := lower(coalesce(p_rol, 'coach'));
    if v_rol_norm not in ('admin', 'coach') then
        raise exception 'Rol inválido';
    end if;

    if exists (select 1 from auth.users u where lower(u.email) = v_email_norm) then
        raise exception 'Ya existe un usuario con ese correo';
    end if;

    insert into auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at
    ) values (
        gen_random_uuid(),
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        v_email_norm,
        crypt(p_password, gen_salt('bf')),
        now(),
        jsonb_build_object('provider', 'email', 'providers', array['email']),
        '{}'::jsonb,
        now(),
        now()
    )
    returning id into v_user_id;

    insert into auth.identities (
        provider_id,
        user_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at,
        id
    ) values (
        v_user_id::text,
        v_user_id,
        jsonb_build_object(
            'sub', v_user_id::text,
            'email', v_email_norm,
            'email_verified', true,
            'phone_verified', false
        ),
        'email',
        now(),
        now(),
        now(),
        gen_random_uuid()
    );

    update public.perfiles_usuario
    set nombre = nullif(trim(coalesce(p_nombre, '')), ''),
        rol = v_rol_norm,
        activo = p_activo,
        debe_cambiar_password = p_debe_cambiar_password,
        email = v_email_norm
    where user_id = v_user_id;

    select * into v_perfil
    from public.perfiles_usuario
    where user_id = v_user_id;

    return v_perfil;
end;
$$;

create or replace function public.admin_resetear_password(
    p_user_id uuid,
    p_password_nueva text,
    p_debe_cambiar_password boolean default true
)
returns public.perfiles_usuario
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_admin boolean;
    v_perfil public.perfiles_usuario;
begin
    v_admin := public.es_admin_actual();
    if not v_admin then
        raise exception 'Solo un administrador puede resetear contraseñas';
    end if;
    if p_user_id is null then
        raise exception 'Usuario inválido';
    end if;
    if length(coalesce(p_password_nueva, '')) < 6 then
        raise exception 'La nueva contraseña debe tener al menos 6 caracteres';
    end if;

    update auth.users
    set encrypted_password = crypt(p_password_nueva, gen_salt('bf')),
        updated_at = now()
    where id = p_user_id;

    if not found then
        raise exception 'Usuario no encontrado';
    end if;

    update public.perfiles_usuario
    set debe_cambiar_password = p_debe_cambiar_password
    where user_id = p_user_id;

    select * into v_perfil
    from public.perfiles_usuario
    where user_id = p_user_id;

    return v_perfil;
end;
$$;

create or replace function public.mi_perfil()
returns public.perfiles_usuario
language sql
stable
as $$
    select *
    from public.perfiles_usuario
    where user_id = auth.uid();
$$;

create or replace function public.marcar_password_cambiada()
returns public.perfiles_usuario
language plpgsql
security definer
set search_path = public
as $$
declare
    v_perfil public.perfiles_usuario;
begin
    update public.perfiles_usuario
    set debe_cambiar_password = false
    where user_id = auth.uid()
    returning * into v_perfil;

    if v_perfil.user_id is null then
        raise exception 'Perfil no encontrado para el usuario actual';
    end if;

    return v_perfil;
end;
$$;

grant execute on function public.es_admin_actual() to authenticated;
grant execute on function public.mi_perfil() to authenticated;
grant execute on function public.marcar_password_cambiada() to authenticated;
grant execute on function public.admin_crear_usuario(text, text, text, text, boolean, boolean) to authenticated;
grant execute on function public.admin_resetear_password(uuid, text, boolean) to authenticated;
