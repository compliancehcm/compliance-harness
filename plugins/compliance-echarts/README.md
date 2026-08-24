# `@compliance/dsh-echarts`

Charts in the conversation. The model calls `render_chart` with an Apache ECharts
option; that call's card becomes the chart.

Mount it with [`../compliance-echarts.overlay.yml`](../compliance-echarts.overlay.yml).

## What it contributes

| Where | What |
|---|---|
| `ctx.tools` | `render_chart({ option, title?, caption?, height? })` |
| `ctx.skills` | `echarts-charts` — which chart form answers which question, and the option skeleton for each |
| `ctx.webServer` | one route (`assetPath`) serving the vendored ECharts UMD bundle |
| `tool.call.toolview` | the chart card, keyed under the tool's wire name |

## How a chart survives a reload

The tool draws nothing. Everything the browser needs is in the call's
**arguments**, which the session log already keeps, so the card re-parses
`argsRaw` and draws again — on reload, on history pagination, and on replay. This
plugin persists nothing of its own and adds no session event.

Two consequences worth knowing:

- The chart appears as soon as the arguments finish streaming, before the result.
- `execute` is pure and `chartId` is derived from the option rather than being a
  fresh uuid, so a replayed call produces the value it produced live.

## Why the bundle is behind a route

The bundle is a megabyte. A client-module package would not help: web boot calls
`loader.create()` for every row in the boot graph and then requires each one to
have activated, so a package whose bundle is ECharts costs that megabyte at every
boot for every session. Behind an HTTP route the browser fetches it on the first
chart of a session and then keeps it — the route answers with a content-derived
ETag, `immutable`, and gzip (1.1 MB → ~360 KB).

The route is a plain path, not an RPC method, so the SSO gate admits it for any
authenticated user without widening the fence around the RPC plane.

## Configuration

| Field | Default | Meaning |
|---|---|---|
| `assetPath` | `/echarts/echarts.min.js` | Where the browser fetches the bundle. Both halves read it from one boot global. |
| `toolName` | `render_chart` | Wire tool name, and therefore the card's slot key. |
| `maxOptionBytes` | `262144` | Rejection threshold for the encoded option. It stays in the conversation for every later turn, so this is a context budget, not a memory one. |
| `maxSeries` | `12` | Beyond this a card is unreadable, so the tool rejects instead of drawing it. |
| `defaultHeight` / `minHeight` / `maxHeight` | `320` / `160` / `720` | Card height, and the range `height` may ask for. |
| `registerSkill` | `true` | Whether to contribute the `echarts-charts` skill. |

## What the tool rejects

A rejection is cheaper than a bad chart: the model reads the message and retries,
while a silently ugly card just misinforms the user. Beyond the schema, the tool
refuses an option with no `series`/`dataset`, more than `maxSeries` series, an
encoded size over `maxOptionBytes`, a `height` outside the configured range, and
**a `legend` with neither `top` nor `bottom`** — this ECharts version anchors such
a legend to the bottom, *inside* the plot, on top of the bars.

## Appearance

The card follows the harness theme: the chart is steered with ECharts 6's
`setTheme` on a theme change rather than disposed and re-initialized, so switching
appearance does not replay every animation. The skill tells the model not to set
colors for exactly this reason.

## Vendored ECharts

`vendor/echarts.min.js` is the unmodified `dist/echarts.min.js` of `echarts`
6.1.0, Apache-2.0, committed because `plugins/` is not a pnpm workspace member and
has no `node_modules`. Provenance, hash and refresh procedure are in
[`vendor/README.md`](vendor/README.md); the upstream `LICENSE` and `NOTICE` are
preserved beside it. The repository's `THIRD_PARTY_NOTICES.md` is generated from
workspace manifests and `vendor/README.md`, neither of which reaches this
directory, so this package's own vendor directory is where that attribution lives.

## Tests

```sh
node plugins/compliance-echarts/tests/smoke.mjs               # no build, no network, no key
node plugins/compliance-echarts/scripts/vendor-echarts.mjs    # verify the vendored bytes

# the browser half, against a harness that already has this plugin composed
pnpm dsh --profile web --patch plugins/compliance-echarts.overlay.yml --port 31777 --no-open &
node plugins/compliance-echarts/tests/browser.mjs http://127.0.0.1:31777
```

`tests/smoke.mjs` covers configuration, every tool rejection, the route's caching
and method handling, the skill's frontmatter, that the vendored UMD evaluates to a
usable `echarts`, and that the client half claims the configured tool name.

`tests/browser.mjs` covers what only a real browser can: that web boot with this
plugin composed raises no console error, that the ECharts bundle is **not** fetched
at boot, that every option skeleton in the skill actually draws a canvas, and that
`getDataURL` and `setTheme` behave as the card assumes. It drives Playwright,
resolved from `apps/web`, which owns that dependency.
