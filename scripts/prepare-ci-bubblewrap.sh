#!/usr/bin/env bash
set -euo pipefail

# Ubuntu's package transaction scans the hosted image's full dpkg database and
# runs post-install hooks. CI needs only the archive payload, so this fetches
# and verifies that payload and extracts it into the ephemeral runner directory,
# without ever running an install.
#
# The version is resolved from the runner's own signed package index rather than
# pinned here. A hardcoded `pool/` URL rots: the pool carries only the CURRENT
# version of a package, so the day a security update supersedes the pinned one
# every lane using this script dies on a 404 — which is what happened to
# `bubblewrap_0.9.0-1ubuntu0.1_amd64.deb`. Integrity does not come from the
# constant either way: it comes from the digest apt publishes in an index whose
# signature apt has already checked, which is the same chain `apt-get install`
# trusts.

: "${RUNNER_TEMP:?prepare-ci-bubblewrap requires RUNNER_TEMP}"
: "${GITHUB_PATH:?prepare-ci-bubblewrap requires GITHUB_PATH}"

if [[ "$(uname -s)" != 'Linux' || "$(uname -m)" != 'x86_64' ]]; then
  echo 'prepare-ci-bubblewrap supports only Linux x86_64 hosted runners' >&2
  exit 1
fi

# Index only — no dpkg database scan, no maintainer scripts. A hosted image's
# cached index can itself be old enough to name a superseded file.
sudo apt-get update -qq

# `'<uri>' <filename> <size> <ALGO>:<digest>`, one line for a single package.
uris=$(apt-get download --print-uris bubblewrap | grep -- '_amd64\.deb' | tail -n 1)
if [[ -z "$uris" ]]; then
  echo 'prepare-ci-bubblewrap: apt named no amd64 bubblewrap archive' >&2
  exit 1
fi

read -r quoted_url filename _size digest <<<"$uris"
url=${quoted_url//\'/}
algorithm=${digest%%:*}
expected=${digest#*:}

case "$algorithm" in
  SHA512) checker='sha512sum' ;;
  SHA256) checker='sha256sum' ;;
  # Refused rather than accepted: a weak digest would make the verification
  # below look like a check while proving nothing.
  *) echo "prepare-ci-bubblewrap: apt offered only ${algorithm}, which is not accepted here" >&2; exit 1 ;;
esac

archive="${RUNNER_TEMP}/${filename}"
root="${RUNNER_TEMP}/dsh-bubblewrap"

echo "prepare-ci-bubblewrap: ${filename} from ${url} (${algorithm})"
curl --fail --silent --show-error --location --retry 3 --retry-all-errors --output "$archive" "$url"
printf '%s  %s\n' "$expected" "$archive" | "$checker" --check --status
mkdir -p "$root"
dpkg-deb --extract "$archive" "$root"
printf '%s\n' "$root/usr/bin" >> "$GITHUB_PATH"

sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0 \
  || echo 'apparmor userns knob absent — the functional probe decides'
"$root/usr/bin/bwrap" --version
"$root/usr/bin/bwrap" --ro-bind / / --dev /dev --unshare-pid --proc /proc --die-with-parent -- true
echo 'bubblewrap functional probe passed'
