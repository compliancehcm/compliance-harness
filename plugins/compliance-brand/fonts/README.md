# Vendored Inter

`inter-latin-wght-normal.woff2` is the unmodified variable-weight, latin-subset
face from the npm package `@fontsource-variable/inter`. It is committed here
rather than installed because `plugins/` is not a pnpm workspace member and has
no `node_modules` of its own.

| | |
|---|---|
| Package | `@fontsource-variable/inter` |
| Version | `5.2.8` |
| File | `files/inter-latin-wght-normal.woff2` (weights 100–900, U+0000-00FF plus general punctuation) |
| sha256 | `3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62` |
| License | SIL Open Font License 1.1. See [OFL-Inter.txt](OFL-Inter.txt) |

The design system declares `--font: 'Inter', 'Segoe UI', system-ui` and loads it
from Google Fonts (`design-system/tokens/typography.css`). This plugin drops that
`@import` and serves this file instead, for two reasons:

- a deployment on a closed network cannot reach Google;
- an artifact page must not need a second origin to look right.

The latin subset covers pt-BR: accented Latin-1, `·`, `–`, `−` and `R$`.

This file is served in three places:

- **Web client**: from the plugin's asset route
  (`/_compliance-brand/inter.woff2?v=<hash>`).
- **Artifact documents**: inline as a `data:` URI, because the frame's origin is
  opaque.
- **SSO pages**: inline from its own copy in `plugins/sso-auth/assets/`, because
  those pages run in the gateway before the harness is reachable.

## Oracle Sans

`design-system/assets/OracleBrandVF_Tb_W_WghtWdth.woff2` (sha256
`1f248fa56281582f09eed6c333e9d1b6405b39207ce34e51e0c026e831527929`), together
with `redwood-stripe.svg` and `redwood-band.svg`, is an **Oracle brand asset**.

- The design system copied it from its source repository only for the
  `netsuite-redwood` theme. That theme exists to compare Compliance HCM with
  NetSuite.
- It is not a Compliance Soluções asset. It is used for nothing else and must not
  be redistributed beyond this deployment.
- It is loaded only while the Redwood theme is active. Artifacts get it only when
  they are asked for that theme.
