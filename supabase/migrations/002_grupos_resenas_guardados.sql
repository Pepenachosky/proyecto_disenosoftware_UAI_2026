-- Migración 002: grupos de productos, reseñas por grupo y productos guardados.
-- Se ejecuta a mano en el SQL Editor de Supabase y puede ejecutarse dos veces
-- seguidas sin error. Explicación en docs/migracion-002.md.

-- Todo en una transacción: si una sentencia falla, no queda la migración a medias.
begin;

-- 1. Grupos de productos (un producto "único" entre tiendas).
--    slug es la URL (/producto/<slug>) y la clave del upsert de scraper/group.ts
--    (on_conflict=slug); image_url la llena group.ts con la foto de una tienda.
--    Solo la escribe service_role (ver políticas en la sección 5).
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
-- add constraint no admite "if not exists": se borra y se vuelve a crear para
-- poder reejecutar. on delete set null: borrar un grupo no borra filas de tienda.
alter table public.products drop constraint if exists products_group_id_fkey;
alter table public.products add constraint products_group_id_fkey
  foreign key (group_id) references public.product_groups (id) on delete set null;
-- Índice para traer las filas de tienda de un grupo (página de producto).
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

-- set not null es posible porque la tabla está vacía. on delete cascade: borrar
-- un grupo borra sus reseñas (por eso group.ts nunca borra grupos).
alter table public.product_reviews alter column group_id set not null;
alter table public.product_reviews drop constraint if exists product_reviews_group_id_fkey;
alter table public.product_reviews add constraint product_reviews_group_id_fkey
  foreign key (group_id) references public.product_groups (id) on delete cascade;

-- user_id: por defecto el usuario de la sesión; borrar la cuenta borra sus reseñas.
alter table public.product_reviews alter column user_id set default auth.uid();
alter table public.product_reviews alter column user_id set not null;
alter table public.product_reviews drop constraint if exists product_reviews_user_id_fkey;
alter table public.product_reviews add constraint product_reviews_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;

-- Límites de nota (1 a 5) y comentario (hasta 1000 caracteres) en la base, para
-- que un cliente modificado no pueda saltárselos.
alter table public.product_reviews alter column rating set not null;
alter table public.product_reviews drop constraint if exists product_reviews_rating_check;
alter table public.product_reviews add constraint product_reviews_rating_check
  check (rating between 1 and 5);

alter table public.product_reviews alter column comment set default '';
alter table public.product_reviews alter column comment set not null;
alter table public.product_reviews drop constraint if exists product_reviews_comment_length_check;
alter table public.product_reviews add constraint product_reviews_comment_length_check
  check (char_length(comment) <= 1000);
alter table public.product_reviews alter column created_at set default now();

-- Una reseña por usuario y grupo.
-- El frontend edita la reseña existente en vez de insertar otra.
create unique index if not exists product_reviews_user_group_key
  on public.product_reviews (user_id, group_id);

-- Trigger: user_id, created_at, updated_at y author_name los pone la base, no
-- el cliente. Al editar no cambian created_at ni (con sesión) group_id.
-- El nombre sale de auth.identities (Google primero, cualquier proveedor como
-- respaldo), no de raw_user_meta_data, que el usuario puede editar.
-- security definer: authenticated no puede leer auth.identities, la función sí.
-- search_path vacío obliga a calificar los nombres (auth., public.) y evita que
-- un objeto en otro esquema suplante a uno de los usados.
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
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.created_at := old.created_at;
    -- Un usuario no mueve su reseña a otro grupo; sin sesión (SQL Editor o
    -- clave secreta) sí se puede, para corregir grupos a mano.
    if auth.uid() is not null then
      new.group_id := old.group_id;
    end if;
  end if;

  -- Identidad con nombre: Google primero, si no cualquier otra.
  select coalesce(i.identity_data->>'full_name', i.identity_data->>'name')
    into v_name
    from auth.identities i
   where i.user_id = new.user_id
     and coalesce(i.identity_data->>'full_name', i.identity_data->>'name') is not null
   order by (i.provider = 'google') desc
   limit 1;

  -- Siempre se sobrescribe: el author_name que mande el cliente se ignora.
  new.author_name := coalesce(v_name, 'Usuario');
  return new;
end;
$$;

-- BEFORE para poder modificar NEW antes de escribir la fila. drop + create
-- hace el paso reejecutable.
drop trigger if exists product_reviews_set_author on public.product_reviews;
create trigger product_reviews_set_author
  before insert or update on public.product_reviews
  for each row execute function public.product_reviews_set_author();

-- 4. Productos guardados por cada usuario.
-- La clave primaria (user_id, group_id) impide guardar dos veces el mismo grupo
-- y es el destino del upsert del frontend (addSaved, on conflict do nothing).
-- No hay update: un guardado solo se crea o se borra.
create table if not exists public.saved_products (
  user_id uuid default auth.uid() references auth.users (id) on delete cascade,
  group_id bigint references public.product_groups (id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, group_id)
);

-- 5. RLS y políticas.
-- Con RLS activo, una operación sin política que la permita queda negada aunque
-- el rol tenga el grant (Supabase da grants amplios por defecto). Cada política
-- se borra antes de crearla para poder reejecutar.
alter table public.product_groups enable row level security;
alter table public.product_reviews enable row level security;
alter table public.saved_products enable row level security;

-- Grupos: lectura pública (catálogo). Sin políticas de escritura: solo
-- service_role, que ignora RLS, los crea y modifica.
drop policy if exists product_groups_read on public.product_groups;
create policy product_groups_read on public.product_groups
  for select to anon, authenticated using (true);

-- Reseñas: lectura pública (página de producto y orden "Mejor valorados").
drop policy if exists reviews_read on public.product_reviews;
create policy reviews_read on public.product_reviews
  for select to anon, authenticated using (true);
-- Escritura solo sobre las propias. En update, using elige las filas del
-- usuario y with check impide pasar una reseña a otro user_id.
drop policy if exists reviews_insert_own on public.product_reviews;
create policy reviews_insert_own on public.product_reviews
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists reviews_update_own on public.product_reviews;
create policy reviews_update_own on public.product_reviews
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists reviews_delete_own on public.product_reviews;
create policy reviews_delete_own on public.product_reviews
  for delete to authenticated using (user_id = auth.uid());

-- Guardados: privados, solo el dueño los ve, crea y borra. No hace falta
-- política de update (el upsert con ignoreDuplicates no actualiza).
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
-- Los grants dicen qué operaciones puede intentar cada rol; RLS decide sobre
-- qué filas. anon no recibe nada sobre saved_products.
grant select on public.product_groups to anon, authenticated;
grant select on public.product_reviews to anon, authenticated;
grant insert, update, delete on public.product_reviews to authenticated;
grant select, insert, delete on public.saved_products to authenticated;
-- El script de agrupado usa la clave secreta (service_role).
grant select, insert, update, delete on public.product_groups to service_role;

-- Permiso sobre la secuencia de product_reviews.id, si la hay, para que
-- authenticated pueda insertar. Su nombre no se conoce (la base original no está
-- en el repositorio), así que se busca; pg_get_serial_sequence ya lo devuelve
-- entre comillas si hace falta, por eso %s y no %I.
do $$ declare s text; begin
  s := pg_get_serial_sequence('public.product_reviews', 'id');
  if s is not null then
    execute format('grant usage on sequence %s to authenticated', s);
  end if;
end $$;

commit;
