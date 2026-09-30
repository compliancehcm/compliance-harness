repo: vertechit/ComplianceHCM_Design
branch: main
path: (whole repo)

## Last sync

date: 2026-08-10T22:15:43Z

### Updated in this project

- Extracted tokens, themes and type scale from `Portal do Trabalhador.dc.html` into `tokens/`.
- Authored 25 React components from the prototype's repeated patterns.
- Rebuilt the full Portal do Trabalhador UI kit on those components.
- Copied `assets/redwood-stripe.svg` and the Oracle Sans woff2 used by the Redwood theme.

## Screen map

| Project screen | Built from |
| --- | --- |
| `ui_kits/portal-do-trabalhador/Login.jsx` | `Portal do Trabalhador.dc.html` — `showLogin` block |
| `ui_kits/portal-do-trabalhador/DashFuncionario.jsx` | `Portal do Trabalhador.dc.html` — `showDashFunc` section |
| `ui_kits/portal-do-trabalhador/DashGestor.jsx` | `Portal do Trabalhador.dc.html` — `showDashGestor` section |
| `ui_kits/portal-do-trabalhador/Ponto.jsx` | `Portal do Trabalhador.dc.html` — `showPonto` section |
| `ui_kits/portal-do-trabalhador/Holerites.jsx` | `Portal do Trabalhador.dc.html` — `showHolerite` + holerite modal |
| `ui_kits/portal-do-trabalhador/Ferias.jsx` | `Portal do Trabalhador.dc.html` — `showFerias` + férias modal |
| `ui_kits/portal-do-trabalhador/Vagas.jsx` | `Portal do Trabalhador.dc.html` — `showVagas` + vaga modal |
| `ui_kits/portal-do-trabalhador/Portal.jsx` | shell: sidebar, header, popovers, toast, temas |
| `tokens/*.css` | `<helmet>` `:root` and `[data-theme]` blocks |
| `components/**` | repeated inline styles across the same file |
