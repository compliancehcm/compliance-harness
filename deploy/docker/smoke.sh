#!/usr/bin/env bash
#
# Boot a built image and check that it serves, before anything publishes it.
#
# A green `docker build` says nothing about whether the container starts: the
# composition is assembled by entrypoint.sh at run time, and a plugin that
# throws in `apply` (a schema the tool registry refuses, a python library the
# runtime stage lacks, an overlay row naming a field that no longer exists)
# only surfaces as `dsh: plugin tree failed to load` once the gateway boots.
#
# Two boots, because the layer lives in two different processes:
#
#  tenancy   The shipped shape. Proves the gateway composition (SSO gate +
#            tenancy supervisor) loads and that bubblewrap works under the run
#            flags the README documents; the tenancy row probes it at boot and
#            refuses to start without it.
#  shared    COMPLIANCE_TENANCY=off. Under tenancy every other plugin loads in a
#            per-user backend that only a real login spawns, so this boot is
#            what applies brand, user menu, OpenRouter, charts, pandas, xlsx,
#            artifacts and ALMA in a process the smoke can reach.
#
# No identity provider is contacted: the gate discovers its issuer lazily, on
# the first login, so a fictitious issuer boots exactly like a real one.
#
# Usage: deploy/docker/smoke.sh <image>
set -euo pipefail

image=${1:?usage: smoke.sh <image>}
boot_timeout=${SMOKE_BOOT_TIMEOUT_SECONDS:-240}

die() { printf 'smoke: %s\n' "$*" >&2; exit 1; }

# Containers are found by label rather than kept in an array: `boot` runs in a
# command substitution, whose variable writes never reach this shell.
run=$$
cleanup() {
  local ids
  mapfile -t ids < <(docker ps -aq --filter "label=compliance-smoke=$run")
  (( ${#ids[@]} == 0 )) || docker rm -f "${ids[@]}" >/dev/null
}
trap cleanup EXIT

# Fail with the container's own output: a boot failure is only diagnosable from
# what the gateway printed before it exited.
fail_with_logs() {
  local name=$1; shift
  printf '::group::%s logs\n' "$name" >&2
  docker logs "$name" >&2 || true
  printf '::endgroup::\n' >&2
  die "$name: $*"
}

# Start one container and wait until the gate answers /auth/status.
# Prints the host address it is reachable on.
boot() {
  local name=$1; shift
  docker run -d --name "$name" --label "compliance-smoke=$run" \
    --cap-add SYS_ADMIN --security-opt apparmor=unconfined \
    -p 127.0.0.1::3080 \
    -e SSO_ISSUER=https://sso.invalid/realms/smoke \
    -e SSO_CLIENT_ID=compliance-ai-smoke \
    -e SSO_PUBLIC_URL=http://127.0.0.1:3080 \
    "$@" "$image" >/dev/null

  local addr='' deadline=$((SECONDS + boot_timeout))
  while (( SECONDS < deadline )); do
    [[ $(docker inspect -f '{{.State.Running}}' "$name") == true ]] \
      || fail_with_logs "$name" "exited before serving (status $(docker inspect -f '{{.State.ExitCode}}' "$name"))"
    [[ -n $addr ]] || addr=$(docker port "$name" 3080/tcp 2>/dev/null | head -n1 || true)
    if [[ -n $addr ]] && curl -fsS -o /dev/null "http://$addr/auth/status" 2>/dev/null; then
      printf '%s' "$addr"
      return 0
    fi
    sleep 2
  done
  fail_with_logs "$name" "did not answer /auth/status within ${boot_timeout}s"
}

# Assert one response: status code, and optionally a header or body fragment.
expect() {
  local name=$1 label=$2 want_status=$3 grep_for=$4; shift 4
  local out status
  out=$(curl -sS -D - -o - "$@") || fail_with_logs "$name" "$label: request failed"
  # Here-strings, not `printf | head` / `printf | grep -q`: both readers exit
  # early, and a response larger than the pipe buffer (the login page inlines
  # its font and logo, ~95 KB) then kills the printf with SIGPIPE, which
  # pipefail turns into a failed smoke on a perfectly healthy container.
  status=$(awk 'NR == 1 { print $2; exit }' <<<"$out")
  [[ $status == "$want_status" ]] \
    || fail_with_logs "$name" "$label: expected HTTP $want_status, got $status"
  if [[ -n $grep_for ]]; then
    grep -qi -- "$grep_for" <<<"$out" \
      || fail_with_logs "$name" "$label: response lacks '$grep_for'"
  fi
  printf 'smoke: %s: %s ok\n' "$name" "$label"
}

# The gate is in front of everything: an anonymous navigation is sent to the
# login interstitial and an anonymous API call is refused, never forwarded.
check_gate() {
  local name=$1 addr=$2
  expect "$name" 'status is anonymous' 200 '"authenticated":false' "http://$addr/auth/status"
  expect "$name" 'navigation is challenged' 302 'location: /auth/login' \
    -H 'Accept: text/html' "http://$addr/"
  expect "$name" 'api call is refused' 401 '' "http://$addr/api/sessions"
  expect "$name" 'login page renders' 200 '' "http://$addr/auth/login"
}

# The Dockerfile's HEALTHCHECK command, run the way the engine runs it.
check_healthcheck() {
  local name=$1
  docker exec "$name" /usr/local/bin/compliance-healthcheck \
    || fail_with_logs "$name" 'the image HEALTHCHECK command failed against a serving gateway'
  printf 'smoke: %s: healthcheck command ok\n' "$name"
}

addr=$(boot "compliance-smoke-tenancy-$run")
check_gate "compliance-smoke-tenancy-$run" "$addr"
check_healthcheck "compliance-smoke-tenancy-$run"

addr=$(boot "compliance-smoke-shared-$run" -e COMPLIANCE_TENANCY=off)
check_gate "compliance-smoke-shared-$run" "$addr"

printf 'smoke: %s boots in both compositions\n' "$image"
