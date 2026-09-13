# @compliance/dsh-artifacts

Interactive HTML artifacts rendered in a panel beside the conversation:
`create_artifact` and `update_artifact`, the card that opens the panel, and the
sandboxed frame that shows the page.

## Layout

The JavaScript here *is* the source — there is no build — so both halves sit at
the package root rather than under `lib/`, which the repository `.gitignore`
ignores at any depth.

| File | Half | Role |
|---|---|---|
| `index.js` | node | The row: the two tools, the document route, the skill, the boot global. |
| `client.js` | browser | The conversation card and the right-Sidebar tab, hand-written in the lazy CJS factory form the client module loader consumes. |
| `src/config.js` | node | Validates the row's `config` and builds the artifact's CSP. |
| `src/store.js` | node | The versioned directory: `<root>/<sessionId>/<artifactId>/v<N>.html`. |
| `src/route.js` | node | Serves one document with its own CSP header. |
| `src/tool.js` | node | The two tool definitions. |

## Why the page is served from a URL

Only a response can carry the artifact's own `Content-Security-Policy`. A
`srcdoc` frame inherits the **embedder's** policy, so the CDN allowlist would
have to be granted to the whole application instead of to the generated page.

The path that already exists does not work here: `/api/file` serves workspace
HTML under `sandbox; default-src 'none'`, which kills every script, and an e2e
test pins that. It is deliberately not a channel for an interactive page.

## Why it is safe on the app's own origin

The deployment has one public origin, so the artifact is served from the same
host as the app. The frame is embedded with
`sandbox="allow-scripts allow-popups allow-modals"` and **without**
`allow-same-origin`, which gives the document an **opaque origin**: it reaches no
cookie, no storage and no session of the app around it.

`tests/browser.mjs` establishes this in a real Chromium rather than asserting it
from the design: the frame's `window.origin` is `null`, `document.cookie` and
`localStorage` both throw inside it, the embedder's cookie never appears, and a
script host outside the allowlist is refused while the page's own inline script
still runs.

Two consequences worth knowing:

- A page cannot persist anything. Artifact state lives in JavaScript variables
  for as long as the panel is open.
- An unguarded `document.cookie` read **aborts the rest of the script**, leaving
  a half-built page with no visible error. The skill tells the model to guard
  every such access, including one a library performs on its own.

## Where the HTML lives

On disk under `DSH_HOME/artifacts` (override with `root`), never in the call
arguments. `compliance-echarts` inlines its whole option and says so — the data
"stays in the conversation for every later turn". For a chart option that is a
fair trade; for a page of tens of kilobytes **with a version history** it is not.

What travels in the arguments is the receipt, and the receipt is also persisted
through `output.presentationMeta`. That second copy is load-bearing: with
backward pagination a settled node's `call` is `null` once the window cut left
the `tool/call` outside it, so a card reading only `argsRaw` would silently lose
its open button on older messages. `tool/result.meta` rides the result node,
is never cropped, and — unlike the arguments — is not model-visible, since
`deriveMessages` projects only `data.message`.

Versions are immutable once written: an update adds a file. A URL the user
already opened keeps showing what they saw.

## Configuration

Every tunable is a field on the row's `config` — see
`plugins/compliance-artifacts.overlay.yml`. An unknown field is a rejection
rather than a warning.

`allowedOrigins` is the CDN allowlist the artifact document's CSP carries. It is
a **deployment decision as much as a code one**: the user's browser must reach
those hosts, so on a closed corporate network a page that loads a library breaks.
Trim the list to what this deployment can actually reach.

## Panel copy is pt-BR, on purpose

`verify-client-ui-i18n` discovers `packages/*/*/src/client/**/*.tsx`,
`packages/client/*`, `apps/web` and `apps/desktop` — `plugins/` is outside it, as
`compliance-echarts`' own client half already is. The card and panel copy is
therefore written directly in Portuguese rather than through a locale dictionary.
This is a deliberate divergence from the harness rule, taken because this
deployment is single-language; a plugin that ever needs a second language has to
move that copy into dictionaries first.

## Tests

```sh
node plugins/compliance-artifacts/tests/smoke.mjs     # no build, no network, no key
node plugins/compliance-artifacts/tests/browser.mjs   # real Chromium
```

The smoke drives the route over a real HTTP listener — the CSP is this plugin's
security property, and asserting it on a handler called directly would not prove
it reaches the wire. It also materializes `client.js` through a fake module
loader, so the card's pure readers are covered without a DOM.

Set `ARTIFACTS_CHROMIUM` to a Chromium binary when Playwright's own
build-numbered lookup does not find one on the host.
