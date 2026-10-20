#!/usr/bin/env bash
# End-to-End-Test ohne Docker:
#   Postgres (lokal) + GoTrue (Supabase Auth) + PostgREST (als Binaries) + Storage-Nachbau (gateway.mjs)
#   -> Migrationen + Seed -> next build/start -> Browser-Ablauf (ablauf.mjs) -> Screenshots in e2e/.tmp/out
# Voraussetzungen: PostgreSQL 15+ Binaries, curl, Node 20+, Chromium (CHROMIUM=/pfad oder Playwright-Browser).
set -euo pipefail
E="$(cd "$(dirname "$0")" && pwd)"
P="$(dirname "$E")"
T="$E/.tmp"
PGBIN="${PGBIN:-$(dirname "$(command -v initdb 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/initdb | tail -1)")}"
PGRST_VERSION=v12.2.3
AUTH_VERSION=v2.170.0
export JWT_SECRET="e2e-secret-jwt-token-with-at-least-32-characters-long"
PIDS=()

aufraeumen() {
  for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null || true; done
  "${ALS[@]}" "$PGBIN/pg_ctl" -D "$PGD/data" stop -m fast >/dev/null 2>&1 || true
}
trap aufraeumen EXIT

mkdir -p "$T/bin" "$T/logs" "$T/out"
rm -rf "$T/storage" && mkdir -p "$T/storage"
[ -d "$E/node_modules" ] || (cd "$E" && npm install --silent)

# Binaries laden (einmalig)
if [ ! -x "$T/bin/postgrest" ]; then
  curl -sSL "https://github.com/PostgREST/postgrest/releases/download/$PGRST_VERSION/postgrest-$PGRST_VERSION-linux-static-x64.tar.xz" | tar -xJ -C "$T/bin"
fi
if [ ! -x "$T/auth/auth" ]; then
  mkdir -p "$T/auth"
  curl -sSL "https://github.com/supabase/auth/releases/download/$AUTH_VERSION/auth-$AUTH_VERSION-x86.tar.gz" | tar -xz -C "$T/auth"
fi

# Postgres (initdb verweigert root -> dann als Systemnutzer postgres)
ALS=()
if [ "$(id -u)" = "0" ]; then
  ALS=(runuser -u postgres --)
  PGD="$("${ALS[@]}" mktemp -d)"
else
  PGD="$(mktemp -d)"
fi
"${ALS[@]}" "$PGBIN/initdb" -D "$PGD/data" -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
"${ALS[@]}" "$PGBIN/pg_ctl" -D "$PGD/data" -o "-p 54322 -k $PGD -c listen_addresses=127.0.0.1" -l "$PGD/pg.log" start >/dev/null
PSQL=(psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X -o /dev/null)
"${PSQL[@]}" -f "$E/supabase-pre.sql"

# GoTrue migriert das auth-Schema selbst
(cd "$T/auth" && exec env GOTRUE_API_HOST=127.0.0.1 PORT=9999 API_EXTERNAL_URL=http://127.0.0.1:54321/auth/v1 \
  GOTRUE_DB_DRIVER=postgres GOTRUE_DB_DATABASE_URL="postgres://supabase_auth_admin@127.0.0.1:54322/postgres?sslmode=disable&search_path=auth" \
  GOTRUE_SITE_URL=http://localhost:3000 GOTRUE_JWT_SECRET="$JWT_SECRET" GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated \
  GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated GOTRUE_JWT_ADMIN_ROLES=service_role GOTRUE_MAILER_AUTOCONFIRM=true \
  GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_DISABLE_SIGNUP=false GOTRUE_DB_NAMESPACE=auth GOTRUE_LOG_LEVEL=warn \
  ./auth) > "$T/logs/auth.log" 2>&1 &
PIDS+=($!)
for _ in $(seq 1 60); do curl -sf http://127.0.0.1:9999/health >/dev/null && break; sleep 0.5; done

for f in "$P"/supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
"${PSQL[@]}" -f "$P/supabase/seed.sql"

cat > "$T/pgrst.conf" <<CONF
db-uri = "postgres://authenticator@127.0.0.1:54322/postgres"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$JWT_SECRET"
server-host = "127.0.0.1"
server-port = 3001
CONF
"$T/bin/postgrest" "$T/pgrst.conf" > "$T/logs/postgrest.log" 2>&1 &
PIDS+=($!)
STORAGE_DIR="$T/storage" DB_URL="postgres://postgres@127.0.0.1:54322/postgres" node "$E/gateway.mjs" > "$T/logs/gateway.log" 2>&1 &
PIDS+=($!)

ANON=$(node -e '
const c=require("crypto"),b=o=>Buffer.from(JSON.stringify(o)).toString("base64url");
const h=b({alg:"HS256",typ:"JWT"}),p=b({role:"anon",iss:"supabase",iat:1700000000,exp:2000000000});
console.log(h+"."+p+"."+c.createHmac("sha256",process.env.JWT_SECRET).update(h+"."+p).digest("base64url"))')

cd "$P"
export NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON" NEXT_PUBLIC_APP_URL=http://localhost:3000
npx next build > "$T/logs/build.log" 2>&1 || { tail -30 "$T/logs/build.log"; exit 1; }
npx next start -p 3000 > "$T/logs/next.log" 2>&1 &
PIDS+=($!)
for _ in $(seq 1 60); do curl -s -o /dev/null http://localhost:3000/login && break; sleep 0.5; done

OUT="$T/out" node "$E/ablauf.mjs"
