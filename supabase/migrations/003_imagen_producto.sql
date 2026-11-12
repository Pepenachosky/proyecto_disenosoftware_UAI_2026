-- Migración 003: imagen de cada producto de tienda (products.image_url).
-- Se ejecuta a mano en el SQL Editor de Supabase y puede ejecutarse dos veces
-- seguidas sin error. Explicación en docs/migracion-003.md.

begin;

alter table public.products add column if not exists image_url text;

commit;
