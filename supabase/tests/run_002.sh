#!/usr/bin/env bash
# Prueba las migraciones 002 a 005 en un Postgres 17 desechable (podman):
# stub de Supabase -> 002 (dos veces) -> pruebas 002 -> 003 (dos veces) -> pruebas 003 ->
# tiendas -> 004 (dos veces) -> pruebas 004 ->
# perfiles -> 005 (dos veces) -> pruebas 005 -> 005 -> pruebas de reejecución.
set -euo pipefail
# Cualquier fallo (por ejemplo, psql con ON_ERROR_STOP) corta el script con error.

# Rutas relativas a la raíz del repositorio, se llame desde donde se llame.
cd "$(dirname "$0")/../.."
NAME=pg002

# Contenedor desechable (--rm): el trap lo detiene, y con eso lo borra, al
# salir, también si una prueba falla. El puerto 55432 solo sirve para
# conectarse a mano; el script usa podman exec.
podman run --rm -d --name "$NAME" -e POSTGRES_PASSWORD=x -p 55432:5432 docker.io/library/postgres:17 >/dev/null
trap 'podman stop "$NAME" >/dev/null' EXIT

# Se espera por TCP: durante la inicialización la imagen levanta un servidor
# temporal que solo escucha en el socket local y luego se reinicia.
for _ in $(seq 1 60); do
  podman exec "$NAME" pg_isready -q -h 127.0.0.1 -U postgres && break
  sleep 1
done
# Si tras 60 s no responde, esta llamada falla y set -e aborta.
podman exec "$NAME" pg_isready -q -h 127.0.0.1 -U postgres

# $1: archivo SQL (por stdin); $2: PGOPTIONS. -X ignora ~/.psqlrc y
# ON_ERROR_STOP=1 convierte un "raise exception" de las pruebas en error.
run_sql() {
  podman exec -i -e PGOPTIONS="$2" "$NAME" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres < "$1"
}

# Los avisos "already exists, skipping" de la segunda ejecución se ocultan.
run_sql supabase/tests/002_stub.sql "-c client_min_messages=warning"
run_sql supabase/migrations/002_grupos_resenas_guardados.sql "-c client_min_messages=warning"
run_sql supabase/migrations/002_grupos_resenas_guardados.sql "-c client_min_messages=warning"
run_sql supabase/tests/002_test.sql ""
run_sql supabase/migrations/003_imagen_producto.sql "-c client_min_messages=warning"
run_sql supabase/migrations/003_imagen_producto.sql "-c client_min_messages=warning"
run_sql supabase/tests/003_test.sql ""
run_sql supabase/tests/004_prep.sql ""
run_sql supabase/migrations/004_ubicacion_tiendas.sql "-c client_min_messages=warning"
run_sql supabase/migrations/004_ubicacion_tiendas.sql "-c client_min_messages=warning"
run_sql supabase/tests/004_test.sql ""
run_sql supabase/tests/005_prep.sql ""
run_sql supabase/migrations/005_idioma_perfil.sql "-c client_min_messages=warning"
run_sql supabase/migrations/005_idioma_perfil.sql "-c client_min_messages=warning"
run_sql supabase/tests/005_test.sql ""
# Tercera ejecución de la 005, ahora con un idioma ya elegido: no debe borrarlo.
run_sql supabase/migrations/005_idioma_perfil.sql "-c client_min_messages=warning"
run_sql supabase/tests/005_rerun_test.sql ""
