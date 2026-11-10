-- Pruebas de la migración 002. Cada bloque DO lanza una excepción si algo
-- falla; con ON_ERROR_STOP=1, psql termina con error en ese caso.
-- Cada caso va en su propia transacción (begin; ... rollback;) para no
-- dejar estado entre casos.
--
-- Usuario A: 00000000-0000-0000-0000-00000000000a
-- Usuario B: 00000000-0000-0000-0000-00000000000b

-- Preparación (como postgres): usuarios, identidades, grupos y un producto.
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', '{"full_name":"Nombre Falso"}'),
  ('00000000-0000-0000-0000-00000000000b', '{}');
-- A tiene además otra identidad (insertada antes) para comprobar que se prefiere Google.
insert into auth.identities (user_id, provider, identity_data) values
  ('00000000-0000-0000-0000-00000000000a', 'github', '{"name":"Otra Ana"}'),
  ('00000000-0000-0000-0000-00000000000a', 'google', '{"full_name":"Ana Pérez"}'),
  ('00000000-0000-0000-0000-00000000000b', 'google', '{"name":"Beto"}');
insert into public.product_groups (id, slug, name, category) overriding system value values
  (1, 'amd-ryzen-5-7600', 'AMD Ryzen 5 7600', 'cpu'),
  (2, 'amd-ryzen-5-7600x', 'AMD Ryzen 5 7600X', 'cpu');
insert into public.stores (id, slug, name) values (1, 'winpy', 'Winpy');
insert into public.products (id, store_id, name, url, category) overriding system value values
  (1, 1, 'Procesador AMD Ryzen 5 7600', 'https://example.com/7600', 'cpu');

-- Caso: la política vieja old_open ya no existe y solo quedan las nuevas.
do $$ begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'product_reviews'
             and policyname not in ('reviews_read', 'reviews_insert_own', 'reviews_update_own', 'reviews_delete_own')) then
    raise exception 'FALLO: quedan políticas viejas en product_reviews';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'product_reviews') <> 4 then
    raise exception 'FALLO: product_reviews no tiene las 4 políticas nuevas';
  end if;
end $$;

-- Caso: anon lee product_reviews y product_groups.
-- La reseña la inserta postgres (sin auth.uid(), como el script de servicio):
-- el trigger mantiene user_id y toma el nombre de la identidad de B.
begin;
insert into public.product_reviews (group_id, user_id, rating) values (1, '00000000-0000-0000-0000-00000000000b', 4);
set local role anon;
do $$ begin
  if (select count(*) from public.product_reviews) <> 1 then
    raise exception 'FALLO: anon no ve la reseña';
  end if;
  if (select user_id from public.product_reviews) <> '00000000-0000-0000-0000-00000000000b'::uuid then
    raise exception 'FALLO: sin auth.uid() el trigger no mantuvo user_id';
  end if;
  if (select author_name from public.product_reviews) is distinct from 'Beto' then
    raise exception 'FALLO: reseña sin sesión con author_name = %', (select author_name from public.product_reviews);
  end if;
  if (select count(*) from public.product_groups) <> 2 then
    raise exception 'FALLO: anon no ve los grupos';
  end if;
end $$;
rollback;

-- Caso: anon no puede insertar en product_groups ni en product_reviews,
-- ni leer saved_products.
begin;
set local role anon;
do $$ begin
  insert into public.product_groups (slug, name, category) values ('x', 'X', 'cpu');
  raise exception 'FALLO: anon insertó en product_groups';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  insert into public.product_reviews (group_id, user_id, rating) values (1, '00000000-0000-0000-0000-00000000000a', 5);
  raise exception 'FALLO: anon insertó una reseña';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform 1 from public.saved_products;
  raise exception 'FALLO: anon leyó saved_products';
exception when insufficient_privilege then null;
end $$;
rollback;

-- Caso: aunque anon y authenticated tuvieran permiso de insert en
-- product_groups (permisos por defecto de Supabase), RLS lo impide.
begin;
grant insert on public.product_groups to anon, authenticated;
set local role anon;
do $$ begin
  insert into public.product_groups (slug, name, category) values ('x', 'X', 'cpu');
  raise exception 'FALLO: anon insertó en product_groups con grant';
exception when insufficient_privilege then
  if sqlerrm not like '%row-level security%' then raise; end if;
end $$;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  insert into public.product_groups (slug, name, category) values ('x', 'X', 'cpu');
  raise exception 'FALLO: authenticated insertó en product_groups con grant';
exception when insufficient_privilege then
  if sqlerrm not like '%row-level security%' then raise; end if;
end $$;
rollback;

