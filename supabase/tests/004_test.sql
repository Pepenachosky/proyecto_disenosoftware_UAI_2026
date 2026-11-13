-- Pruebas de la migración 004 (store_branches y branch_hours).
-- Las ejecuta supabase/tests/run_002.sh después de la migración.

-- Caso: exactamente una sucursal por tienda (3 en total).
do $$ begin
  if (select count(*) from public.store_branches) <> 3 then
    raise exception 'FALLO: store_branches no tiene 3 filas';
  end if;
  if exists (select 1 from public.stores s where s.slug in ('winpy', 'pcexpress', 'spdigital')
             and (select count(*) from public.store_branches b where b.store_id = s.id) <> 1) then
    raise exception 'FALLO: alguna tienda no tiene exactamente 1 sucursal';
  end if;
end $$;

-- Caso: toda sucursal tiene dirección, comuna y coordenadas.
do $$ begin
  if exists (select 1 from public.store_branches
             where address is null or city is null or lat is null or lng is null) then
    raise exception 'FALLO: hay sucursales sin address, city, lat o lng';
  end if;
end $$;

-- Caso: cada sucursal tiene horario y ningún tramo cierra antes (o al) abrir.
do $$ begin
  if exists (select 1 from public.store_branches b
             where not exists (select 1 from public.branch_hours h where h.branch_id = b.id)) then
    raise exception 'FALLO: hay sucursales sin horario';
  end if;
  if exists (select 1 from public.branch_hours where closes <= opens) then
    raise exception 'FALLO: hay horarios con closes <= opens';
  end if;
end $$;

-- Caso: PC Express tiene dos tramos un día de semana y la clave primaria incluye opens.
do $$ declare cols text; begin
  if (select count(*) from public.branch_hours h
        join public.store_branches b on b.id = h.branch_id
        join public.stores s on s.id = b.store_id
      where s.slug = 'pcexpress' and h.weekday = 1) <> 2 then
    raise exception 'FALLO: PC Express no tiene 2 tramos el lunes';
  end if;
  select string_agg(a.attname, ',' order by k.ord) into cols
    from pg_constraint c
    cross join lateral unnest(c.conkey) with ordinality k(attnum, ord)
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
    where c.conrelid = 'public.branch_hours'::regclass and c.contype = 'p';
  if cols is distinct from 'branch_id,weekday,opens' then
    raise exception 'FALLO: la clave primaria de branch_hours es (%)', cols;
  end if;
end $$;

-- Caso: existe un índice único sobre store_branches(store_id).
do $$ begin
  if not exists (
    select 1 from pg_index i
    where i.indrelid = 'public.store_branches'::regclass and i.indisunique
      and i.indnatts = 1
      and (select attname from pg_attribute where attrelid = i.indrelid and attnum = i.indkey[0]) = 'store_id'
  ) then raise exception 'FALLO: no hay índice único sobre store_branches(store_id)'; end if;
end $$;

-- Caso: sin sesión (anon) se pueden leer ambas tablas.
begin;
set local role anon;
do $$ begin
  if (select count(*) from public.store_branches) <> 3 then
    raise exception 'FALLO: anon no ve las 3 sucursales';
  end if;
  if (select count(*) from public.branch_hours) = 0 then
    raise exception 'FALLO: anon no ve branch_hours';
  end if;
end $$;
rollback;

-- Caso: anon no puede escribir.
begin;
set local role anon;
do $$ begin
  begin
    insert into public.branch_hours (branch_id, weekday, opens, closes)
      values ((select min(id) from public.store_branches), 0, '10:00', '12:00');
    raise exception 'FALLO: anon pudo insertar en branch_hours';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;

do $$ begin raise notice 'OK 004'; end $$;
