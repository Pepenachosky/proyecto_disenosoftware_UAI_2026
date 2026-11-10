-- Migración 002: grupos de productos, reseñas por grupo y productos guardados.
-- Se ejecuta a mano en el SQL Editor de Supabase y puede ejecutarse dos veces
-- seguidas sin error. Explicación en docs/migracion-002.md.

begin;

-- 1. Grupos de productos (un producto "único" entre tiendas).
create table if not exists public.product_groups (
  id bigint generated always as identity primary key,
  slug text unique not null,
  name text not null,
  category text not null check (category in ('cpu', 'gpu', 'ram')),
  image_url text,
  created_at timestamptz default now()
);

-- 2. Cada fila de tienda apunta a su grupo; group_locked protege las
--    correcciones manuales del agrupado automático.
alter table public.products add column if not exists group_id bigint;
alter table public.products add column if not exists group_locked boolean not null default false;
alter table public.products drop constraint if exists products_group_id_fkey;
alter table public.products add constraint products_group_id_fkey
  foreign key (group_id) references public.product_groups (id) on delete set null;
create index if not exists products_group_id_idx on public.products (group_id);

-- 3. Reseñas: se borran todas las políticas existentes (no se conocen sus
--    nombres) para que ninguna vieja deje el acceso abierto.
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='product_reviews' loop
    execute format('drop policy %I on public.product_reviews', p.policyname);
  end loop; end $$;

-- La tabla está vacía: product_id se reemplaza por group_id.
alter table public.product_reviews drop column if exists product_id cascade;
alter table public.product_reviews add column if not exists group_id bigint;
alter table public.product_reviews add column if not exists author_name text not null default '';
alter table public.product_reviews add column if not exists updated_at timestamptz default now();

alter table public.product_reviews alter column group_id set not null;
alter table public.product_reviews drop constraint if exists product_reviews_group_id_fkey;
alter table public.product_reviews add constraint product_reviews_group_id_fkey
  foreign key (group_id) references public.product_groups (id) on delete cascade;

alter table public.product_reviews alter column user_id set default auth.uid();
alter table public.product_reviews alter column user_id set not null;
alter table public.product_reviews drop constraint if exists product_reviews_user_id_fkey;
alter table public.product_reviews add constraint product_reviews_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;

alter table public.product_reviews alter column rating set not null;
alter table public.product_reviews drop constraint if exists product_reviews_rating_check;
alter table public.product_reviews add constraint product_reviews_rating_check
  check (rating between 1 and 5);

alter table public.product_reviews alter column comment set default '';
alter table public.product_reviews alter column comment set not null;
alter table public.product_reviews alter column created_at set default now();

-- Una reseña por usuario y grupo.
create unique index if not exists product_reviews_user_group_key
  on public.product_reviews (user_id, group_id);

-- Trigger: user_id, updated_at y author_name los pone la base, no el cliente.
-- El nombre sale de auth.identities (Google primero, cualquier proveedor como
-- respaldo), no de raw_user_meta_data, que el usuario puede editar.
create or replace function public.product_reviews_set_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  -- Sin sesión (script con clave secreta) se mantiene el user_id recibido.
  new.user_id := coalesce(auth.uid(), new.user_id);
  new.updated_at := now();

  select coalesce(i.identity_data->>'full_name', i.identity_data->>'name')
    into v_name
    from auth.identities i
   where i.user_id = new.user_id
     and coalesce(i.identity_data->>'full_name', i.identity_data->>'name') is not null
   order by (i.provider = 'google') desc
   limit 1;

  new.author_name := coalesce(v_name, 'Usuario');
  return new;
end;
$$;

drop trigger if exists product_reviews_set_author on public.product_reviews;
create trigger product_reviews_set_author
  before insert or update on public.product_reviews
  for each row execute function public.product_reviews_set_author();

-- 4. Productos guardados por cada usuario.
create table if not exists public.saved_products (
  user_id uuid default auth.uid() references auth.users (id) on delete cascade,
  group_id bigint references public.product_groups (id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, group_id)
);

-- 5. RLS y políticas.
alter table public.product_groups enable row level security;
alter table public.product_reviews enable row level security;
alter table public.saved_products enable row level security;

drop policy if exists product_groups_read on public.product_groups;
create policy product_groups_read on public.product_groups
  for select to anon, authenticated using (true);

drop policy if exists reviews_read on public.product_reviews;
create policy reviews_read on public.product_reviews
  for select to anon, authenticated using (true);
drop policy if exists reviews_insert_own on public.product_reviews;
create policy reviews_insert_own on public.product_reviews
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists reviews_update_own on public.product_reviews;
create policy reviews_update_own on public.product_reviews
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists reviews_delete_own on public.product_reviews;
create policy reviews_delete_own on public.product_reviews
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists saved_select_own on public.saved_products;
create policy saved_select_own on public.saved_products
  for select to authenticated using (user_id = auth.uid());
drop policy if exists saved_insert_own on public.saved_products;
create policy saved_insert_own on public.saved_products
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists saved_delete_own on public.saved_products;
create policy saved_delete_own on public.saved_products
  for delete to authenticated using (user_id = auth.uid());

-- 6. Permisos.
grant select on public.product_groups to anon, authenticated;
grant select on public.product_reviews to anon, authenticated;
grant insert, update, delete on public.product_reviews to authenticated;
grant select, insert, delete on public.saved_products to authenticated;
-- El script de agrupado usa la clave secreta (service_role).
grant select, insert, update, delete on public.product_groups to service_role;

do $$ declare s text; begin
  s := pg_get_serial_sequence('public.product_reviews', 'id');
  if s is not null then
    execute format('grant usage on sequence %s to authenticated', s);
  end if;
end $$;

commit;