-- Caso: service_role (script de agrupado) crea grupos y asigna group_id.
begin;
set local role service_role;
do $$ declare g bigint; begin
  insert into public.product_groups (slug, name, category) values ('amd-ryzen-7-7700', 'AMD Ryzen 7 7700', 'cpu')
    returning id into g;
  update public.products set group_id = g, group_locked = true where id = 1;
  if not found then raise exception 'FALLO: service_role no actualizó products'; end if;
end $$;
rollback;

-- Caso: A inserta una reseña; el nombre viene de la identidad de Google, no
-- de raw_user_meta_data. B inserta la suya con su nombre.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ declare r record; begin
  insert into public.product_reviews (group_id, rating, comment) values (1, 5, 'Muy bueno')
    returning user_id, author_name into r;
  if r.author_name is distinct from 'Ana Pérez' then
    raise exception 'FALLO: author_name de A = %', r.author_name;
  end if;
  if r.user_id is distinct from '00000000-0000-0000-0000-00000000000a'::uuid then
    raise exception 'FALLO: user_id de A = %', r.user_id;
  end if;
end $$;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ declare r record; begin
  insert into public.product_reviews (group_id, rating) values (1, 3) returning author_name into r;
  if r.author_name is distinct from 'Beto' then
    raise exception 'FALLO: author_name de B = %', r.author_name;
  end if;
end $$;
rollback;

-- Caso: si A manda user_id = B, el trigger lo reemplaza por A.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ declare u uuid; begin
  insert into public.product_reviews (group_id, user_id, rating) values (1, '00000000-0000-0000-0000-00000000000b', 5)
    returning user_id into u;
  if u is distinct from '00000000-0000-0000-0000-00000000000a'::uuid then
    raise exception 'FALLO: user_id enviado por el cliente quedó %', u;
  end if;
end $$;
rollback;

-- Caso: A no puede dejar una segunda reseña en el mismo grupo.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into public.product_reviews (group_id, rating) values (1, 5);
do $$ begin
  insert into public.product_reviews (group_id, rating) values (1, 2);
  raise exception 'FALLO: A dejó dos reseñas en el mismo grupo';
exception when unique_violation then null;
end $$;
rollback;

-- Caso: rating fuera de 1..5 falla.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  insert into public.product_reviews (group_id, rating) values (1, 6);
  raise exception 'FALLO: se aceptó rating = 6';
exception when check_violation then null;
end $$;
rollback;

-- Caso: A no puede firmar con otro nombre, ni al insertar ni al editar.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ declare n text; begin
  insert into public.product_reviews (group_id, rating, author_name) values (2, 4, 'X')
    returning author_name into n;
  if n is distinct from 'Ana Pérez' then
    raise exception 'FALLO: insert con author_name X quedó %', n;
  end if;
  update public.product_reviews set author_name = 'X', rating = 5 where group_id = 2
    returning author_name into n;
  if n is distinct from 'Ana Pérez' then
    raise exception 'FALLO: update con author_name X quedó %', n;
  end if;
end $$;
rollback;

-- Caso: B no puede editar ni borrar la reseña de A.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into public.product_reviews (group_id, rating, comment) values (1, 5, 'De A');
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ declare n int; begin
  update public.product_reviews set rating = 1, comment = 'Hackeado'
    where user_id = '00000000-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO: B editó % reseña(s) de A', n; end if;
  delete from public.product_reviews where user_id = '00000000-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO: B borró % reseña(s) de A', n; end if;
end $$;
reset role;
do $$ begin
  if not exists (select 1 from public.product_reviews
                 where user_id = '00000000-0000-0000-0000-00000000000a' and rating = 5 and comment = 'De A') then
    raise exception 'FALLO: la reseña de A cambió';
  end if;
end $$;
rollback;

-- Caso: A guarda el grupo 1; solo A lo ve, B ve 0 filas.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into public.saved_products (group_id) values (1);
do $$ begin
  if (select count(*) from public.saved_products) <> 1 then
    raise exception 'FALLO: A no ve su guardado';
  end if;
end $$;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  if (select count(*) from public.saved_products) <> 0 then
    raise exception 'FALLO: B ve guardados de A';
  end if;
end $$;
rollback;

-- Caso: B no puede guardar a nombre de A.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  insert into public.saved_products (user_id, group_id) values ('00000000-0000-0000-0000-00000000000a', 1);
  raise exception 'FALLO: B guardó a nombre de A';
exception when insufficient_privilege then
  if sqlerrm not like '%row-level security%' then raise; end if;
end $$;
rollback;

do $$ begin raise notice 'OK 002'; end $$;
