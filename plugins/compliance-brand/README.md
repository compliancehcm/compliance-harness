# @compliance/dsh-client-ui-brand

Compliance AI brand occupants for the Web client's sidebar and conversation Hero
brand slots. Replaces the shipped `DSH Local Build` fallback (`SidebarRoot.tsx`)
and the official occupants in `packages/client/ui-brand-official`.

## Layout

The two halves sit at the package root rather than under `lib/`, because the
repository `.gitignore` ignores `lib/` at any depth: for a workspace package
that directory is tsdown output and the versioned source is its TSX, but here
the JavaScript *is* the source, so `lib/` would silently drop the whole plugin
from Git.

| File | Half | Role |
|---|---|---|
| `index.js` | node | Empty `apply` — gives Loader a host-side row. |
| `client.js` | browser | The three slot occupants, in the lazy CJS factory form the client module loader consumes. |

`client.js` is hand-written in the shape tsdown's client preset emits
(`window.__ModuleLoader__.load({id, factory})`); executing the script only
REGISTERS the factory, and every side effect runs at materialization. `react/jsx-runtime`
is part of the implicit external baseline the shell seeds, so no
`dsh.client.external` request is declared.

## The three occupants

`sidebar.brand.mark`, `sidebar.brand.name`, and `conversation.hero.brand.mark`
are all `kind: single`. They install as ONE declaration-aware registration set
through nested `slots.inject()`, so the package works whether it activates
before or after the sidebar and conversation declarers, and withdraws every
occupant together rather than leaving a partial brand mix.

## Theme-aware artwork

The source logo is one flat-white transparent PNG, so it cannot be tinted as an
`<img>`: painted directly it is invisible on the light theme. Both pieces are
used as CSS **masks** over a `currentColor` background, so the ink follows the
sidebar's own label color in either theme — the same behaviour as the
`currentColor` SVG logo this package replaces.

The source wordmark is split in two because the slots are independent and the
collapsed rail renders the mark alone: the interlocking rings (202x133) fill
both mark slots, and the "Compliance soluções" lettering (399x91) fills the
name slot. Both ride inline `data:` URIs, so the bundle stays self-contained and
boot makes no third-party request.

## Run

```sh
dsh plugin --profile web add link:$PWD/plugins/compliance-brand
pnpm dsh --profile web --patch ./plugins/compliance-brand.overlay.yml
```

`--patch` is a launcher flag, not a `web` subcommand option: `dsh web --patch …`
is rejected by the command grammar (`apps/cli/src/args.ts`). The overlay row
must name a resolvable package specifier rather than a directory path, because
the client-modules scanner resolves `<spec>/package.json` to find the built
`exports["./client"]` — hence the `dsh plugin add link:` step.
