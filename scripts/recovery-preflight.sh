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

classify_psql_connection_error() {
  local stderr_file="$1"
  local detail=""

  if [[ -f "$stderr_file" ]]; then
    detail="$(<"$stderr_file")"
  fi
  detail="${detail,,}"

  case "$detail" in
    *"password authentication failed"*|*"no password supplied"*|*"sasl authentication failed"*)
      printf '%s' "PostgreSQL authentication failed; verify the database password in the recovery URL."
      ;;
    *"tenant or user not found"*)
      printf '%s' "Supabase pooler rejected the tenant/user identifier; verify the pooler host and project-scoped database user."
      ;;
    *"could not translate host name"*|*"name or service not known"*|*"temporary failure in name resolution"*|*"nodename nor servname"*)
      printf '%s' "The database host could not be resolved (DNS)."
      ;;
    *"connection refused"*)
      printf '%s' "The database host refused the connection."
      ;;
    *"connection timed out"*|*"timeout expired"*)
      printf '%s' "The database connection timed out."
      ;;
    *"network is unreachable"*|*"no route to host"*)
      printf '%s' "The recovery runner has no network route to the database host."
      ;;
    *"invalid uri"*|*"invalid connection option"*|*"invalid percent-encoded"*|*"missing \"=\" after"*)
      printf '%s' "The recovery database URL is not a valid PostgreSQL connection URI."
      ;;
    *"database "*" does not exist"*)
      printf '%s' "The configured database name does not exist."
      ;;
    *"ssl"*|*"certificate"*)
      printf '%s' "The database TLS/SSL connection failed."
      ;;
    *)
      printf '%s' "PostgreSQL rejected the connection; raw stderr was withheld because it may contain connection metadata."
      ;;
  esac
}

report_recovery_db_network_diagnostics() {
  local target=""
  local host=""
  local port=""
  local runner_ipv4="unavailable"
  local runner_ipv6="unavailable"
  local runner_tcp="unavailable"
  local container_ipv4="unavailable"
  local container_ipv6="unavailable"
  local container_tcp="unavailable"
  local container_status=""

  if ! target="$(
    bun -e '
      const raw = process.env.SUPABASE_DB_URL ?? "";
      try {
        const url = new URL(raw);
        if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") process.exit(2);
        if (!url.hostname) process.exit(3);
        process.stdout.write(`${url.hostname}\t${url.port || "5432"}`);
      } catch {
        process.exit(1);
      }
    ' 2>/dev/null
  )"; then
    printf '%s\n' "Recovery DB diagnostics: connection URI could not be parsed safely; target metadata withheld."
    return 0
  fi

  IFS=$'\t' read -r host port <<< "$target"
  if [[ -z "$host" || ! "$host" =~ ^[A-Za-z0-9._:-]+$ || ! "$port" =~ ^[0-9]+$ ]]; then
    printf '%s\n' "Recovery DB diagnostics: parsed target metadata was not safe to report."
    return 0
  fi

  if have_command getent; then
    if getent ahostsv4 "$host" >/dev/null 2>&1; then runner_ipv4="resolved"; else runner_ipv4="unresolved"; fi
    if getent ahostsv6 "$host" >/dev/null 2>&1; then runner_ipv6="resolved"; else runner_ipv6="unresolved"; fi
  fi

  if have_command timeout; then
    if timeout 5 bash -c 'exec 3<>"/dev/tcp/$1/$2"' _ "$host" "$port" >/dev/null 2>&1; then
      runner_tcp="reachable"
    else
      runner_tcp="unreachable"
    fi
  fi

  if $docker_ready; then
    container_status="$(
      docker run --rm --network host \
        -e RECOVERY_DIAG_HOST="$host" \
        -e RECOVERY_DIAG_PORT="$port" \
        "${POSTGRES_CLIENT_IMAGE:-postgres:17-bookworm}" \
        bash -c '
          set -u
          ipv4="unavailable"
          ipv6="unavailable"
          tcp="unavailable"

          if command -v getent >/dev/null 2>&1; then
            if getent ahostsv4 "$RECOVERY_DIAG_HOST" >/dev/null 2>&1; then ipv4="resolved"; else ipv4="unresolved"; fi
            if getent ahostsv6 "$RECOVERY_DIAG_HOST" >/dev/null 2>&1; then ipv6="resolved"; else ipv6="unresolved"; fi
          fi

          if command -v timeout >/dev/null 2>&1; then
            if timeout 5 bash -c '\''exec 3<>"/dev/tcp/$1/$2"'\'' _ "$RECOVERY_DIAG_HOST" "$RECOVERY_DIAG_PORT" >/dev/null 2>&1; then
              tcp="reachable"
            else
              tcp="unreachable"
            fi
          fi

          printf "%s\\t%s\\t%s" "$ipv4" "$ipv6" "$tcp"
        ' 2>/dev/null || true
    )"
    if [[ -n "$container_status" ]]; then
      IFS=$'\t' read -r container_ipv4 container_ipv6 container_tcp <<< "$container_status"
    fi
  fi

  printf 'Recovery DB diagnostics: host=%s port=%s runner_dns_ipv4=%s runner_dns_ipv6=%s runner_tcp=%s container_dns_ipv4=%s container_dns_ipv6=%s container_tcp=%s\n' \
    "$host" "$port" "$runner_ipv4" "$runner_ipv6" "$runner_tcp" "$container_ipv4" "$container_ipv6" "$container_tcp"
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
  elif [[ "$psql_version" =~ PostgreSQL\)?[[:space:]]+([0-9]+) ]]; then
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
  elif [[ "$pg_dump_version" =~ PostgreSQL\)?[[:space:]]+([0-9]+) ]]; then
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
  remote_stderr_file="$RECOVERY_RUNNER_TEMP/matrundan-psql-connection.stderr"
  remote_version_num=""

  if remote_version_num="$(
    psql "$SUPABASE_DB_URL" \
      -X \
      --no-psqlrc \
      --tuples-only \
      --no-align \
      --set ON_ERROR_STOP=1 \
      --command "show server_version_num" \
      2>"$remote_stderr_file" | tr -d '[:space:]'
  )"; then
    rm -f -- "$remote_stderr_file"
    if [[ ! "$remote_version_num" =~ ^[0-9]+$ ]]; then
      fail "Source database returned an unexpected server_version_num response."
    else
      remote_major=$((remote_version_num / 10000))
      if [[ "$remote_major" != "$expected_postgres_major" ]]; then
        fail "Source database major version must be $expected_postgres_major; got $remote_major."
      fi
    fi
  else
    connection_detail="$(classify_psql_connection_error "$remote_stderr_file")"
    rm -f -- "$remote_stderr_file"
    report_recovery_db_network_diagnostics
    fail "Could not connect to the source database. $connection_detail"
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
