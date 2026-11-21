-- Pruebas de la migración 005 (idioma editable solo en el perfil propio).
-- Las ejecuta supabase/tests/run_002.sh después de la migración.
--
-- Usuario A: 00000000-0000-0000-0000-0000000000a1
-- Usuario B: 00000000-0000-0000-0000-0000000000b2

-- Caso: language ya no tiene default.
do $$ begin
  if (select column_default from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'language') is not null then
    raise exception 'FALLO: profiles.language todavía tiene default';
  end if;
end $$;

-- Caso: language acepta null (la base real lo tenía NOT NULL).
do $$ begin
  if (select is_nullable from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'language') <> 'YES' then
    raise exception 'FALLO: profiles.language sigue siendo NOT NULL';
  end if;
end $$;

-- Caso: los perfiles existentes quedaron con language null.
do $$ begin
  if exists (select 1 from public.profiles
             where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2')
               and language is not null) then
    raise exception 'FALLO: A o B conservan un language no nulo';
  end if;
end $$;

-- Caso: un usuario nuevo obtiene perfil con language null.
-- Se inserta como postgres; el perfil lo crea el trigger handle_new_user.
begin;
insert into auth.users (id, raw_user_meta_data, email)
  values ('00000000-0000-0000-0000-0000000000c3', '{}', 'c@example.com');
do $$ begin
  if not exists (select 1 from public.profiles
                 where id = '00000000-0000-0000-0000-0000000000c3' and language is null) then
    raise exception 'FALLO: el perfil nuevo no existe o tiene language no nulo';
  end if;
end $$;
rollback;

-- Caso: A cambia su propio idioma.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
do $$ declare n int; begin
  update public.profiles set language = 'en' where id = '00000000-0000-0000-0000-0000000000a1';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALLO: A no pudo cambiar su idioma (% filas)', n; end if;
  if (select language from public.profiles where id = '00000000-0000-0000-0000-0000000000a1') is distinct from 'en' then
    raise exception 'FALLO: el idioma de A no quedó en en';
  end if;
end $$;
rollback;

-- Caso: A no puede cambiar el idioma de B (0 filas).
-- RLS filtra la fila de B sin lanzar error.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
do $$ declare n int; begin
  update public.profiles set language = 'en' where id = '00000000-0000-0000-0000-0000000000b2';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO: A modificó % filas de B', n; end if;
end $$;
reset role;
do $$ begin
  if (select language from public.profiles where id = '00000000-0000-0000-0000-0000000000b2') is not null then
    raise exception 'FALLO: el idioma de B cambió';
  end if;
end $$;
rollback;

-- Caso: A no puede cambiar display_name.
-- Falla por el grant por columna (solo language), antes de llegar a RLS.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
do $$ begin
  begin
    update public.profiles set display_name = 'x' where id = '00000000-0000-0000-0000-0000000000a1';
    raise exception 'FALLO: A pudo cambiar display_name';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;

-- Caso: un idioma fuera de es/en se rechaza.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
do $$ begin
  begin
    update public.profiles set language = 'fr' where id = '00000000-0000-0000-0000-0000000000a1';
    raise exception 'FALLO: se aceptó language = fr';
  exception when check_violation then null;
  end;
end $$;
rollback;

-- Caso: anon no puede actualizar.
begin;
set local role anon;
do $$ begin
  begin
    update public.profiles set language = 'en';
    raise exception 'FALLO: anon pudo actualizar profiles';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;

-- Caso: A no puede insertar ni borrar perfiles.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
do $$ begin
  begin
    insert into public.profiles (id) values ('00000000-0000-0000-0000-0000000000d4');
    raise exception 'FALLO: A pudo insertar un perfil';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.profiles where id = '00000000-0000-0000-0000-0000000000a1';
    raise exception 'FALLO: A pudo borrar un perfil';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;

-- Fuera de transacción y como superusuario: A elige inglés de verdad; la
-- prueba de reejecución comprueba que la 005 no lo borra.
update public.profiles set language = 'en' where id = '00000000-0000-0000-0000-0000000000a1';
