#!/bin/sh
#
# The image HEALTHCHECK: healthy once the SSO gate answers /auth/status.
#
# That endpoint is answered by the gate itself, without a session and without
# contacting the identity provider, and the gate's listener is bound only after
# the whole plugin tree has applied — so a 200 means the composition loaded,
# not merely that a port is open. Node rather than curl: the slim base image
# ships no HTTP client, and the runtime already carries node.
host=${SSO_BIND_HOST:-0.0.0.0}
case $host in
  0.0.0.0|::|'') host=127.0.0.1 ;;
esac

# shellcheck disable=SC2016 # the single-quoted body is JavaScript, not shell
exec node -e '
const url = `http://${process.argv[1]}:${process.argv[2]}/auth/status`
fetch(url, { signal: AbortSignal.timeout(4000) })
  .then(res => process.exit(res.ok ? 0 : 1), () => process.exit(1))
' "$host" "${SSO_PORT:-3080}"
