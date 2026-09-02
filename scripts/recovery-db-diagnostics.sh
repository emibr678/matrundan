#!/usr/bin/env bash
set -uo pipefail

failures=()

die() {
  failures+=("$1")
}

have_command() {
  command -v "$1" >/dev/null 2>&1
}

classify_psql_error() {
  local stderr_file="$1"
  local detail=""

  if [[ -f "$stderr_file" ]]; then
    detail="$(<"$stderr_file")"
  fi
  detail="${detail,,}"

  case "$detail" in
    *"password authentication failed"*|*"no password supplied"*|*"sasl authentication failed"*)
      printf '%s' "authentication_failed"
      ;;
    *"tenant or user not found"*)
      printf '%s' "pooler_tenant_or_user_failed"
      ;;
    *"could not translate host name"*|*"name or service not known"*|*"temporary failure in name resolution"*|*"nodename nor servname"*)
      printf '%s' "dns_failed"
      ;;
    *"connection refused"*)
      printf '%s' "connection_refused"
      ;;
    *"connection timed out"*|*"timeout expired"*)
      printf '%s' "connection_timeout"
      ;;
    *"network is unreachable"*|*"no route to host"*)
      printf '%s' "network_unreachable"
      ;;
    *"invalid uri"*|*"invalid connection option"*|*"invalid percent-encoded"*|*"missing \"=\" after"*)
      printf '%s' "invalid_connection_uri"
      ;;
    *"ssl"*|*"certificate"*)
      printf '%s' "tls_failed"
      ;;
    *)
      printf '%s' "connection_failed_other"
      ;;
  esac
}

probe_container_network() {
  local network_mode="$1"
  local host="$2"
  local port="$3"
  local -a network_args=()
  local output=""

  if [[ "$network_mode" == "host" ]]; then
    network_args=(--network host)
  elif [[ "$network_mode" == "bridge" ]]; then
    network_args=(--network bridge)
  else
    printf '%s' "unavailable|unavailable|unavailable"
    return 0
  fi

  output="$(
    RECOVERY_DIAG_HOST="$host" RECOVERY_DIAG_PORT="$port" \
      docker run --rm "${network_args[@]}" \
      --env RECOVERY_DIAG_HOST \
      --env RECOVERY_DIAG_PORT \
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

        printf "%s|%s|%s" "$ipv4" "$ipv6" "$tcp"
      ' 2>/dev/null || true
  )"

  if [[ "$output" =~ ^(resolved|unresolved|unavailable)\|(resolved|unresolved|unavailable)\|(reachable|unreachable|unavailable)$ ]]; then
    printf '%s' "$output"
  else
    printf '%s' "unavailable|unavailable|unavailable"
  fi
}

probe_psql_network() {
  local network_mode="$1"
  local stderr_file="$2"
  local -a network_args=()
  local version_num=""
  local classification=""

  if [[ "$network_mode" == "host" ]]; then
    network_args=(--network host)
  elif [[ "$network_mode" == "bridge" ]]; then
    network_args=(--network bridge)
  else
    printf '%s' "unavailable"
    return 0
  fi

  if version_num="$(
    docker run --rm "${network_args[@]}" \
      --env SUPABASE_DB_URL \
      "${POSTGRES_CLIENT_IMAGE:-postgres:17-bookworm}" \
      bash -c '
        psql "$SUPABASE_DB_URL" \
          -X \
          --no-psqlrc \
          --tuples-only \
          --no-align \
          --set ON_ERROR_STOP=1 \
          --command "show server_version_num"
      ' 2>"$stderr_file" | tr -d '[:space:]'
  )"; then
    rm -f -- "$stderr_file"
    if [[ "$version_num" =~ ^[0-9]+$ ]]; then
      printf 'success_postgres_%s' "$((version_num / 10000))"
    else
      printf '%s' "unexpected_server_version"
    fi
    return 0
  fi

  classification="$(classify_psql_error "$stderr_file")"
  rm -f -- "$stderr_file"
  printf '%s' "$classification"
}

