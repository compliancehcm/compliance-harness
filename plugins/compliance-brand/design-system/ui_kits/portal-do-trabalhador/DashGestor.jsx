const { Card, StatCard, Button, Badge, ApprovalRow, PersonRow, AlertItem, Avatar } = window.ComplianceHCMDesignSystem_dab0b1;

function DashGestor({ pendencias, decidir, ir }) {
  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const h = new Date().getHours();
  const saudacao = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const abertas = pendencias.filter(p => !p.status).length;
  return (
    <section data-screen-label="Dashboard Gestor" style={{ animation: 'fadeIn .25s ease' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-.02em' }}>{saudacao}, Ricardo</h1>
        <div style={{ fontSize: 14, color: 'var(--muted-foreground)', marginTop: 4 }}>{hoje} · Equipe Tecnologia · 18 pessoas</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,200px),1fr))', gap: 16, marginBottom: 20 }}>
        <StatCard label="Pendências de aprovação" value={abertas} caption="férias, ponto e vagas" />
        <StatCard label="Presentes hoje" value="14" suffix="/18" caption="2 em férias · 1 ausente · 1 home office" />
        <StatCard label="Inconsistências de ponto" value="3" tone="negative" caption="nos últimos 7 dias" />
        <StatCard label="Vagas abertas" value="4" caption="37 candidaturas ativas" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,340px),1fr))', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Card title="Pendências de aprovação">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pendencias.map((p, i) => (
                <ApprovalRow key={i} tag={<Badge tone={window.tagTone[p.tipo]}>{p.tipo}</Badge>} title={p.titulo} detail={p.detalhe} status={p.status}
                  onApprove={() => decidir(i, 'Aprovada', 'Solicitação aprovada ✓')} onReject={() => decidir(i, 'Rejeitada', 'Solicitação rejeitada')} />
              ))}
            </div>
          </Card>
          <Card title="Equipe hoje">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,240px),1fr))', gap: '8px 20px' }}>
              {window.equipeData.map(m => <PersonRow key={m.nome} name={m.nome} role={m.cargo} status={m.status} />)}
            </div>
          </Card>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Card title="Alertas de ponto">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {window.alertasPonto.map(a => <AlertItem key={a.nome} title={a.nome} description={a.motivo} />)}
            </div>
            <Button variant="secondary" fullWidth onClick={() => ir('ponto')} style={{ marginTop: 12, padding: 8, fontSize: 13, fontWeight: 500 }}>Revisar ajustes de ponto</Button>
          </Card>
          <Card title="Pessoas em destaque · Julho">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {window.destaques.map(d => (
                <div key={d.nome} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar name={d.nome} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 500 }}>{d.nome}</div><div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{d.motivo}</div></div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
Object.assign(window, { DashGestor });
