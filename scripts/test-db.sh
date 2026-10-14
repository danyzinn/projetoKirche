#!/usr/bin/env bash
# Aplica migrations em um PostgreSQL efêmero e roda os testes de RLS/isolamento.
# Uso: npm run test:db            (sobe cluster temporário com initdb do PostgreSQL 15+)
#      TEST_DATABASE_URL=postgres://... npm run test:db   (usa banco existente e VAZIO)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PSQL_OPTS=(-v ON_ERROR_STOP=1 -q -X)

run_as_pg() { if [ "$(id -u)" = "0" ]; then runuser -u postgres -- "$@"; else "$@"; fi; }

cleanup() { :; }
if [ -z "${TEST_DATABASE_URL:-}" ]; then
  PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)}"
  [ -x "$PG_BIN/initdb" ] || { echo "initdb não encontrado; defina PG_BIN ou TEST_DATABASE_URL"; exit 1; }
  TMP="$(mktemp -d)"; chmod 777 "$TMP"
  PORT="${TEST_DB_PORT:-54329}"
  run_as_pg "$PG_BIN/initdb" -D "$TMP/data" -U postgres -A trust >/dev/null
  run_as_pg "$PG_BIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/log" -w start >/dev/null
  cleanup() { run_as_pg "$PG_BIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
  trap cleanup EXIT
  DB_URL="postgresql://postgres@/postgres?host=$TMP&port=$PORT"
else
  DB_URL="$TEST_DATABASE_URL"
fi

apply() { psql "$DB_URL" "${PSQL_OPTS[@]}" -f "$1" >/dev/null; }

echo "▶ stub Supabase + helpers"
apply "$ROOT/supabase/tests/00_supabase_stub.sql"
echo "▶ migrations"
for f in "$ROOT"/supabase/migrations/*.sql; do echo "  - $(basename "$f")"; apply "$f"; done
apply "$ROOT/supabase/tests/01_test_helpers.sql"

if [ "${WITH_SEED:-0}" = "1" ]; then echo "▶ seed demo"; apply "$ROOT/supabase/seed.sql"; fi

echo "▶ testes"
FAIL=0; PASS=0
for f in "$ROOT"/supabase/tests/[1-9]*_*.test.sql; do
  # cada arquivo roda em uma conexão nova sobre fixtures recriadas
  if out=$(psql "$DB_URL" "${PSQL_OPTS[@]}" -f "$ROOT/supabase/tests/fixtures.sql" -f "$f" 2>&1); then
    n=$(grep -c "ok - " <<<"$out" || true); PASS=$((PASS+n))
    echo "  ✔ $(basename "$f") ($n asserções)"
  else
    FAIL=$((FAIL+1)); echo "  ✘ $(basename "$f")"; grep -E "ERROR|FALHOU" <<<"$out" | head -5 | sed 's/^/      /'
  fi
done
echo "Asserções aprovadas: $PASS | arquivos com falha: $FAIL"
[ "$FAIL" = "0" ]