runner_os="${RUNNER_OS:-$(uname -s 2>/dev/null || printf 'unknown')}"
temp_root="${RECOVERY_RUNNER_TEMP:-${RUNNER_TEMP:-/tmp}}"

if [[ "$runner_os" != "Linux" ]]; then
  die "Recovery DB diagnostics require a Linux runner; actual OS is $runner_os."
fi

for command in node docker getent timeout; do
  if ! have_command "$command"; then
    die "Missing diagnostics command: $command."
  fi
done

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  die "Missing recovery database URL."
fi

if have_command docker && ! docker info >/dev/null 2>&1; then
  die "Docker CLI is present but the Docker daemon is unavailable."
fi

if (( ${#failures[@]} > 0 )); then
  printf 'Recovery DB diagnostics could not start:\n' >&2
  for failure in "${failures[@]}"; do
    printf ' - %s\n' "$failure" >&2
  done
  exit 1
fi

target="$(
  node -e '
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
)" || {
  echo "Recovery DB diagnostics: connection URI could not be parsed safely." >&2
  exit 1
}

IFS=$'\t' read -r host port <<< "$target"
if [[ -z "$host" || ! "$host" =~ ^[A-Za-z0-9.-]+$ || ! "$port" =~ ^[0-9]+$ ]]; then
  echo "Recovery DB diagnostics: parsed target metadata was not safe to report." >&2
  exit 1
fi
if (( port < 1 || port > 65535 )); then
  echo "Recovery DB diagnostics: parsed port was outside the valid TCP range." >&2
  exit 1
fi
if [[ "$host" != *.supabase.com && "$host" != *.supabase.co ]]; then
  echo "Recovery DB diagnostics: target is not a Supabase hostname; host withheld." >&2
  exit 1
fi

target_kind="other_supabase"
if [[ "$host" == *.pooler.supabase.com && "$port" == "5432" ]]; then
  target_kind="session_pooler"
elif [[ "$host" == *.pooler.supabase.com && "$port" == "6543" ]]; then
  target_kind="transaction_pooler"
elif [[ "$host" == db.*.supabase.co ]]; then
  target_kind="direct"
fi

runner_ipv4="unresolved"
runner_ipv6="unresolved"
runner_tcp="unreachable"
if getent ahostsv4 "$host" >/dev/null 2>&1; then runner_ipv4="resolved"; fi
if getent ahostsv6 "$host" >/dev/null 2>&1; then runner_ipv6="resolved"; fi
if timeout 5 bash -c 'exec 3<>"/dev/tcp/$1/$2"' _ "$host" "$port" >/dev/null 2>&1; then runner_tcp="reachable"; fi

host_network="$(probe_container_network host "$host" "$port")"
bridge_network="$(probe_container_network bridge "$host" "$port")"
IFS='|' read -r host_ipv4 host_ipv6 host_tcp <<< "$host_network"
IFS='|' read -r bridge_ipv4 bridge_ipv6 bridge_tcp <<< "$bridge_network"

psql_host="$(probe_psql_network host "$temp_root/matrundan-diagnostics-psql-host.stderr")"
psql_bridge="$(probe_psql_network bridge "$temp_root/matrundan-diagnostics-psql-bridge.stderr")"

printf 'Recovery DB diagnostics: target_kind=%s host=%s port=%s\n' "$target_kind" "$host" "$port"
printf 'Recovery DB diagnostics: runner dns_ipv4=%s dns_ipv6=%s tcp=%s\n' "$runner_ipv4" "$runner_ipv6" "$runner_tcp"
printf 'Recovery DB diagnostics: docker_host dns_ipv4=%s dns_ipv6=%s tcp=%s psql=%s\n' "$host_ipv4" "$host_ipv6" "$host_tcp" "$psql_host"
printf 'Recovery DB diagnostics: docker_bridge dns_ipv4=%s dns_ipv6=%s tcp=%s psql=%s\n' "$bridge_ipv4" "$bridge_ipv6" "$bridge_tcp" "$psql_bridge"

echo "Recovery DB diagnostics completed without writes, backups or restores."
