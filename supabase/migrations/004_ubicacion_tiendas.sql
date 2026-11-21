-- Migración 004: ubicación y horario de las tiendas físicas
-- (store_branches y branch_hours).
-- Se ejecuta a mano en el SQL Editor de Supabase y puede ejecutarse dos veces
-- seguidas sin error ni filas duplicadas. Explicación en docs/migracion-004.md.
--
-- Convención de weekday: 0 = domingo ... 6 = sábado; un día sin fila = cerrado.

begin;

-- Una sola sucursal por tienda.
-- Además es el destino del "on conflict (store_id)" de la carga de abajo,
-- que así actualiza en vez de duplicar al reejecutar.
create unique index if not exists store_branches_store_id_key
  on public.store_branches (store_id);

-- PC Express cierra a almorzar: dos tramos el mismo día. La clave primaria
-- incluye opens para permitirlo (la tabla estaba vacía antes de esta migración).
-- drop + add para poder reejecutar (supone que la clave se llama branch_hours_pkey).
alter table public.branch_hours drop constraint if exists branch_hours_pkey;
alter table public.branch_hours add constraint branch_hours_pkey
  primary key (branch_id, weekday, opens);

-- Sucursal de cada tienda, unida por slug (datos y fuentes en
-- docs/migracion-004.md). Una tienda que no exista en stores se omite (join).
insert into public.store_branches (store_id, name, address, city, lat, lng, phone)
select s.id, v.name, v.address, v.city, v.lat, v.lng, v.phone
from (values
  ('winpy',     'Tienda física',             'Av. Antonio Varas 2223', 'Ñuñoa',      -33.44777, -70.61115, '+562 2227 9800'),
  ('pcexpress', 'Casa matriz',               'Almirante Zegers 784',   'Providencia', -33.43424, -70.62353, '+562 2235 3028'),
  ('spdigital', 'Tienda y punto de retiro',  'Padre Mariano 356',      'Providencia', -33.42410, -70.61849, '+562 2656 7043')
) as v(slug, name, address, city, lat, lng, phone)
join public.stores s on s.slug = v.slug
on conflict (store_id) do update set
  name = excluded.name,
  address = excluded.address,
  city = excluded.city,
  lat = excluded.lat,
  lng = excluded.lng,
  phone = excluded.phone;

-- Se borra y se vuelve a insertar para poder corregir un horario editando
-- esta migración y ejecutándola de nuevo.
delete from public.branch_hours
where branch_id in (select id from public.store_branches);

-- Cada fila es un tramo (weekday, opens, closes) de la sucursal de la tienda.
insert into public.branch_hours (branch_id, weekday, opens, closes)
select b.id, v.weekday, v.opens::time, v.closes::time
from (values
  -- Winpy: el texto oficial dice "Lunes a Martes 09:00-19:00 y Miércoles a
  -- Viernes 09:00-18:00"; se usa tal cual.
  ('winpy', 1, '09:00', '19:00'),
  ('winpy', 2, '09:00', '19:00'),
  ('winpy', 3, '09:00', '18:00'),
  ('winpy', 4, '09:00', '18:00'),
  ('winpy', 5, '09:00', '18:00'),
  -- PC Express: lunes a viernes en dos tramos.
  ('pcexpress', 1, '09:30', '14:00'), ('pcexpress', 1, '15:00', '18:30'),
  ('pcexpress', 2, '09:30', '14:00'), ('pcexpress', 2, '15:00', '18:30'),
  ('pcexpress', 3, '09:30', '14:00'), ('pcexpress', 3, '15:00', '18:30'),
  ('pcexpress', 4, '09:30', '14:00'), ('pcexpress', 4, '15:00', '18:30'),
  ('pcexpress', 5, '09:30', '14:00'), ('pcexpress', 5, '15:00', '18:30'),
  -- SP Digital: lunes a jueves hasta las 18:30, viernes hasta las 18:00.
  ('spdigital', 1, '09:00', '18:30'),
  ('spdigital', 2, '09:00', '18:30'),
  ('spdigital', 3, '09:00', '18:30'),
  ('spdigital', 4, '09:00', '18:30'),
  ('spdigital', 5, '09:00', '18:00')
) as v(slug, weekday, opens, closes)
join public.stores s on s.slug = v.slug
join public.store_branches b on b.store_id = s.id;

-- Lectura pública; sin políticas de escritura.
alter table public.store_branches enable row level security;
alter table public.branch_hours enable row level security;

-- Se borran todas las políticas existentes (no se conocen sus nombres) para
-- que ninguna vieja deje la escritura abierta.
do $$ declare p record; begin
  for p in select policyname, tablename from pg_policies
           where schemaname='public' and tablename in ('store_branches','branch_hours') loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop; end $$;

-- Lectura pública: la tarjeta de tienda del frontend muestra dirección,
-- distancia y horario sin sesión. Los grants de escritura que Supabase da por
-- defecto quedan sin efecto porque no hay política que los permita; los datos
-- se cambian editando esta migración.
drop policy if exists store_branches_read on public.store_branches;
create policy store_branches_read on public.store_branches
  for select to anon, authenticated using (true);

drop policy if exists branch_hours_read on public.branch_hours;
create policy branch_hours_read on public.branch_hours
  for select to anon, authenticated using (true);

grant select on public.store_branches, public.branch_hours to anon, authenticated;

commit;
