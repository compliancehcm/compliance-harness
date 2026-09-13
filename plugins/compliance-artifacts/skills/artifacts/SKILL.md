---
name: artifacts
description: Build interactive HTML artifacts shown in a panel beside the conversation with create_artifact and update_artifact. Read this before the first artifact of a conversation. It covers when a page beats prose, the one-shot constraint (you never see the result), the document skeleton, which CDN libraries are reachable and which are not, the sandbox rules that silently break a page - no localStorage, no network calls - how to iterate with old_str instead of resending the page, and how to talk about an artifact the user is already looking at.
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
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; padding: 24px; font: 15px/1.5 system-ui, sans-serif; }
</style>
</head>
<body>
  <h1>Custo por filial</h1>
  <script>
    // data inline — the page cannot fetch anything
    const dados = [{ filial: "SP", valor: 1200 }];
  </script>
</body>
</html>
```

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

The panel follows the user's theme. `color-scheme: light dark` plus a
`prefers-color-scheme` block is enough; a page that hardcodes a white background
looks broken for half the users.

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
