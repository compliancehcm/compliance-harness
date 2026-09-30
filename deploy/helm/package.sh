#!/usr/bin/env bash
#
# Package the chart pinned to one published image.
#
# The chart in the tree defaults to `appVersion: latest` and no digest, which is
# right for a checkout and wrong for a release: a published chart must install
# exactly the image CI booted. This writes the digest into a copy of the chart
# and packages that copy, so the tree itself is never modified.
#
# Usage: deploy/helm/package.sh <chart-version> <app-version> <image-digest> <out-dir>
#   e.g. deploy/helm/package.sh 0.1.0-master.42 sha-<commit> sha256:<hex> dist
set -euo pipefail

version=${1:?chart version}
app_version=${2:?app version (the image tag)}
digest=${3:?image digest}
out_dir=${4:?output directory}

die() { printf 'helm-package: %s\n' "$*" >&2; exit 1; }

[[ $digest =~ ^sha256:[0-9a-f]{64}$ ]] || die "not an image digest: $digest"

src=$(cd "$(dirname "$0")/compliance-ai" && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
cp -R "$src" "$work/compliance-ai"

# Only the `digest:` directly under the top-level `image:` block.
values=$work/compliance-ai/values.yaml
sed -i "/^image:/,/^[^ #]/ s|^  digest: \"\"|  digest: \"$digest\"|" "$values"
grep -qxF "  digest: \"$digest\"" "$values" \
  || die "could not pin the digest in values.yaml; is image.digest still \"\"?"

mkdir -p "$out_dir"
helm package "$work/compliance-ai" --version "$version" --app-version "$app_version" \
  --destination "$out_dir"
