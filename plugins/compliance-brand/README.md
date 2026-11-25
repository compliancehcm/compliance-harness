# @compliance/dsh-client-ui-brand

The **Compliance HCM design system** for this deployment. It covers:

- the Web client's brand slots, palette, type, favicon and tab title;
- the five design-system themes;
- the design system applied to every artifact document, through a service
  `compliance-artifacts` reads;
- the model's guide to the design system, as a skill.

The shipped `DSH Local Build` fallback (`SidebarRoot.tsx`) and the official
occupants (`packages/client/ui-brand-official`) are replaced. The overlay
disables the official row.

## Layout

The sources sit at the package root rather than under `lib/`. The repository
`.gitignore` ignores `lib/` at any depth, which would silently drop the whole
plugin from Git.

| Path | Half | Role |
|---|---|---|
| `design-system/` | — | The design system, **verbatim** as it ships (`readme.md` is its own write-up). Upgrading it means replacing this folder, then re-running `scripts/build-components.mjs`. |
| `index.js` | node | Index injections, asset route, `complianceDesignSystem` service, skill. |
| `src/tokens.js` | node | Parses `design-system/tokens/*.css` and re-targets its selectors for the app and for artifacts. |
| `src/design-system.js` | node | Loads everything once: app stylesheet, artifact stylesheet per theme, components script, assets. |
| `src/route.js` | node | `GET /_compliance-brand/<name>`: fonts and SVGs, `immutable`. |
| `src/skill.js` | node | Registers `skills/compliance-design-system/SKILL.md`. |
| `theme/app.css` | — | The bridge from the design system's aliases onto the Web client's `--dsw-*` tokens. |
| `theme/artifact-components.css` | — | Base element styles and the `.ds-*` classes for artifact pages. |
| `theme/ds-components.js` | — | Generated. The React components cut out of `design-system/_ds_bundle.js`. |
| `fonts/` | — | Vendored Inter. See [fonts/README.md](fonts/README.md), which also covers the Oracle assets. |
| `client.js` | browser | Brand slot occupants, extra themes, and the "Tema da marca" settings row. |

## How the app gets the design system

The Web client styles itself with `--dsw-*` custom properties, declared by
ui-theme on `body` and `body[data-ds-dark-theme]`. The design system uses
semantic aliases (`--background`, `--card`, `--primary`…), and every theme
re-declares only those.

The node half pushes a `style` row into `index.html`, so the first paint is
already on-brand. The row carries:

1. **The design system's tokens, re-targeted.**
   - `:root` becomes `html body`.
   - `[data-theme="escuro"]` becomes `html body[data-ds-dark-theme]`, so the
     app's own Dark (and System, on a dark OS) *is* the design system's dark
     theme.
   - The other three themes become `html[data-compliance-theme="…"] body`.
2. **`theme/app.css`.** It maps every `--dsw-*` alias to a design-system alias,
   once. Switching theme therefore recolours the whole app with no per-theme
   block. It uses weight (0,1,2), above upstream's `body[data-ds-dark-theme]`,
   so stylesheet order does not matter. It contains no raw hex; the smoke test
   enforces that.

**The sidebar** is the design system's navigation surface. It paints
`--nav-bg` with `--nav-fg` ink, `--nav-hover`, and the `--nav-active-bg` pill
for the current item (`Sidebar.jsx` / `NavItem.jsx`). Every theme declares those
slots, so the column comes out right in all five:

- solid navy in Padrão;
- deep navy in Escuro;
- the card-coloured nav in Compliance Light, Alma RH Dark and Redwood.

New Session takes the nav's high-emphasis pair (`--nav-badge-*`).

The column has no stable attribute, so the rules match the CSS-module **local
name** (`[class*="_sidebarCol"]`, `_panelRow`, `_sessionRow`, `_newSession`).
Classes ship as `<hash>_<localName>`: the hash changes every build, but the
local name changes only when upstream renames the class. Re-check these rules
after an upstream jump.

Row state is read from ARIA, not from a state class: the current panel is
`aria-current="page"` (the pill goes on the row's wrapper, which upstream
paints), and the open session is `aria-selected="true"`. Upstream's upgrade
guide asks consumers to prefer `data-*` and ARIA hooks to generated class names.

