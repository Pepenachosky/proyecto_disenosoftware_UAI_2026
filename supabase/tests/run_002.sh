#!/usr/bin/env bash
# Prueba la migración 002 en un Postgres 17 desechable (podman):
# stub de Supabase -> migración -> migración otra vez -> pruebas.
set -euo pipefail

cd "$(dirname "$0")/../.."
NAME=pg002

podman run --rm -d --name "$NAME" -e POSTGRES_PASSWORD=x -p 55432:5432 docker.io/library/postgres:17 >/dev/null
trap 'podman stop "$NAME" >/dev/null' EXIT

# Se espera por TCP: durante la inicialización la imagen levanta un servidor
# temporal que solo escucha en el socket local y luego se reinicia.
for _ in $(seq 1 60); do
  podman exec "$NAME" pg_isready -q -h 127.0.0.1 -U postgres && break
  sleep 1
done
podman exec "$NAME" pg_isready -q -h 127.0.0.1 -U postgres

run_sql() {
  podman exec -i -e PGOPTIONS="$2" "$NAME" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres < "$1"
}

# Los avisos "already exists, skipping" de la segunda ejecución se ocultan.
run_sql supabase/tests/002_stub.sql "-c client_min_messages=warning"
run_sql supabase/migrations/002_grupos_resenas_guardados.sql "-c client_min_messages=warning"
run_sql supabase/migrations/002_grupos_resenas_guardados.sql "-c client_min_messages=warning"
run_sql supabase/tests/002_test.sql ""
