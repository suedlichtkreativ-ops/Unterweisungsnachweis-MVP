#!/usr/bin/env bash
# Spielt Migrationen + Seed in ein temporäres lokales Postgres (ohne Docker/Supabase)
# und führt die SQL-Tests aus. Voraussetzung: PostgreSQL 15+ Binaries (initdb, pg_ctl).
set -euo pipefail
cd "$(dirname "$0")/.."

PGBIN="${PGBIN:-$(dirname "$(command -v initdb 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/initdb | tail -1)")}"
DIR="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"
# initdb/pg_ctl verweigern root – dann als Systemnutzer "postgres" ausführen
ALS=()
if [ "$(id -u)" = "0" ]; then
  chown postgres "$DIR"
  ALS=(runuser -u postgres --)
fi
trap '"${ALS[@]}" "$PGBIN/pg_ctl" -D "$DIR/data" stop -m fast >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT

"${ALS[@]}" "$PGBIN/initdb" -D "$DIR/data" -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
"${ALS[@]}" "$PGBIN/pg_ctl" -D "$DIR/data" -o "-p $PORT -k $DIR -c listen_addresses=''" -l "$DIR/log" start >/dev/null

PSQL=(psql -h "$DIR" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X -o /dev/null)

echo "→ Supabase-Stub"
"${PSQL[@]}" -f supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do
  echo "→ Migration $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
echo "→ Seed"
"${PSQL[@]}" -f supabase/seed.sql
for f in supabase/tests/[1-9]*.sql; do
  echo "→ Test $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
echo "✓ Alle Datenbanktests bestanden"
