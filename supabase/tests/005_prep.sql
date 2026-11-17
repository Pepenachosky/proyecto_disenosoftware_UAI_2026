-- Prepara el estado real de public.profiles en Supabase (consultado el
-- 2026-11-16) sobre el stub de la 002, para probar la migración 005 contra
-- lo mismo que encontrará en producción.

alter table auth.users add column if not exists email text;

-- language tiene default 'es'.
alter table public.profiles alter column language set default 'es';

-- Permisos por defecto de Supabase: todo para anon y authenticated.
grant all on public.profiles to anon, authenticated;

-- Políticas reales (rol public, sin "to").
drop policy if exists profiles_read_own on public.profiles;
create policy "perfil propio: leer" on public.profiles
  for select using (id = auth.uid());
create policy "perfil propio: editar" on public.profiles
  for update using (id = auth.uid());

-- Trigger real: crea el perfil sin language (lo pone el default).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Usuarios de las pruebas de la 005 (distintos de los de la 002).
-- Usuario A: 00000000-0000-0000-0000-0000000000a1
-- Usuario B: 00000000-0000-0000-0000-0000000000b2
insert into auth.users (id, raw_user_meta_data, email) values
  ('00000000-0000-0000-0000-0000000000a1', '{"full_name":"Ana 005"}', 'a@example.com'),
  ('00000000-0000-0000-0000-0000000000b2', '{}', 'b@example.com');
