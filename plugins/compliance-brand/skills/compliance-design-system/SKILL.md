---
name: compliance-design-system
description: The Compliance HCM design system (Compliance Soluções) - colour tokens, the five themes, Inter type scale, spacing, radii, the `.ds-*` CSS classes and React components every artifact page already receives, and the pt-BR content rules (tone, casing, dates, currency, the interpunct). Read this before designing any artifact, report page, dashboard, form or mock, so it looks and reads like the product.
whenToUse: Before create_artifact, or whenever a page, table, chart or piece of UI copy should follow the Compliance HCM look and voice.
---

# Compliance HCM Design System

The look of **Compliance HCM**, Compliance Soluções' payroll and HR platform for
Brazilian labour law (CLT): folha de pagamento, ponto eletrônico, férias,
holerites, requisições de vaga. Quiet administrative software: neutral bluish
greys, one navy primary (`#2b4587`) with an amber accent (`#f5a623`), white
cards on an off-white page, hairline borders, no shadows on content. It should
read like a well-kept ledger, not a marketing site. Favour density over
decoration and information over illustration.

## What every artifact page already has

The artifact route injects the design system into every document before it
reaches the browser. You do not link anything:

- **The tokens.** Every `var(--…)` below works. The palette follows the app: the
  default theme in light mode, "escuro" in dark mode, or whichever brand theme
  the user picked. **Never hard-code a hex**: use the alias, or the five themes
  break.
- **Inter** as `var(--font)`, served inline. Weights 400/500/600/700.
- **Base element styles.**
  - `body` gets `--background`, `--foreground`, 14px Inter and the page padding.
  - `h1`–`h4` get `--heading` with negative tracking.
  - Links, form controls and `<pre>`/`<code>` are styled.
  - Plain `<table>` elements are styled like the product's DataTable.
- **The `.ds-*` classes** listed below.

All of it sits in a CSS cascade layer (`@layer compliance-ds`), so **any rule you
write yourself wins**. Write only what the page needs beyond the system.

## Tokens

| Purpose | Tokens |
|---|---|
| Surfaces | `--background` (page), `--card` (raised), `--muted` (inset, hover, dividers inside a card), `--row-bg`, `--row-hover-bg` |
| Text | `--foreground`, `--heading` (titles, never pure black), `--secondary-foreground`, `--muted-foreground`, `--row-title` |
| Lines | `--border` (between regions), `--muted` (repetition inside a card) |
| Primary | `--primary`, `--primary-hover`, `--primary-foreground`, `--primary-muted-foreground` (secondary text on a primary fill) |
| Accent | `--accent` (amber), `--accent-strong`, `--accent-soft-bg`, `--accent-soft-border` |
| Status pills | `--status-{success,danger,warning,info,purple}-{bg,fg}` |
| Feedback | `--success`, `--danger`, `--danger-soft-bg`, `--danger-soft-border`, `--danger-soft-fg`, `--danger-soft-fg-strong` |
| Presence | `--presence-present`, `--presence-remote`, `--presence-absent`, `--presence-vacation` |
| Brand ramp | `--brand-50` … `--brand-950` (navy), for charts and sequential scales |
| Type | `--font`, `--text-10` … `--text-44`, `--weight-regular/medium/semibold/bold`, `--tracking-h1`, `--tracking-eyebrow`, `--leading-body` |
| Space | `--space-1` (2px) … `--space-14` (28px), `--page-padding`, `--content-max` (1180px) |
| Radius | `--radius-sm` 6, `--radius-lg` 8 (buttons, inputs, rows), `--radius-menu` 10, `--radius-xl` 12 (cards, modals), `--radius-pill` |
| Elevation | `--shadow-segment`, `--shadow-popover`, `--shadow-toast`. There is nothing else. Cards have no shadow, ever |
| Overlay | `--scrim` (modals), `--scrim-light` |

