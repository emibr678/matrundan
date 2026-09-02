#!/usr/bin/env bash
set -uo pipefail

failures=()

fail() {
  failures+=("$1")
}

have_command() {
  command -v "$1" >/dev/null 2>&1
}

capture_version() {
  local command_name="$1"
  local temp_root="${RECOVERY_RUNNER_TEMP:-${RUNNER_TEMP:-/tmp}}"
  local stderr_file="$temp_root/matrundan-${command_name}-version.stderr"
  local output=""

  if output="$("$command_name" --version 2>"$stderr_file")"; then
    rm -f -- "$stderr_file"
    printf '%s' "$output"
    return 0
  fi

  local detail=""
  if [[ -f "$stderr_file" ]]; then
    detail="$(<"$stderr_file")"
    rm -f -- "$stderr_file"
  fi
  detail="${detail//$'\r'/ }"
  detail="${detail//$'\n'/ }"
  detail="${detail:0:300}"
  printf '%s' "${detail:-command failed without stderr}"
  return 1
}

expected_postgres_major="${POSTGRES_MAJOR:-17}"
min_free_kb="${RECOVERY_MIN_FREE_KB:-10485760}"
runner_os="${RUNNER_OS:-$(uname -s 2>/dev/null || printf 'unknown')}"

if [[ "$runner_os" != "Linux" ]]; then
  fail "Recovery restore drill requires a Linux runner; actual OS is $runner_os."
fi

for name in SOURCE_SUPABASE_URL SOURCE_SUPABASE_SERVICE_ROLE_KEY SUPABASE_DB_URL SUPABASE_CLI_VERSION RECOVERY_RUNNER_TEMP; do
  if [[ -z "${!name:-}" ]]; then
    fail "Missing recovery environment value: $name."
  fi
done

for command in docker supabase bun psql pg_dump df; do
  if ! have_command "$command"; then
    fail "Missing recovery command: $command."
  fi
done

docker_ready=false
if have_command docker; then
  if docker info >/dev/null 2>&1; then
    docker_ready=true
    docker_os="$(docker info --format '{{.OSType}}' 2>/dev/null || true)"
    if [[ "$docker_os" != "linux" ]]; then
      fail "Docker daemon must provide Linux containers; reported OSType is ${docker_os:-unknown}."
    fi
  else
    fail "Docker CLI is present but the Docker daemon is unavailable."
  fi
fi

if have_command supabase && [[ -n "${SUPABASE_CLI_VERSION:-}" ]]; then
  actual_supabase_version="$(supabase --version 2>/dev/null || true)"
  if [[ "$actual_supabase_version" != "$SUPABASE_CLI_VERSION" ]]; then
    fail "Supabase CLI version mismatch: expected $SUPABASE_CLI_VERSION, got ${actual_supabase_version:-unavailable}."
  fi
fi

if have_command bun; then
  expected_bun_version="$(
    bun -e 'const value = (await Bun.file("package.json").json()).packageManager ?? ""; process.stdout.write(value.replace(/^bun@/, ""));' \
      2>/dev/null || true
  )"
  actual_bun_version="$(bun --version 2>/dev/null || true)"
  if [[ -z "$expected_bun_version" || "$actual_bun_version" != "$expected_bun_version" ]]; then
    fail "Bun version mismatch: expected ${expected_bun_version:-unknown}, got ${actual_bun_version:-unavailable}."
  fi
fi

psql_ready=false
if have_command psql; then
  psql_version=""
  if ! psql_version="$(capture_version psql)"; then
    fail "Could not run psql --version: $psql_version"
  elif [[ "$psql_version" =~ PostgreSQL[[:space:]]+([0-9]+) ]]; then
    if [[ "${BASH_REMATCH[1]}" != "$expected_postgres_major" ]]; then
      fail "psql major version must be $expected_postgres_major; got ${BASH_REMATCH[1]}."
    else
      psql_ready=true
    fi
  else
    fail "Could not verify psql version from output: ${psql_version:0:120}."
  fi
fi

if have_command pg_dump; then
  pg_dump_version=""
  if ! pg_dump_version="$(capture_version pg_dump)"; then
    fail "Could not run pg_dump --version: $pg_dump_version"
  elif [[ "$pg_dump_version" =~ PostgreSQL[[:space:]]+([0-9]+) ]]; then
    if [[ "${BASH_REMATCH[1]}" != "$expected_postgres_major" ]]; then
      fail "pg_dump major version must be $expected_postgres_major; got ${BASH_REMATCH[1]}."
    fi
  else
    fail "Could not verify pg_dump version from output: ${pg_dump_version:0:120}."
  fi
fi

config_major="$(
  awk '
    /^\[db\][[:space:]]*$/ { in_db = 1; next }
    /^\[/ { in_db = 0 }
    in_db && /^[[:space:]]*major_version[[:space:]]*=/ {
      value = $0
      sub(/^[^=]*=[[:space:]]*/, "", value)
      gsub(/[[:space:]]/, "", value)
      print value
      exit
    }
  ' supabase/config.toml 2>/dev/null
)"
if [[ "$config_major" != "$expected_postgres_major" ]]; then
  fail "supabase/config.toml must set [db] major_version = $expected_postgres_major; got ${config_major:-unset}."
fi

if have_command df && [[ -n "${RECOVERY_RUNNER_TEMP:-}" ]]; then
  available_kb="$(df -Pk "$RECOVERY_RUNNER_TEMP" 2>/dev/null | awk 'NR == 2 { print $4 }' || true)"
  if [[ ! "$available_kb" =~ ^[0-9]+$ ]]; then
    fail "Could not determine free disk space for the recovery runner."
  elif (( available_kb < min_free_kb )); then
    fail "Recovery runner has ${available_kb} KiB free; at least ${min_free_kb} KiB is required."
  fi
fi

if $psql_ready && [[ -n "${SUPABASE_DB_URL:-}" ]]; then
  remote_version_num="$(
    psql "$SUPABASE_DB_URL" \
      -X \
      --no-psqlrc \
      --tuples-only \
      --no-align \
      --set ON_ERROR_STOP=1 \
      --command "show server_version_num" \
      2>/dev/null | tr -d '[:space:]' || true
  )"
  if [[ ! "$remote_version_num" =~ ^[0-9]+$ ]]; then
    fail "Could not connect to the source database with the configured recovery DB URL."
  else
    remote_major=$((remote_version_num / 10000))
    if [[ "$remote_major" != "$expected_postgres_major" ]]; then
      fail "Source database major version must be $expected_postgres_major; got $remote_major."
    fi
  fi
fi

if have_command bun && [[ -n "${SOURCE_SUPABASE_URL:-}" && -n "${SOURCE_SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  if ! bun -e '
    import { createClient } from "@supabase/supabase-js";
    const client = createClient(
      process.env.SOURCE_SUPABASE_URL,
      process.env.SOURCE_SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error } = await client.from("groups").select("id", { head: true, count: "exact" });
    if (error) process.exit(1);
  ' >/dev/null 2>&1; then
    fail "Source Supabase service-role API read failed."
  fi
fi

if (( ${#failures[@]} > 0 )); then
  printf 'Recovery preflight found %d blocker(s):\n' "${#failures[@]}" >&2
  for failure in "${failures[@]}"; do
    printf ' - %s\n' "$failure" >&2
  done
  exit 1
fi

echo "Recovery preflight passed: Linux runner, Docker, pinned tooling, disk, source DB and service-role API are ready."
