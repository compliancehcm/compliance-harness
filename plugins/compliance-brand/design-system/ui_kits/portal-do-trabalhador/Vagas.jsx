const { PageHeader, Card, Button, Badge, Chip, DataTable, Modal, Field, Input, Select, Textarea } = window.ComplianceHCMDesignSystem_dab0b1;

function Vagas({ isGestor, reqs, aplicadas, candidatar, onNovaReq }) {
  if (isGestor) {
    return (
      <section data-screen-label="Vagas" style={{ animation: 'fadeIn .25s ease' }}>
        <PageHeader title="Requisições de vaga" subtitle="Abertura e acompanhamento de vagas da sua área"
          action={<Button size="lg" onClick={onNovaReq}>Nova requisição</Button>} />
        <DataTable minWidth={560} rows={reqs} columns={[
          { key: 'id', label: 'Req.', width: '.6fr', style: { color: 'var(--muted-foreground)' }, render: r => '#' + r.id },
          { key: 'titulo', label: 'Cargo', width: '1.8fr', style: { fontWeight: 600 } },
          { key: 'area', label: 'Área', style: { color: 'var(--secondary-foreground)' } },
          { key: 'status', label: 'Status', render: r => <Badge tone={window.reqTone[r.status] || 'warning'}>{r.status}</Badge> },
          { key: 'cand', label: 'Candidatos', width: '.8fr' }
        ]} />
      </section>
    );
  }
  return (
    <section data-screen-label="Vagas" style={{ animation: 'fadeIn .25s ease' }}>
      <PageHeader title="Vagas internas" subtitle="Oportunidades de movimentação interna · candidatura confidencial" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: 16 }}>
        {window.vagasData.map(v => (
          <Card key={v.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{v.titulo}</div><Chip>{v.regime}</Chip>
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{v.area} · {v.local}</div>
            <div style={{ fontSize: 16, color: 'var(--secondary-foreground)', lineHeight: 1.5 }}>{v.desc}</div>
            <div style={{ marginTop: 'auto', paddingTop: 8 }}>
              {aplicadas[v.id]
                ? <Badge tone="success" style={{ padding: '4px 12px', fontSize: 13 }}>Candidatura enviada ✓</Badge>
                : <Button variant="secondary" onClick={() => candidatar(v.id)}>Candidatar-se</Button>}
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

function VagaModal({ onClose, onCriar }) {
  const [titulo, setTitulo] = React.useState('');
  const [area, setArea] = React.useState('Tecnologia');
  return (
    <Modal title="Nova requisição de vaga" subtitle="Segue para aprovação do RH e da diretoria" onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={() => onCriar(titulo || 'Nova vaga', area)}>Enviar requisição</Button></>}>
      <Field layout="block" label="Cargo" htmlFor="vg-titulo"><Input id="vg-titulo" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Analista de Dados Pleno" /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field layout="block" label="Área" htmlFor="vg-area">
          <select id="vg-area" value={area} onChange={e => setArea(e.target.value)} style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 14, background: 'var(--card)', color: 'var(--foreground)' }}>
            <option>Tecnologia</option><option>Financeiro</option><option>Operações</option><option>Comercial</option>
          </select>
        </Field>
        <Field layout="block" label="Motivo" htmlFor="vg-motivo"><Select id="vg-motivo" options={['Aumento de quadro', 'Substituição']} /></Field>
      </div>
      <Field layout="block" label="Justificativa" htmlFor="vg-just"><Textarea id="vg-just" rows={3} /></Field>
    </Modal>
  );
}
Object.assign(window, { Vagas, VagaModal });
