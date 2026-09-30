# Compliance HCM — Design System

Design system for the new modules of **Compliance HCM**, the payroll and HR platform built by **Compliance Soluções** (compliancesolucoes.com.br) for Brazilian labour law (CLT): folha de pagamento, ponto eletrônico, férias, holerites, requisições de vaga.

Everything here was derived from one source of truth: the interactive prototype **Portal do Trabalhador** in the repository below. No values were invented — colours, sizes, paddings and radii are copied literally from that file.

## Sources

- GitHub — https://github.com/vertechit/ComplianceHCM_Design (branch `main`)
  - `Portal do Trabalhador.dc.html` — the whole product prototype: login, dashboards (funcionário and gestor), espelho de ponto, holerites, férias, vagas.
  - `CLAUDE.md` — notes on the prototype's architecture and theme rules.
  - `assets/OracleBrandVF_Tb_W_WghtWdth.woff2`, `assets/redwood-stripe.svg`, `assets/redwood-band.svg` — third-party Oracle brand assets used **only** by the optional `netsuite-redwood` comparison theme.
- No Figma file, brand book, marketing site or slide template was provided. See **Gaps** below.

Explore the repository directly for anything this document abbreviates — the prototype is the canonical reference for behaviour.

## Product context

One product, one shell, two personas.

- **Funcionário** — sees Início, Meu ponto, Holerites, Minhas férias, Vagas internas. Self-service: bater ponto, consultar holerite, pedir férias, candidatar-se internamente.
- **Líder / Gestor** — sees Início, Ponto da equipe, Meu holerite, Férias da equipe, Requisições de vaga. Approval-driven: aprovar/rejeitar férias e ajustes de ponto, abrir requisições, acompanhar presença e inconsistências.

The persona switch lives in the header ("Visualizar como:") — every screen, nav label and notification list branches on it. The shell also switches between a retractable sidebar and a top menu, and between five themes; both persist in `localStorage`.

## Index

| Path | What it is |
| --- | --- |
| `styles.css` | Global entry point — `@import`s only |
| `tokens/` | `colors.css`, `themes.css`, `typography.css`, `spacing.css`, `radius-elevation.css`, `base.css` |
| `components/` | React primitives, grouped by concern (see list below) |
| `ui_kits/portal-do-trabalhador/` | Full click-through recreation of the product |
| `guidelines/` | Foundation specimen cards shown in the Design System tab |
| `assets/` | Redwood stripe + band SVGs, Oracle Sans woff2 (Redwood theme only) |
| `SKILL.md` | Agent Skill wrapper for use in Claude Code |
| `github.md` | Upstream repository association and sync record |

### Components

- **core** — `Button`, `IconButton`, `Badge`, `Chip`, `Avatar`, `Card`, `StatCard`, `ProgressBar`, `Icon`, `BrandMark`
- **forms** — `Field`, `Input`, `Select`, `Textarea`, `Checkbox`
- **feedback** — `Modal`, `Toast`, `AlertItem`, `NotificationItem`
- **navigation** — `Sidebar`, `AppHeader`, `NavItem`, `SegmentedControl`, `DropdownMenu` (+ `MenuSection`, `MenuItem`), `PageHeader`
- **data** — `DataTable`, `ApprovalRow`, `PersonRow`

Each directory holds `<Name>.jsx`, `<Name>.d.ts`, `<Name>.prompt.md` and one card HTML.

