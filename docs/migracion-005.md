# Migración 005: idioma del perfil

Archivo: `supabase/migrations/005_idioma_perfil.sql`

## Cómo ejecutarla

1. Abrir el proyecto en Supabase → **SQL Editor**.
2. Pegar el contenido de `005_idioma_perfil.sql` y presionar **Run**.

Se puede ejecutar más de una vez sin problemas: la segunda vez no borra los idiomas que los usuarios ya hayan elegido.

## Qué hace

- Permite que `profiles.language` quede vacío (quita el `NOT NULL` que tenía la base real), quita el valor por defecto `'es'` y deja en vacío (`null`) el idioma de los perfiles existentes. Nadie pudo elegir idioma hasta ahora, así que no se pierde ninguna elección. Así, un perfil nuevo no tiene idioma hasta que la página guarda el que se está usando. Esto se hace solo la primera vez.
- Agrega la restricción `profiles_language_check`: el idioma solo puede ser `es`, `en` o vacío.
- Cambia los permisos de `profiles`: `anon` pierde todo acceso; `authenticated` puede leer y puede cambiar solo la columna `language`. Por eso un usuario ya no puede cambiar su `display_name`, ni insertar ni borrar perfiles (antes sí podía). El registro de usuarios nuevos sigue funcionando porque el trigger `handle_new_user` es `security definer`.
- Reemplaza la política `perfil propio: editar` por `profiles_update_own_language`, que solo deja a cada usuario modificar su propia fila. `perfil propio: leer` se mantiene.

## Verificación

Después de ejecutarla, esta consulta debe mostrar `language` sin default y con `is_nullable = YES`, la restricción, los permisos de `authenticated` (`SELECT` y `UPDATE` solo de `language`) y las políticas `perfil propio: leer` y `profiles_update_own_language`:

```sql
select column_name, column_default, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles';

select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.profiles'::regclass;

select grantee, privilege_type
from information_schema.table_privileges
where table_schema = 'public' and table_name = 'profiles'
order by grantee, privilege_type;

select grantee, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles'
  and grantee in ('anon', 'authenticated') and privilege_type = 'UPDATE';

select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'profiles';
```
