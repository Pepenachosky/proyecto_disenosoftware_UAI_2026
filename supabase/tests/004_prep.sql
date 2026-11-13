-- Tiendas 1 a 3 (las que existen en la base real) antes de la migración 004.
-- 002_test.sql ya insertó la 1; on conflict evita el choque.
insert into public.stores (id, slug, name) values
  (1, 'winpy', 'Winpy'),
  (2, 'pcexpress', 'PC Express'),
  (3, 'spdigital', 'SP Digital')
on conflict (id) do nothing;
