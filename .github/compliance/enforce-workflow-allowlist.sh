#!/usr/bin/env bash
#
# Make the repository's enabled GitHub Actions workflows match
# .github/compliance/workflows.allowlist: enable what is listed, disable
# everything else.
#
# Runs in CI (compliance-workflow-allowlist.yml) with a GITHUB_TOKEN holding
# `actions: write`, or by hand with an authenticated `gh`:
#
#   GITHUB_REPOSITORY=compliancehcm/compliance-harness DRY_RUN=1 \
#     .github/compliance/enforce-workflow-allowlist.sh
#
# `dynamic/*` workflows (Dependabot, CodeQL default setup, Pages) belong to
# repository settings rather than to files, and are left alone.
set -euo pipefail

repo=${GITHUB_REPOSITORY:?set GITHUB_REPOSITORY to owner/name}
dry_run=${DRY_RUN:-0}
allowlist_file=$(dirname "$0")/workflows.allowlist

die() { printf 'workflow-allowlist: %s\n' "$*" >&2; exit 1; }

mapfile -t allowed < <(sed -e 's/#.*//' -e 's/[[:space:]]*$//' "$allowlist_file" | grep -v '^$')
(( ${#allowed[@]} > 0 )) || die "$allowlist_file lists no workflow; refusing to disable all of them"

is_allowed() {
  local candidate=$1 entry
  for entry in "${allowed[@]}"; do [[ $entry == "$candidate" ]] && return 0; done
  return 1
}

# id, path, state for every workflow GitHub has registered, disabled ones included.
mapfile -t workflows < <(gh api --paginate "repos/$repo/actions/workflows" \
  --jq '.workflows[] | [.id, .path, .state] | @tsv')

# Checked against the tree rather than against GitHub's list: a workflow added
# on a branch is not registered until it reaches the default branch, and the
# allowlist has to be able to name it before then.
repo_root=$(cd "$(dirname "$0")/../.." && pwd)
for entry in "${allowed[@]}"; do
  [[ -f $repo_root/$entry ]] \
    || die "allowlisted $entry does not exist (renamed, deleted, or a typo?)"
done

summary=('| Workflow | Before | After |' '|---|---|---|')
changes=0
for row in "${workflows[@]}"; do
  IFS=$'\t' read -r id path state <<<"$row"
  [[ $path == dynamic/* ]] && continue
  # A workflow whose file is gone cannot run; there is nothing to switch.
  [[ $state == deleted ]] && continue

  if is_allowed "$path"; then want=active; else want=disabled_manually; fi
  if [[ $state == "$want" ]] || [[ $want == disabled_manually && $state == disabled_* ]]; then
    summary+=("| \`$path\` | $state | unchanged |")
    continue
  fi

  action=$([[ $want == active ]] && echo enable || echo disable)
  if [[ $dry_run == 1 ]]; then
    printf 'would %s %s (%s)\n' "$action" "$path" "$state"
  else
    gh api -X PUT "repos/$repo/actions/workflows/$id/$action" >/dev/null
    printf '%sd %s (was %s)\n' "$action" "$path" "$state"
  fi
  summary+=("| \`$path\` | $state | **${action}d** |")
  changes=$((changes + 1))
done

printf 'workflow-allowlist: %d change(s)%s\n' "$changes" "$([[ $dry_run == 1 ]] && echo ' (dry run)')"
if [[ -n ${GITHUB_STEP_SUMMARY:-} ]]; then
  { echo '### Workflow allowlist'; echo; printf '%s\n' "${summary[@]}"; } >> "$GITHUB_STEP_SUMMARY"
fi
