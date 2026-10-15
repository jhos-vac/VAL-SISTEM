#!/usr/bin/env bash
# Copia las 4 bases de un proyecto Neon a otro (cambio de región) y compara
# la cantidad de filas de cada tabla. Usa pg_dump/pg_restore de Docker, no
# hace falta tener Postgres instalado.
#
# Requiere, en el entorno, las URLs DIRECTAS (sin "-pooler") de origen y
# destino:
#   SRC_DATABASE_USER  SRC_DATABASE_MARKET  SRC_DATABASE_PORTFOLIO  SRC_DATABASE_AUTOMATION
#   DST_DATABASE_USER  DST_DATABASE_MARKET  DST_DATABASE_PORTFOLIO  DST_DATABASE_AUTOMATION
# Las bases de destino tienen que existir y estar VACÍAS.
#
# Antes de correrlo, suspendé el backend en Render para que nadie escriba
# durante la copia.
set -euo pipefail

DBS=(USER MARKET PORTFOLIO AUTOMATION)
IMAGE=postgres:18-alpine

pg() { docker run --rm -i "$IMAGE" "$@"; }

major() { pg psql "$1" -At -c "SELECT current_setting('server_version_num')::int / 10000"; }

# pg_dump/pg_restore de la misma versión que el servidor: una versión más
# nueva genera SQL que un servidor viejo no entiende.
src_major=$(major "${SRC_DATABASE_USER:?Falta SRC_DATABASE_USER}")
dst_major=$(major "${DST_DATABASE_USER:?Falta DST_DATABASE_USER}")
if [ "$src_major" != "$dst_major" ]; then
  echo "Postgres $src_major en origen y $dst_major en destino: creá el proyecto nuevo con Postgres $src_major." >&2
  exit 1
fi
IMAGE="postgres:${src_major}-alpine"
echo "Postgres $src_major"

count_rows() {
  pg psql "$1" -At -c "
    SELECT string_agg(format('%s=%s', t, n), ' ' ORDER BY t) FROM (
      SELECT c.relname AS t,
             (xpath('/row/n/text()', query_to_xml(format('SELECT count(*) AS n FROM %I.%I', n.nspname, c.relname), false, true, '')))[1]::text AS n
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE c.relkind = 'r' AND n.nspname = 'public'
    ) s;"
}

for db in "${DBS[@]}"; do
  src_var="SRC_DATABASE_$db"
  dst_var="DST_DATABASE_$db"
  src="${!src_var:?Falta $src_var}"
  dst="${!dst_var:?Falta $dst_var}"
  case "$src$dst" in *-pooler.*) echo "Usá URLs directas (sin -pooler) para $db" >&2; exit 1 ;; esac

  existing=$(pg psql "$dst" -At -c "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'")
  if [ "$existing" != "0" ]; then
    echo "La base destino de $db no está vacía ($existing tablas). Abortado." >&2
    exit 1
  fi

  echo "== $db: copiando…"
  pg pg_dump --format=custom --no-owner --no-acl "$src" \
    | pg pg_restore --no-owner --no-acl --exit-on-error -d "$dst"

  before=$(count_rows "$src")
  after=$(count_rows "$dst")
  if [ "$before" = "$after" ]; then
    echo "   filas iguales en origen y destino"
  else
    echo "   DIFERENCIA de filas en $db" >&2
    echo "   origen:  $before" >&2
    echo "   destino: $after" >&2
    exit 1
  fi
done

echo "Listo. Ahora actualizá las URLs en Render y volvé a activar el servicio."
