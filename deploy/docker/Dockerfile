# syntax=docker/dockerfile:1.7
#
# Compliance AI harness image: the dsh web UI with this deployment's five
# compliance plugins already composed — the SSO gate, per-user tenancy, the
# brand occupants, the user menu and the ALMA MCP connection.
#
# Two things decide the shape of this file:
#
#  1. The gateway plugins (`plugins/sso-auth`, `plugins/compliance-tenancy`) are
#     TypeScript with `main: index.ts`, so the gateway process must be the tsx
#     source launch (`apps/cli/src/bin.ts`). That means the image ships the
#     repository and its dev dependencies, not a pruned production tree.
#  2. Per-user backends deliberately run the BUILT CLI (`apps/cli/lib/bin.js`)
#     under plain node — tsx would resolve workspace imports against the jail's
#     cwd, which has no `node_modules`. So `pnpm run build` runs at image build
#     time and its output is part of the image.
#
# Build context is the repository root:
#   docker build -f deploy/docker/Dockerfile \
#     --build-arg DSH_CLIENT_COMMIT_HASH="$(git rev-parse HEAD)" -t compliance-ai .

ARG NODE_IMAGE=node:24-bookworm-slim

# ── build ─────────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS builder

# CI=true is not decoration: scripts/install-lefthook.mjs skips the git-hook
# install under it, and the build context carries no .git.
ENV CI=true \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    DSH_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS=--max-old-space-size=4096

# node-pty and koffi are `allowBuilds: true` in pnpm-workspace.yaml, so the
# install compiles native addons and needs a toolchain.
RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential python3 \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

WORKDIR /app
COPY . .

# The client build stamps the commit into its artifacts and reads it from git
# unless told; the context has no .git, so it is passed in instead.
ARG DSH_CLIENT_COMMIT_HASH
ENV DSH_CLIENT_COMMIT_HASH=${DSH_CLIENT_COMMIT_HASH}

RUN pnpm install --frozen-lockfile
RUN pnpm run build

# The gateway's own dsh home, baked into the image rather than kept on the data
# volume: it holds only the `web` profile composition, which belongs to the
# image, and a mounted volume over it would remove the plugin links below.
ENV DSH_HOME=/opt/compliance-ai/gateway-home

# Overlay rows name packages by SPECIFIER, not by path, so each plugin package
# is linked into the profile before any overlay can resolve it. The
# `declares no dsh.bundle` warning is expected: these are plugins, not bundles.
RUN for plugin in sso-auth compliance-tenancy compliance-brand compliance-user-menu compliance-alma-mcp; do \
      node --import tsx/esm apps/cli/src/bin.ts plugin --profile web add "link:/app/plugins/$plugin" || exit 1; \
    done

# ── runtime ───────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE}

# bubblewrap is the confinement the tenancy plugin probes for at boot; it fails
# loudly rather than serving unconfined, so it must be present even though the
# container also needs the kernel privilege to use it (see the README).
RUN apt-get update \
  && apt-get install -y --no-install-recommends bubblewrap ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app /app
COPY --from=builder /opt/compliance-ai/gateway-home /opt/compliance-ai/gateway-home
COPY deploy/docker/entrypoint.sh /usr/local/bin/compliance-entrypoint

WORKDIR /app

ENV CI=true \
    NODE_ENV=production \
    DSH_HOME=/opt/compliance-ai/gateway-home \
    DSH_TELEMETRY_DISABLED=1 \
    COMPLIANCE_USERS_ROOT=/var/lib/compliance-ai/users \
    COMPLIANCE_HARNESS_ROOT=/app \
    COMPLIANCE_CONFINEMENT=bwrap \
    COMPLIANCE_MAX_BACKENDS=12 \
    COMPLIANCE_IDLE_REAP_MINUTES=15 \
    COMPLIANCE_PORT_RANGE_START=31000 \
    COMPLIANCE_PORT_RANGE_END=31200 \
    COMPLIANCE_FORWARD_CREDENTIALS=DEEPSEEK_API_KEY \
    SSO_BIND_HOST=0.0.0.0 \
    SSO_PORT=3080 \
    SSO_SCOPES="openid profile email" \
    SSO_SESSION_TTL_MINUTES=480 \
    SSO_IDLE_TIMEOUT_MINUTES=60 \
    ALMA_ENABLED=on \
    ALMA_MCP_URL=https://mcp.compliancehcm.com.br/mcp \
    ALMA_SERVER_NAME=alma \
    ALMA_SCOPES="openid profile" \
    ALMA_REFRESH_SKEW_SECONDS=120 \
    ALMA_TOOL_CALL_TIMEOUT_MS=300000

# One volume, and it is the one holding user data: every user's workspace,
# sessions, settings and credentials live under it.
VOLUME ["/var/lib/compliance-ai/users"]

EXPOSE 3080

ENTRYPOINT ["/usr/local/bin/compliance-entrypoint"]
