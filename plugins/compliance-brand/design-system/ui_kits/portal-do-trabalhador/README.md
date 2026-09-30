# UI kit — Portal do Trabalhador

Click-through recreation of the Compliance HCM employee portal, composed entirely from this design system's components.

Open `index.html`. Flow:

1. **Login** — any e-mail + password, or the SSO button. Empty fields show the inline error.
2. **Dashboard** — funcionário sees the punch clock (Registrar ponto adds a batida), último holerite, avisos do RH, banco de horas, saldo de férias and atalhos. Switch to **Líder / Gestor** in the header for the KPI strip, approval queue, team roster and ponto alerts.
3. **Ponto** — espelho de ponto table; as gestor, the ajustes queue below it approves/rejects inline.
4. **Holerites** — click a row for the proventos/descontos detail modal.
5. **Férias** — funcionário requests a period (the new request appears at the top of the list); gestor approves and reads the 90-day escala.
6. **Vagas** — funcionário applies to internal openings; gestor opens a new requisition.

The user menu (avatar, bottom of the sidebar) switches the shell between sidebar and top menu, and cycles the five themes.

Files: `data.jsx` (mock data copied from the source prototype), one file per screen, `Portal.jsx` (shell + state).