**Charts.** Categorical series take `--primary` first, then `--accent`, then
`--brand-400`, `--status-purple-fg` and `--success`. Semantic series keep their
meaning: green is approved or positive, red is rejected, inconsistent or
negative, and amber is pending. Sequential scales run on the `--brand-*` ramp. In
JavaScript, read a token with
`getComputedStyle(document.documentElement).getPropertyValue('--primary')`.

## Classes

Every class is a transcription of the matching React component. Compose with them
instead of restyling from scratch.

| Class | Use |
|---|---|
| `.ds-page` | Centred content column, max 1180px, fade-in |
| `.ds-grid` / `.ds-grid--kpi` | Auto-fit columns (340px / 180px min) that collapse without media queries |
| `.ds-stack`, `.ds-row` | Vertical 12px stack / wrapping 8px row |
| `.ds-page-header` (`--dash`) + `h1` + `.ds-subtitle` | Screen title block (22px, or 24px on a dashboard) |
| `.ds-card` (`--hero`), `.ds-card__head`, `.ds-card__title` | The one container: `--card`, 1px `--border`, 12px radius, 20px padding. `--hero` is the single dark primary surface |
| `.ds-stat` (`--lg`, `--primary`, `--positive`, `--negative`) with `__label`, `__value`, `__caption` | KPI tile. Use at most one `--primary` per strip |
| `.ds-btn` (`--secondary`, `--ghost`, `--link`, `--on-primary`, `--sm`, `--lg`, `--block`) | Buttons. Pairs read Rejeitar (secondary), then Aprovar (primary), 6px apart |
| `.ds-icon-btn` | 34px bordered square |
| `.ds-badge` + `.ds-badge--success/danger/warning/info/purple/neutral` | Status pill. A tone class also works alone |
| `.ds-chip` | Outline pill for neutral metadata |
| `.ds-avatar` (`--sm`) | Initials circle. There is no photography anywhere |
| `.ds-dot--present/remote/absent/vacation` | 8px presence dot |
| `.ds-progress` (`--accent`, `--success`, `--danger`) `> span[style="width:60%"]` | 8px bar |
| `.ds-table` wrapping a `<table>` (`tr.ds-clickable`) | Scrollable card table. Tables never wrap |
| `.ds-approval` (`--pending`, `--done`), `__title`, `__meta`, `__actions` | Approval row with a status rail |
| `.ds-person` | Roster line |
| `.ds-list` / `.ds-list-item` | Rows divided by `--muted` / bordered inset rows |
| `.ds-field` + `label` + `.ds-input` / `.ds-select` / `.ds-textarea`, `.ds-hint`, `.ds-checkbox` | Forms. Focus turns the border `--primary` with no ring |
| `.ds-segmented > button[aria-pressed=true]` | Segmented control |
| `.ds-alert`, `.ds-notice` | Red soft-tint alert / amber notice |
| `.ds-toast`, `.ds-scrim > .ds-modal` (`__head`, `__title`, `__body`, `__foot`), `.ds-popover` | Overlays |
| `.ds-eyebrow`, `.ds-meta`, `.ds-muted`, `.ds-num`, `.ds-positive`, `.ds-negative` | Text helpers. `.ds-num` sets tabular numbers for clocks, balances and money |
| `.ds-brand`, `.ds-brand__tile`, `.ds-brand__name`, `.ds-brand__sub` | The "C" tile lockup |

```html
<main class="ds-page">
  <header class="ds-page-header ds-page-header--dash">
    <div><h1>Folha de julho</h1><div class="ds-subtitle">Competência 07/2026 · fechamento em 31/07</div></div>
    <button class="ds-btn">Baixar PDF</button>
  </header>
  <section class="ds-grid--kpi">
    <div class="ds-stat ds-stat--primary"><div class="ds-stat__label">Líquido total</div><div class="ds-stat__value">R$ 412.380,00</div><div class="ds-stat__caption">128 colaboradores</div></div>
    <div class="ds-stat"><div class="ds-stat__label">Inconsistências</div><div class="ds-stat__value ds-negative">7</div><div class="ds-stat__caption">ponto · 3 setores</div></div>
  </section>
</main>
```

## React components (optional)

