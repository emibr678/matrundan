#!/usr/bin/env bash
set -euo pipefail
# Synthetic fixtures only. Refuse any remote database, including staging.
race_db_url="${MATRUNDAN_RACE_DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
if [[ "$race_db_url" != postgresql://*'@127.0.0.1:'* && "$race_db_url" != postgresql://*'@localhost:'* ]]; then
  echo "Race tests require a local disposable migration database." >&2
  exit 2
fi
race_tmp="$(mktemp -d)"
actor="38990000-0000-4000-8000-000000000001"
group="38991000-0000-4000-8000-000000000001"
psql_race() { psql "$race_db_url" -X -v ON_ERROR_STOP=1 -At "$@"; }
cleanup() {
  psql_race -c "BEGIN; DELETE FROM public.activity WHERE group_id='$group'; DELETE FROM public.group_places WHERE group_id='$group'; DELETE FROM public.places WHERE added_by='$actor'; SELECT set_config('matrundan.allow_owner_change','on',true); DELETE FROM public.groups WHERE id='$group'; DELETE FROM auth.users WHERE id='$actor'; COMMIT;" >/dev/null
  rm -rf "$race_tmp"
}
trap cleanup EXIT
psql_race -c "INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES('$actor','identity-race@example.invalid','{}'); INSERT INTO public.groups(id,name,created_by) VALUES('$group','Identity race','$actor'); INSERT INTO public.memberships(group_id,user_id,role,status) VALUES('$group','$actor','owner','active');" >/dev/null

for scenario in manual_manual manual_provider provider_manual provider_provider; do
  name="Race $scenario"
  provider_data="jsonb_build_object('externalId','race:$scenario','name','$name','category','café','cuisines','[]'::jsonb,'address','Racegatan 1','city','Teststad','lat',59,'lng',18,'osmType','node','osmId','389900001','fetchedAt',now())"
  manual_data="jsonb_build_object('name','$name','category','café','address','Racegatan 1','city','Teststad','lat',59,'lng',18)"
  manual="PERFORM private.create_manual_place_v2('$actor','$group',$manual_data);"
  provider="PERFORM public.resolve_verified_provider_place_v1('$actor','$group',$provider_data);"
  first="$manual"
  second="$provider"
  case "$scenario" in
    manual_manual) second="$manual" ;;
    provider_manual) first="$provider"; second="$manual" ;;
    provider_provider) first="$provider"; second="$provider" ;;
  esac
  cat > "$race_tmp/first.sql" <<SQL
BEGIN;
SET LOCAL application_name='matrundan_identity_race_first';
DO \$\$ BEGIN $first END; \$\$;
SELECT pg_sleep(1);
COMMIT;
SQL
  cat > "$race_tmp/second.sql" <<SQL
SET statement_timeout='10s';
DO \$\$ BEGIN
  $second
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE '%REUSABLE_PLACE_FOUND%' AND SQLERRM NOT LIKE '%Kartstället finns redan%' THEN RAISE; END IF;
END; \$\$;
SQL
  psql_race -f "$race_tmp/first.sql" > "$race_tmp/first.log" 2>&1 &
  first_pid=$!
  # Observe the first transaction inside its hold, not just shell scheduling.
  observed=0
  for attempt in {1..100}; do
    if [[ "$(psql_race -c "SELECT count(*) FROM pg_stat_activity WHERE application_name='matrundan_identity_race_first' AND wait_event='PgSleep';")" == 1 ]]; then observed=1; break; fi
    sleep 0.02
  done
  if [[ "$observed" != 1 ]]; then echo "First writer never reached its transaction hold." >&2; exit 1; fi
  if ! psql_race -f "$race_tmp/second.sql" > "$race_tmp/second.log" 2>&1; then
    cat "$race_tmp/first.log" "$race_tmp/second.log" >&2
    exit 1
  fi
  if ! wait "$first_pid"; then
    cat "$race_tmp/first.log" >&2
    exit 1
  fi
  count="$(psql_race -c "SELECT count(*) FROM public.places WHERE name='$name';")"
  if [[ "$count" != 1 ]]; then echo "Duplicate place after $scenario: $count" >&2; exit 1; fi
  echo "PASS $scenario: two concurrent sessions, one canonical place"
  psql_race -c "DELETE FROM public.group_places WHERE group_id='$group'; DELETE FROM public.places WHERE added_by='$actor';" >/dev/null
done
