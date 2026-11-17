-- Pruebas tras reejecutar la migración 005: no borra elecciones de idioma.

do $$ begin
  if (select language from public.profiles where id = '00000000-0000-0000-0000-0000000000a1') is distinct from 'en' then
    raise exception 'FALLO: la reejecución de la 005 borró el idioma de A';
  end if;
  if (select column_default from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'language') is not null then
    raise exception 'FALLO: language recuperó un default';
  end if;
end $$;
