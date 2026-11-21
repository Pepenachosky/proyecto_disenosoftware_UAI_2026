-- Migración 003: imagen de cada producto de tienda (products.image_url).
-- Se ejecuta a mano en el SQL Editor de Supabase y puede ejecutarse dos veces
-- seguidas sin error. Explicación en docs/migracion-003.md.

begin;

-- Admite null: PC Express no aporta imagen (su servidor responde 403 a pedidos
-- desde otro sitio) y el frontend muestra /placeholder.png. Las políticas de
-- products no cambian: la columna se lee igual que el resto de la tabla.
alter table public.products add column if not exists image_url text;

commit;
