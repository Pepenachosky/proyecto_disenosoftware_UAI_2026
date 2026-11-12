-- Pruebas de la migración 003 (products.image_url).
-- Las ejecuta supabase/tests/run_002.sh después de la migración.

-- Caso: existe products.image_url, de tipo text y que acepta null.
do $$ declare c record; begin
  select data_type, is_nullable into c from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'image_url';
  if not found then raise exception 'FALLO: no existe public.products.image_url'; end if;
  if c.data_type <> 'text' then raise exception 'FALLO: image_url es %, no text', c.data_type; end if;
  if c.is_nullable <> 'YES' then raise exception 'FALLO: image_url no acepta null'; end if;
end $$;

-- Caso: sin sesión (anon) se puede leer image_url.
begin;
set local role anon;
do $$ begin perform image_url from public.products limit 1; end $$;
rollback;

do $$ begin raise notice 'OK 003'; end $$;