**Intentional additions.** The prototype is a single file with no component layer, so the families above are an extraction of its repeated patterns, not an inventory someone else defined. Three wrappers have no literal counterpart in the source and exist to keep usage honest: `Icon` (registry of the source's inline SVG paths), `BrandMark` (the repeated C-tile + wordmark lockup) and `Field` (the two label treatments).

## Content fundamentals

**Language.** Portuguese (pt-BR), always. Variable names in the prototype are Portuguese too (`holerite`, `batidas`, `pendencias`) — keep new code in the same language.

**Person.** The product speaks to the user as *você*, implicitly. Possessives are first person for the employee's own data — "Minhas férias", "Meu ponto", "Minhas solicitações" — and third person for the manager's view of others: "Férias da equipe", "Ponto da equipe", "Equipe hoje". Nav labels change with persona; nothing else does.

**Casing.** Sentence case everywhere: "Solicitar férias", "Registrar ponto", "Aguardando sua aprovação". UPPERCASE only in 11–13px eyebrows (table heads, menu section labels, "REGISTRO DE PONTO"), with `letter-spacing` .05–.08em. Never title case.

**Register.** Plain, administrative, unhurried — the vocabulary of departamento pessoal, used correctly: competência, holerite, espelho de ponto, período aquisitivo, banco de horas, batida, abono, proventos e descontos, requisição, 13º salário. No marketing voice, no exclamation marks, no jokes. One warm exception: the greeting ("Bom dia, Mariana") and the login toast ("Bem-vindo(a) de volta!"), which uses the inclusive `(a)` form — as do "Desenvolvedor(a)", "Coordenador(a)".

**Structure of a line.** Titles are short noun phrases; the subtitle carries the qualifiers, separated by the middle dot: "Julho de 2026 · fechamento em 31/07", "10/08 – 24/08 · 15 dias · saldo 22 dias", "Demonstrativos de pagamento · clique para ver o detalhe". The interpunct is the system's connective tissue — use it instead of commas or a second line.

**Buttons** are verb phrases naming the outcome: Registrar ponto, Solicitar férias, Enviar solicitação, Enviar requisição, Aprovar ajuste, Candidatar-se, Baixar PDF, Marcar todas como lidas. Cancel is "Cancelar"; dismiss is "Fechar".

**Confirmations** are one sentence, past tense, ending in a check: "Ponto registrado às 13:04 ✓", "Férias aprovadas ✓", "Candidatura enviada ao RH ✓". Rejections drop the check: "Solicitação rejeitada".

**Errors** are instructions, not blame: "Informe seu e-mail (ou CPF) e senha."

**Dates and numbers.** `dd/mm` or `dd/mm/aaaa`; months spelled out in headings ("Junho 2026", "Julho de 2026"); ranges use an en dash with spaces (10/08 – 24/08). Currency is `R$ 9.480,00`. Durations are `8h48`, `+0h16`, `6h 12min`. Negative time uses the true minus sign −, not a hyphen. Relative time in notifications: "há 2 horas", "há 3 dias", "há 2 semanas".

**Emoji.** None. The only pictographs are ✓ in toasts and badges and ✕ as the modal close glyph.

## Visual foundations

**Overall vibe.** Quiet administrative software. Neutral zinc greys, one near-black accent, white cards on an off-white page, hairline borders, no shadows on content. The product looks like a well-kept ledger, not a marketing site: density over decoration, information over illustration.

**Colour.** The default theme is monochrome — `--primary` is `#18181b`, not a brand hue. Colour appears only to classify: green for approved and positive balances, red for rejected/inconsistent/negative, amber for pending, blue for férias, purple for vagas, and four presence dot colours. Four alternative themes (`escuro`, `compliance-light` with the blue `#2e8fd5`, `alma-dark`, `netsuite-redwood`) re-declare the same aliases and nothing else. Never hard-code a hex in a screen; always use the alias, or the five themes break.

**Type.** One family, `Inter` (system fallback `Segoe UI`), 400/500/600/700 — swapped for `Oracle Sans` in the Redwood theme only, where it pairs with `Georgia` (`--font-redwood-serif`) for editorial headings. The scale runs 10→44px: 44 for the punch clock, 24/22 for page titles, 15 for the header title, 14 for body and controls, 13 for secondary text and small buttons, 12 for meta and pills, 11 for menu eyebrows. Headings carry negative tracking (−.02em, −.03em on the clock); eyebrows carry positive tracking and uppercase. Clocks, batidas and balances use `tabular-nums`.

**Backgrounds.** Flat colour only. No photography, no illustration, no gradient, no texture, no pattern — with one exception: the Redwood theme's decorative image band above the header — `redwood-band.svg` at 132px, or the 8px `redwood-stripe.svg` crop for compact chrome is active. Page is `--background`, cards are `--card`, table heads and inset blocks are `--background`/`--muted`. The punch-clock hero is the single dark surface: solid `--primary` with `--primary-muted-foreground` for its secondary text.

**Cards.** White, `1px solid var(--border)`, 12px radius, 20px padding (16px on compact KPI tiles, 24px on the hero), **no shadow, ever**. Rows inside a card are separated by `1px solid var(--muted)`; nested list items get a full `1px solid var(--muted)` border and 8px radius.

**Borders and dividers.** Everything structural is a 1px hairline: `--border` between regions (header, sidebar, modal sections, table head) and `--muted` for repetition inside a card. There are no double borders, no left-accent bars, no coloured card borders.

**Elevation.** Three shadows exist and each has exactly one job: `0 1px 2px rgba(0,0,0,.08)` on the active segment of a segmented control, `0 8px 30px rgba(0,0,0,.15)` on popovers, `0 8px 24px rgba(0,0,0,.25)` on the toast. Modals have no shadow — they rely on the `rgba(9,9,11,.5)` scrim.

**Radii.** 6 menu items · 7 the 28px logo tile · 8 buttons, inputs, list rows, inset blocks · 10 popovers and toast · 11 the 44px login tile · 12 cards and modals · 999 pills, dots, avatars.

**Spacing.** 2px base. Dense inside components (6/8/10/12), generous between them (20 between cards, 24 under a dashboard title). Page padding is `clamp(16px,3vw,28px)`, content caps at 1180px and centres. Grids use `repeat(auto-fit,minmax(min(100%,340px),1fr))` so columns collapse without media queries.

**Layout rules.** Sidebar is `position:sticky; top:0; height:100vh`, 240px expanded / 64px collapsed. Header is sticky at `top:0; z-index:5`. Below 1000px the shell collapses to the icon rail (or a dropdown in top-menu layout) and the persona switch moves into the user menu. Tables never wrap: they set a `min-width` and scroll horizontally inside the card.

**Transparency and blur.** No blur anywhere. Transparency is limited to the two scrims (`rgba(9,9,11,.5)` for modals, `rgba(0,0,0,.2)` behind the mobile nav) and the login error tint `rgba(220,38,38,.08)`.

**Motion.** One keyframe: `fadeIn` — 6px rise plus opacity, `.25s ease` on screens and `.2s` on modals. The only transition is the sidebar's `width .2s ease`. No bounce, no spring, no staggered entrance, no skeleton shimmer.

**States.** Hover changes background only — `--muted` on secondary/ghost/nav, `--primary-hover` on solid buttons, `--background` on clickable table rows, `--border` on the white button over the dark hero; icon-only buttons also darken their text to `--foreground`. Focus turns the input border `--primary` with no ring. There is **no press state** — no scale, no darkening — and no disabled styling in the source (the system adds 50% opacity where one is needed). Links are underlined with `text-underline-offset: 2px`, coloured `--primary`, and go `--secondary-foreground` on hover.

**Imagery.** There is none. People are represented by initials circles; status by coloured dots and pills; the brand by a letter tile.

## Iconography

A single stroke set, Lucide geometry, embedded inline in the source: 24×24 viewBox, `fill:none`, `stroke:currentColor`, `stroke-width:2`, round caps and joins. Rendered at 16px in the sidebar, 15px in the top nav and dropdowns, 14px in menu checkmarks and the sign-out item, 18–22px never.

Twelve glyphs are in use — five nav icons (home, clock, file-text, sun, briefcase) plus eye, panel-left, menu, bell, check, log-out and a monitor for SSO. All of them are reproduced in `components/core/Icon.jsx` as a name → path registry, copied verbatim; use `<Icon name="…" />` rather than pasting SVG. There is no icon font, no sprite sheet, no PNG icon and no SVG icon files in the repository — the paths *are* the asset. For a glyph that does not exist yet, take it from [Lucide](https://lucide.dev) at the same 2px weight; do not mix in a filled or duotone set.

Emoji are never used as icons. Two Unicode characters do act as glyphs: ✓ in toasts and the "Candidatura enviada ✓" badge, and ✕ as the modal close button. The middle dot · is typographic, not iconographic.

## Brand assets and gaps

- **No logo exists.** The repository contains no logo file, so the mark is what the product itself uses: a `--primary` rounded square containing the letter **C**, beside the wordmark "Compliance HCM" over "Portal do Trabalhador". `BrandMark` reproduces it at the three sizes in the source. Nothing here was drawn or reconstructed from memory — supply a real mark and replace that component.
- **Fonts.** The source declares `--font: 'Inter'` but the page actually links Geist from Google Fonts; Inter is never loaded, so the prototype renders in the system fallback. This system loads **Inter** (the declared family) from Google Fonts and keeps Geist available. If the intended family is Geist, or a licensed corporate face, send the files and this is a one-line change.
- **Redwood theme.** Documented in `guidelines/redwood-theme.card.html` and demonstrated end-to-end by the `Tela Redwood` template (`templates/redwood-page/`). Three things separate it from the product themes: the decorative image band at the top of every screen (`--redwood-band-height`, 132px), the type pair Oracle Sans + Georgia, and navigation that sits at the bottom of the screen. Oracle ships nine header accents (lilac, ocean, pebble, pine, plum, rose, sienna, slate, teal) that recolour band, avatar and primary action together; only the teal/ocean accent is packaged here.
- **Oracle Sans / redwood band** are Oracle brand assets copied from the repository and referenced only by the `netsuite-redwood` theme, which exists to compare Compliance HCM against NetSuite. They are not Compliance Soluções brand assets and should not be redistributed or used elsewhere.
- **Not provided:** marketing site, mobile app, slide template, brand book, tone-of-voice guide, illustration library, photography. Nothing was invented to fill those gaps.
