---
name: artifacts
description: Build interactive HTML artifacts in the panel beside the conversation with create_artifact and update_artifact. Read it before the first artifact of a conversation and before any chart inside a page. Covers when a page beats prose, the one-shot constraint, the document skeleton, the design system already in every page, charts with the local ECharts (never a CDN, never a hand-drawn canvas), reachable CDNs, the sandbox rules (no storage, no network) and iterating with old_str.
whenToUse: Before calling create_artifact, before putting a chart in a page, or when an artifact came out blank, unstyled, or failed to load a library.
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
  `getComputedStyle(document.documentElement).getPropertyValue('--primary')` —
  the skeleton under *Charts in a page* does it for you.

## Charts in a page

### Two places a chart can live — they are not the same

| | `render_chart` | A chart inside an artifact |
|---|---|---|
| Where it appears | on the tool call's card, in the conversation | inside your page, in the panel |
| Who draws it | the app itself, from the `option` you pass | your page's own script |
| Where it runs | the app's own frame, with the user's session | a sandboxed frame with an **opaque origin**: no session, no network |
| ECharts comes from | the app, automatically | `<script src="/echarts/echarts.min.js"></script>` in your page, which the server replaces with the bundle **inline** |
| Theme and colours | applied by the app — set no colours | yours to read from the tokens |
| Choose it when | one chart answers the question | the chart is part of something to explore: KPIs, filters, several views |

Both are **ECharts 6.1**, so the option skeletons and the legend/grid rules of the
`echarts-charts` skill apply unchanged inside a page.

### Use ECharts — never draw a chart by hand

- **Never draw a data chart with `canvas.getContext('2d')`, SVG paths you
  compute, or `<div>`s with a fixed height.** A hand-sized canvas is blurry on
  every high-density screen, has no axes, ticks, tooltips or resize, and the bars
  come out inconsistent. ECharts handles all of it.
- A CSS bar is fine only for a **simple proportion** with no axis — a thin
  composition strip, a progress bar beside a number.
- **Do not load ECharts from a CDN**, and do not write a `setInterval` that
  waits for `echarts` to appear. Write the local `<script src>` exactly as below:
  the server swaps it for the bundle inline, so `echarts` exists on the very next
  line, works without internet access, and costs no request.

### The skeleton

```html
<div class="ds-card"><div id="grafico" style="height:320px"></div></div>

<script src="/echarts/echarts.min.js"></script>
<script>
  const dados = [{ mes: "Jan", valor: 1200 }, { mes: "Fev", valor: 1350 }];

  const el = document.getElementById("grafico");
  if (typeof echarts === "undefined") {
    el.textContent = "Não foi possível carregar o gráfico.";
  } else {
    const chart = echarts.init(el);
    const pintar = () => {
      const css = getComputedStyle(document.documentElement);
      const t = (nome) => css.getPropertyValue(nome).trim();
      chart.setOption({
        color: [t("--primary"), t("--accent"), t("--brand-300"), t("--muted-foreground")],
        textStyle: { color: t("--foreground"), fontFamily: getComputedStyle(document.body).fontFamily },
        tooltip: { trigger: "axis" },
        legend: { top: 0, textStyle: { color: t("--muted-foreground") } },
        grid: { top: 32, left: 8, right: 16, bottom: 8, containLabel: true },
        xAxis: { type: "category", data: dados.map((d) => d.mes),
                 axisLine: { lineStyle: { color: t("--border") } } },
        yAxis: { type: "value", splitLine: { lineStyle: { color: t("--border-subtle") } } },
        series: [{ type: "bar", name: "Custo", data: dados.map((d) => d.valor) }],
      });
    };
    pintar();
    // The panel resizes without a window resize event; observe the element.
    new ResizeObserver(() => chart.resize()).observe(el);
    // Light and dark switch the tokens without a reload: repaint with them.
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", pintar);
  }
</script>
```

- Give the container an explicit **height**; a zero-height element draws nothing.
- One `<script src="/echarts/echarts.min.js">` per page, before the script that
  uses it, with no `async`, `defer` or `type="module"`. Several charts share it:
  one `echarts.init` per container.
- Inside a page you **do** set the colours (from the tokens, as above). The
  "set no colours" rule of `echarts-charts` is about `render_chart`, where the app
  themes the chart for you.

## What the sandbox allows, and what it silently breaks

The page runs with an **opaque origin**. Three consequences that produce a blank
or dead page rather than an error message:

| Does not work | Why | Instead |
|---|---|---|
| `localStorage`, `sessionStorage`, `document.cookie` | opaque origin — reading **throws**, it does not return empty | keep state in a JavaScript variable |
| `fetch`, `XMLHttpRequest`, WebSocket | `connect-src 'none'` | **inline the data** in a `<script>` |
| Loading a library from any other host | CSP allowlist | use one of the CDNs below — or, for charts, the local ECharts above |

An unguarded read **aborts the rest of the script**, so the page renders half
built with no error the user can see. Wrap every storage or cookie access in
`try/catch` — including one a library performs on your behalf.

**Reachable CDNs**: `cdn.jsdelivr.net`, `cdnjs.cloudflare.com`, `unpkg.com`,
`cdn.tailwindcss.com`, `fonts.googleapis.com`, `fonts.gstatic.com`. Pin an exact
version. React, Tailwind and D3 load from these; anything else is blocked with no
visible error, so prefer writing it yourself over guessing at a host. For charts,
use the local ECharts — not Chart.js or ECharts from a CDN.

A CDN depends on the user's network reaching it, and a corporate network may not.
When you do load one:

- Put the `<script src>` **before** the script that uses it, with no `async` or
  `defer`. A plain script blocks the parser until it has run, so the library is
  defined on the next line — no polling.
- Still check before using it, and say so on the page if it is missing:
  `if (typeof d3 === "undefined") { el.textContent = "Não foi possível carregar a biblioteca."; }`.
  A library that failed to load leaves a blank area and no error the user can see.
- If you must use `defer`, start your code in
  `window.addEventListener("load", …)`, never in a `setInterval`.

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
