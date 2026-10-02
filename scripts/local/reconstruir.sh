#!/usr/bin/env bash
# Reconstruye el Supabase LOCAL de cero: esquema, migraciones, usuaria y datos
# de ejemplo. Es repetible y no toca absolutamente nada de producción.
#
#   npx supabase start            # una vez, si no está levantado
#   bash scripts/local/reconstruir.sh
#
set -euo pipefail
cd "$(dirname "$0")/../.."

DB=supabase_db_Opynio
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

if ! docker ps --format '{{.Names}}' | grep -q "^$DB$"; then
  echo "El Supabase local no está levantado. Ejecuta antes:  npx supabase start"
  exit 1
fi

# Tras reiniciar la maquina, «supabase start» deja a veces el runtime de las
# Edge Functions parado, y entonces el widget responde 503 («Error del
# servidor») sin mas pista. Se levanta aqui para no perseguir ese fantasma.
if ! docker ps --format '{{.Names}}' | grep -q '^supabase_edge_runtime_Opynio$'; then
  echo "==> 0. levantando el runtime de Edge Functions, que estaba parado"
  docker start supabase_edge_runtime_Opynio > /dev/null 2>&1 ||     echo "    (no se pudo; el widget no funcionara hasta arreglarlo)"
fi

echo "==> 1. base limpia"
npx --no-install supabase db reset > /dev/null 2>&1

echo "==> 2. esquema base, extraído del documento"
# Se lee de docs/01-DATABASE-SETUP.md a propósito: así cada reconstrucción
# comprueba que ese documento sigue siendo ejecutable de arriba abajo.
python - "$TMP/doc.sql" <<'PY'
import io, sys
doc = io.open('docs/01-DATABASE-SETUP.md', encoding='utf-8').read().split('\n')
sql, dentro = [], False
for l in doc:
    if l.strip().startswith('```sql'): dentro = True; continue
    if dentro and l.strip() == '```': dentro = False; continue
    if dentro: sql.append(l)
io.open(sys.argv[1], 'w', encoding='utf-8', newline='\n').write('\n'.join(sql))
PY
docker exec -i $DB psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$TMP/doc.sql" > /dev/null

echo "==> 3. migraciones que el documento no cubre"
for m in 20260528160000_unique_review_per_user_business \
         20260824200000_widget_business_stats_rpc \
         20260824210000_business_review_stats_rpc \
         20260824220000_review_stats_batch_rpc \
         20260824230000_business_analytics_rpc \
         20260825120000_source_counts_and_empty_businesses \
         20260915143000_add_logo_tone \
         20260915144500_directory_rpc_logo_tone \
         20260915150000_logo_tone_reset_trigger \
         20260917120000_review_subjects \
         20260917121000_widget_subject_rpcs \
         create_business_directory_function \
         create_claims_table \
         create_review_votes_system \
         fix_bug_reports_rls; do
  if docker exec -i $DB psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q \
       < "supabase/migrations/$m.sql" > /dev/null 2>&1; then
    echo "    ok    $m"
  else
    echo "    FALLA $m"
  fi
done

echo "==> 4. fichero de entorno, generado desde el stack"
# Se genera en vez de escribirlo a mano: las claves las decide la CLI, y así no
# se quedan desfasadas ni hay que copiarlas de ningún sitio.
npx --no-install supabase status -o json > "$TMP/estado.json"
python - "$TMP/estado.json" <<'PY'
import io, json, sys
d = json.load(io.open(sys.argv[1], encoding='utf-8'))
url = d.get('API_URL') or 'http://127.0.0.1:54321'
anon = d.get('ANON_KEY') or ''
io.open('.env.docker.local', 'w', encoding='utf-8', newline='\n').write(
    '# Generado por scripts/local/reconstruir.sh. No editar a mano.\n'
    '#\n'
    '# Apunta la aplicación al Supabase local de Docker en lugar de a producción.\n'
    '# Vite solo lee este fichero con --mode docker, así que tu «npm run dev» de\n'
    '# siempre sigue yendo a producción sin enterarse de que esto existe.\n'
    '#\n'
    '# La clave es la anónima que genera la CLI para el entorno local: es pública\n'
    '# por diseño, idéntica en cualquier instalación y no da acceso a nada tuyo.\n'
    '# Aun así el fichero está ignorado por git (regla *.local).\n'
    '\n'
    'VITE_SUPABASE_URL=' + url + '\n'
    'VITE_SUPABASE_ANON_KEY=' + anon + '\n')
print('    .env.docker.local -> ' + url)
PY

echo "==> 5. usuaria, por la API de Auth como en producción"
ANON=$(python -c "import io,json,sys;print(json.load(io.open(sys.argv[1],encoding='utf-8')).get('ANON_KEY',''))" "$TMP/estado.json")
curl -s -X POST "http://127.0.0.1:54321/auth/v1/signup" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"email":"jefa@local.test","password":"prueba-local-1234","data":{"name":"Jefa de prueba"}}' > /dev/null
docker exec -i $DB psql -U postgres -d postgres -q -c \
  "UPDATE public.profiles SET role='business_owner', plan='pro' WHERE id=(SELECT id FROM auth.users WHERE email='jefa@local.test');"

echo "==> 6. empresa, catálogo y reseñas"
docker exec -i $DB psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < scripts/local/datos.sql

docker exec -i $DB psql -U postgres -d postgres -Atc "
select '    empresa: '||name||' ('||slug||')' from businesses;
select '    productos: '||count(*) from review_subjects;
select '    resenas: '||count(*)||' | enlazadas: '||(select count(*) from review_subject_links) from reviews;"

echo
echo "Listo. Arranca la aplicación contra este entorno con:"
echo "    npx vite --mode docker --port 8768"
echo "Usuaria: jefa@local.test / prueba-local-1234"