For a React page, the design system's own components are available. Load React
18 UMD from a CDN, then put the **marker** after it. The route replaces the
marker with the components script:

```html
<script src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
<script type="text/compliance-ds" data-components></script>
<script>
  const { Card, StatCard, Button, Badge, DataTable } = window.ComplianceDS
  const e = React.createElement
  ReactDOM.createRoot(document.getElementById('app')).render(
    e(Card, { title: 'Aprovações' }, e(Badge, { status: 'Aprovada' })))
</script>
```

The components are:

- **core**: Avatar, Badge, BrandMark, Button, Card, Chip, Icon, IconButton, ProgressBar, StatCard
- **data**: ApprovalRow, DataTable, PersonRow
- **feedback**: AlertItem, Modal, NotificationItem, Toast
- **forms**: Checkbox, Field, Input, Select, Textarea
- **navigation**: AppHeader, DropdownMenu, MenuSection, MenuItem, NavItem, PageHeader, SegmentedControl, Sidebar

Their props are in `components/<group>/<Name>.d.ts`, with usage notes in
`components/<group>/<Name>.prompt.md`. Both paths are relative to this skill's
base directory. Read them when you need a prop you are unsure of. JSX needs a
compiler the page does not have, so use `React.createElement`, or plain HTML with
the classes above. Plain HTML is usually the lighter choice.

## Content rules (pt-BR, always)

- **Person.** Address the reader as *você*, implicitly. Use first person for the
  reader's own data ("Minhas férias", "Meu ponto") and third person for a
  manager's view ("Férias da equipe").
- **Casing.** Sentence case everywhere ("Solicitar férias"). Use UPPERCASE only
  in 11–13px eyebrows (`.ds-eyebrow`, table heads). Never use title case.
- **Register.** Plain and administrative, using departamento pessoal vocabulary
  correctly: competência, holerite, espelho de ponto, período aquisitivo, banco de
  horas, batida, abono, proventos e descontos, 13º salário. No marketing voice,
  no exclamation marks, no emoji.
- **One line.**
  - Titles are short noun phrases.
  - Qualifiers go in the subtitle, joined by the middle dot: "Julho de 2026 ·
    fechamento em 31/07". The interpunct replaces commas and second lines.
- **Buttons** are verbs naming the outcome: Registrar ponto, Enviar solicitação,
  Aprovar ajuste, Baixar PDF. Cancel is "Cancelar"; dismiss is "Fechar".
- **Confirmations** are one sentence in the past tense, ending in ✓: "Férias
  aprovadas ✓". Rejections drop the ✓.
- **Errors** are instructions, not blame: "Informe seu e-mail (ou CPF) e senha."
- **Numbers.**
  - Dates are `dd/mm` or `dd/mm/aaaa`; months are spelled out in headings.
  - Ranges use an en dash with spaces (10/08 – 24/08).
  - Money is `R$ 9.480,00`; durations are `8h48` or `+0h16`.
  - Negative values use the true minus sign −.
  - `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` formats
    money correctly.

## Visual rules

- Colour only classifies: approved, rejected, pending, férias, vagas.
  Decoration is never coloured.
- No gradients, textures, photography or illustration. The only dark surface
  is a primary hero card.
- Borders are 1px hairlines. There are no double borders and no coloured card
  borders.
- Hover changes the background only. There is no press state.
- The only motion is `fadeIn` (6px rise, .25s). No bounce and no stagger.
- Icons are Lucide geometry: 24×24, stroke 2, round caps, `currentColor`. The
  registry is `components/core/Icon.jsx`. Emoji never stand in for icons.

## Reference files

These paths are relative to this skill's base directory, the design system
folder. Read them only when needed:

- `readme.md`: the full design system write-up.
- `tokens/*.css`: every token and theme, verbatim.
- `components/**`: component source, props (`.d.ts`) and usage (`.prompt.md`).
- `ui_kits/portal-do-trabalhador/*.jsx`: whole product screens (dashboards,
  espelho de ponto, holerites, férias, vagas) built from the components. These
  are the best reference for density and layout.
