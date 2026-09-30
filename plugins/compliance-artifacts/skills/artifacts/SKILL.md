---
name: artifacts
description: Build interactive HTML artifacts shown in a panel beside the conversation with create_artifact and update_artifact. Read this before the first artifact of a conversation. It covers when a page beats prose, the one-shot constraint (you never see the result), the document skeleton, the Compliance HCM design system every page already receives, which CDN libraries are reachable and which are not, the sandbox rules that silently break a page - no localStorage, no network calls - how to iterate with old_str instead of resending the page, and how to talk about an artifact the user is already looking at.
whenToUse: Before calling create_artifact, or when an artifact came out blank, unstyled, or failed to load a library.
---

# Artifacts

`create_artifact({ title, html })` puts a live page in a panel beside the
conversation. `update_artifact({ artifact_id, … })` changes it as a new version.

**You never see the result.** There is no loop where you look at the page and fix
it. The document has to be right when you send it.

## Is an artifact the answer?

Make one when the answer is something to **explore or use**: a dashboard, a
calculator, a filterable comparison, a diagram, a small tool, a form the user
fills in to see an outcome.

Do not make one for:

- An answer that is a sentence. Write the sentence.
- A table of a dozen rows. Markdown renders tables.
- A chart and nothing else — `render_chart` already puts one in the conversation
  with less ceremony.
- A spreadsheet the user will open in Excel — that is `write_xlsx`.

## The document

A complete HTML document, starting at `<!DOCTYPE html>`. Inline your own CSS and
JS. Set a `<meta name="viewport">` — the panel is narrow.

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Custo por filial</title>
</head>
<body>
  <main class="ds-page">
    <header class="ds-page-header">
      <div><h1>Custo por filial</h1><div class="ds-subtitle">Competência 07/2026 · 4 filiais</div></div>
    </header>
    <div class="ds-card" id="lista"></div>
  </main>
  <script>
    // data inline — the page cannot fetch anything
    const dados = [{ filial: "SP", valor: 1200 }];
  </script>
</body>
</html>
```

## The design system is already in the page

Every artifact is served with the **Compliance HCM design system** inlined at
the top of `<head>`. It provides the tokens (`var(--primary)`, `var(--card)`,
`var(--border)`, …), the Inter font, the base element styles (body, headings,
links, form controls, plain `<table>`s), and the `.ds-*` component classes
(`.ds-card`, `.ds-stat`, `.ds-btn`, `.ds-badge--success`, `.ds-table`, …). You link
nothing.

**Load the `compliance-design-system` skill before your first artifact.** It
lists the tokens and classes, how to opt into the React components, and the
pt-BR content rules: sentence case, the `·` connective, `R$ 9.480,00`, and
`dd/mm/aaaa`.

- **Build with the classes and tokens.** Write only the CSS the page needs
  beyond them. Your own rules always win, because the system sits in a cascade
  layer.
- **Never hard-code a hex colour or a font.** A literal `#fff` or `Arial` breaks
  the five brand themes the user can switch between. Use `var(--…)`.
- **Charts take their colours from the tokens.** Read them with
  `getComputedStyle(document.documentElement).getPropertyValue('--primary')`.

## What the sandbox allows, and what it silently breaks

The page runs with an **opaque origin**. Three consequences that produce a blank
or dead page rather than an error message:

| Does not work | Why | Instead |
|---|---|---|
| `localStorage`, `sessionStorage`, `document.cookie` | opaque origin — reading **throws**, it does not return empty | keep state in a JavaScript variable |
| `fetch`, `XMLHttpRequest`, WebSocket | `connect-src 'none'` | **inline the data** in a `<script>` |
| Loading a library from any other host | CSP allowlist | use one of the CDNs below |

An unguarded read **aborts the rest of the script**, so the page renders half
built with no error the user can see. Wrap every storage or cookie access in
`try/catch` — including one a library performs on your behalf.

**Reachable CDNs**: `cdn.jsdelivr.net`, `cdnjs.cloudflare.com`, `unpkg.com`,
`cdn.tailwindcss.com`, `fonts.googleapis.com`, `fonts.gstatic.com`. Pin an exact
version. React, Tailwind, Chart.js and D3 all load from these; anything else is
blocked with no visible error, so prefer writing it yourself over guessing at a
host.

The data always travels **inside** the page. If it came from `run_pandas`, read
the values and inline them — the page cannot open the file.

## Light and dark

The panel follows the user's theme, and the design system already handles it:
the tokens switch palettes with the app (light, dark and the brand themes). A
page built on `var(--…)` needs no `prefers-color-scheme` block of its own. A page
that hardcodes a white background looks broken for half the users.

## Iterating

To change a page, **do not resend it**. Use the surgical form:

```
update_artifact({
  artifact_id: "a1b2c3…",
  old_str: "background: #fff",
  new_str: "background: #0b1220",
})
```

`old_str` must appear **exactly once** — include surrounding lines until it does.
Resending the whole document costs its bytes again and risks dropping parts you
did not mean to touch. Send `html` only for a genuine rewrite.

Earlier versions are kept, so an update is never destructive.

## After creating one

The user is already looking at the page. Do not paste its code back, and do not
describe where to find it. Say what it shows and what it is for, in a sentence or
two — then stop.
