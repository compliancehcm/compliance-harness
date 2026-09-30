const { PageHeader, Card, Button, Badge, StatCard, ApprovalRow, Avatar, ProgressBar, Modal, Field, Input, Select, Textarea, Checkbox } = window.ComplianceHCMDesignSystem_dab0b1;

function Ferias({ isGestor, minhas, aprovacoes, decidirFerias, onSolicitar }) {
  if (isGestor) {
    return (
      <section data-screen-label="Férias" style={{ animation: 'fadeIn .25s ease' }}>
        <PageHeader title="Férias da equipe" subtitle="Aprovações pendentes e escala dos próximos meses" />
        <Card title="Aguardando sua aprovação" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {aprovacoes.map((f, i) => (
              <ApprovalRow key={i} rail={f.status ? 'done' : 'pending'} leading={<Avatar name={f.nome} />} title={f.nome} detail={f.periodo + ' · ' + f.dias + ' dias · saldo ' + f.saldo} status={f.status}
                onApprove={() => decidirFerias(i, 'Aprovada', 'Férias aprovadas ✓')} onReject={() => decidirFerias(i, 'Rejeitada', 'Férias rejeitadas')} />
            ))}
          </div>
        </Card>
        <Card title="Escala de férias · próximos 90 dias">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {window.escalaData.map(e => (
              <div key={e.nome} style={{ display: 'flex', alignItems: 'center', gap: '6px 12px', fontSize: 14, flexWrap: 'wrap' }}>
                <div style={{ width: 150, fontWeight: 500 }}>{e.nome}</div>
                <div style={{ color: 'var(--muted-foreground)', width: 150 }}>{e.periodo}</div>
                <ProgressBar value={e.len} offset={e.ini} />
              </div>
            ))}
          </div>
        </Card>
      </section>
    );
  }
  return (
    <section data-screen-label="Férias" style={{ animation: 'fadeIn .25s ease' }}>
      <PageHeader title="Minhas férias" subtitle={<>Saldo de 22 dias · período aquisitivo vence em <strong style={{ color: 'var(--accent-strong)', fontWeight: 700 }}>14/03/2027</strong></>}
        action={<Button size="lg" onClick={onSolicitar}>Solicitar férias</Button>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, marginBottom: 20 }}>
        <StatCard variant="primary" label="Saldo de férias" value="22 dias" caption="vence em 14/03/2027 · 22 de 30 dias"><ProgressBar value={73} tone="accent" on="dark" /></StatCard>
        <StatCard label="Dias já gozados" value="8" caption="período 2025/2026" />
        <StatCard label="Abono pecuniário" value="10 dias" caption="disponível para venda" />
      </div>
      <Card title="Minhas solicitações">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {minhas.map((f, i) => (
            <ApprovalRow key={i} rail={f.status === 'Aprovada' || f.status === 'Concluída' ? 'done' : 'pending'}
              title={f.periodo} detail={f.dias + ' dias · solicitado em ' + f.solicitado} status={f.status} />
          ))}
        </div>
      </Card>
    </section>
  );
}

function FeriasModal({ onClose, onEnviar }) {
  const [data, setData] = React.useState('');
  const [dias, setDias] = React.useState('15');
  return (
    <Modal title="Solicitar férias" subtitle="Saldo disponível: 22 dias" onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={() => onEnviar(data, parseInt(dias, 10))}>Enviar solicitação</Button></>}>
      <Field layout="block" label="Data de início" htmlFor="dt-inicio"><Input id="dt-inicio" type="date" value={data} onChange={e => setData(e.target.value)} /></Field>
      <Field layout="block" label="Quantidade de dias" htmlFor="dias-sel">
        <select id="dias-sel" value={dias} onChange={e => setDias(e.target.value)} style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 14, background: 'var(--card)', color: 'var(--foreground)' }}>
          <option value="30">30 dias</option><option value="20">20 dias</option><option value="15">15 dias</option><option value="10">10 dias</option><option value="5">5 dias</option>
        </select>
      </Field>
      <Checkbox label="Adiantar 13º salário" />
      <Field layout="block" label="Observações (opcional)" htmlFor="obs"><Textarea id="obs" rows={2} /></Field>
    </Modal>
  );
}
Object.assign(window, { Ferias, FeriasModal });