**Buttons** keep upstream's geometry. The Button primitive has no stable variant
hook, and an earlier class-keyed restyle never matched before dsh 0.2 (static
libraries then shipped `_<local>_<hash>` names), so it was dropped rather than
switched on. Button colours already follow the token bridge.

**Font.** The bridge sets `--dsh-font-family-text-default` to the theme's
`--font`, not `--dsw-font-family`. ui-theme composes `--dsw-font-family` from
the user's Settings font list first and that default second, so Inter (Oracle
Sans under Redwood) is the default and the font picker still works.

## Themes

| Theme | How it is selected |
|---|---|
| Padrão (navy + amber) | Appearance → Light, or System on a light OS |
| Escuro | Appearance → Dark, or System on a dark OS |
| Compliance Light, Alma RH Dark, NetSuite Redwood | Settings → General → **Tema da marca** |

**How the extra themes work.**

- The client half registers the three with ui-theme's `theme` service. They have
  **no tokens of their own**: their colours come from the host stylesheet,
  keyed off `html[data-compliance-theme]`, which the client half sets on
  `theme/change`.
- ui-theme persists only its built-in preferences. The chosen extra theme is
  therefore kept in `localStorage['compliance-brand.theme']`, together with the
  built-in preference it was picked over.
- A pre-paint body script re-applies the saved theme before the shell mounts,
  so a reload does not flash the default palette.
- Picking a *different* built-in in the Appearance row hands the palette back to
  it. To leave an extra theme for the *same* built-in, pick "Padrão" in "Tema da
  marca".

**NetSuite Redwood.**

- It swaps the font to Oracle Sans, served from the asset route only while that
  theme is active.
- It draws Redwood's 8px stripe at the top of the window.
- Its Oracle assets are not Compliance Soluções assets. See
  [fonts/README.md](fonts/README.md).

## The artifact service

`ctx.provide('complianceDesignSystem', …)` exposes the following to
`compliance-artifacts`:

- `artifactStylesheet(themeId?)`: the full artifact stylesheet. Inter is inline
  as `data:`, and everything else sits inside `@layer compliance-ds`, so the
  page's own CSS wins.
- `componentsScript()`: the React components.
- `themes` and `version`.

That plugin's README covers how documents consume it.

`theme/ds-components.js` is generated. After replacing `design-system/`, run:

```sh
node plugins/compliance-brand/scripts/build-components.mjs
```

The smoke test fails while the committed file is stale.

## Brand marks

The source logo is one flat-white transparent PNG, so it cannot be tinted as an
`<img>`: painted directly, it is invisible on the light theme. Both pieces are
therefore used as CSS **masks** over a `currentColor` background, and the ink
follows the sidebar's label colour in every theme.

- The interlocking rings (202x133) fill `sidebar.brand.mark` and
  `conversation.hero.brand.mark`.
- The "Compliance soluções" lettering (399x91) fills `sidebar.brand.name`.

All three slots are `kind: single`. They install as one declaration-aware
registration set, so the package works in any activation order and withdraws
together. The favicon is the design system's `assets/favicon.svg`.

## Run

```sh
dsh plugin --profile web add link:$PWD/plugins/compliance-brand
pnpm dsh --profile web --patch ./plugins/compliance-brand.overlay.yml
```

`--patch` is a launcher flag, not a `web` subcommand option: `dsh web --patch …`
is rejected by the command grammar (`apps/cli/src/args.ts`). The overlay row
must name a resolvable package specifier rather than a directory path, because
the client-modules scanner resolves `<spec>/package.json` to find the built
`exports["./client"]`. That is why the `dsh plugin add link:` step is needed.

## Tests

```sh
node plugins/compliance-brand/tests/smoke.mjs   # no build, no network
```

The smoke covers:

- the token re-targeting and that the bridge contains no raw hex;
- the committed components script against the bundle;
- the asset route, over a real listener;
- the index injections and the pre-paint script;
- the client half's theme handling, through a fake module loader and a fake
  `theme` service.

The in-frame rendering of the artifact stylesheet is covered by
`plugins/compliance-artifacts/tests/browser.mjs`.
