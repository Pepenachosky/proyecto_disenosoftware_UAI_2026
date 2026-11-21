-- Migración 005: idioma del perfil (profiles.language) editable por cada
-- usuario, solo en su propia fila.
-- Se ejecuta a mano en el SQL Editor de Supabase y puede ejecutarse dos veces
-- seguidas sin error ni pérdida de datos. Explicación en docs/migracion-005.md.

begin;

-- En la base real language es NOT NULL; null significa "todavía no eligió".
-- Quitarlo es idempotente.
-- Debe ir antes del bloque siguiente, que pone language en null.
alter table public.profiles alter column language drop not null;

-- Quita el default 'es' y deja en null los idiomas existentes, pero solo la
-- primera vez: si el default ya no existe, hay elecciones reales que no se
-- deben borrar.
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'profiles'
               and column_name = 'language' and column_default is not null) then
    update public.profiles set language = null;
    alter table public.profiles alter column language drop default;
  end if;
end $$;

-- language solo admite 'es', 'en' o null.
-- null pasa el check (la comparación da desconocido). Va en un DO porque add
-- constraint no admite "if not exists". Un idioma nuevo exige una migración
-- que amplíe este check.
do $$ begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.profiles'::regclass
                   and conname = 'profiles_language_check') then
    alter table public.profiles
      add constraint profiles_language_check check (language in ('es', 'en'));
  end if;
end $$;

-- Permisos: authenticated solo lee y cambia la columna language.
-- anon no tiene acceso. El trigger de registro es security definer.
-- revoke all primero quita los grants por defecto de Supabase (anon y
-- authenticated tenían todo). El update por columna impide tocar display_name e id.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (language) on public.profiles to authenticated;

-- Políticas: se reemplaza la de edición por una limitada al propio usuario.
-- "perfil propio: leer" no se toca.
drop policy if exists "perfil propio: editar" on public.profiles;
drop policy if exists profiles_update_own_language on public.profiles;
-- using: solo la fila propia es visible para editar; with check: la fila
-- resultante debe seguir siendo propia (redundante con el grant por columna,
-- pero deja explícito el invariante).
create policy profiles_update_own_language on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

commit;
