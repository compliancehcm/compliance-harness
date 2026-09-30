const { PageHeader, DataTable, Chip, Modal, Button } = window.ComplianceHCMDesignSystem_dab0b1;

function Holerites({ onAbrir }) {
  return (
    <section data-screen-label="Holerite" style={{ animation: 'fadeIn .25s ease' }}>
      <PageHeader title="Holerites" subtitle="Demonstrativos de pagamento · clique para ver o detalhe" />
      <DataTable minWidth={560} rows={window.holeriteData} onRowClick={onAbrir} columns={[
        { key: 'mes', label: 'Competência', width: '1.4fr', style: { fontWeight: 600 } },
        { key: 'tipo', label: 'Tipo', render: r => <Chip>{r.tipo}</Chip> },
        { key: 'bruto', label: 'Bruto', style: { color: 'var(--secondary-foreground)' } },
        { key: 'liquido', label: 'Líquido', style: { fontWeight: 600 } },
        { key: 'pago', label: 'Pagamento', width: '.8fr', style: { color: 'var(--muted-foreground)' } }
      ]} />
    </section>
  );
}

function HoleriteModal({ holerite, onClose, onBaixar }) {
  if (!holerite) return null;
  const linha = (item, negativo) => (
    <div key={item.nome} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--muted)', fontSize: 14 }}>
      <div>{item.nome} <span style={{ color: 'var(--primary-muted-foreground)', fontSize: 13 }}>{item.ref}</span></div>
      <div style={{ fontWeight: 500, color: negativo ? 'var(--danger)' : 'inherit' }}>{negativo ? '− ' : ''}{item.valor}</div>
    </div>
  );
  const eyebrow = { fontSize: 13, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '.05em' };
  return (
    <Modal width={560} closeButton onClose={onClose} title={'Holerite · ' + holerite.mes}
      subtitle={holerite.tipo + ' · pago em ' + holerite.pago + ' · Compliance HCM Ltda.'}
      footer={<><Button variant="secondary" onClick={onClose}>Fechar</Button><Button onClick={onBaixar}>Baixar PDF</Button></>}>
      <div style={{ display: 'block' }}>
        <div style={{ ...eyebrow, marginBottom: 8 }}>Proventos</div>
        {window.proventos.map(p => linha(p, false))}
        <div style={{ ...eyebrow, margin: '18px 0 8px' }}>Descontos</div>
        {window.descontos.map(d => linha(d, true))}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, padding: '14px 16px', background: 'var(--muted)', borderRadius: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Líquido a receber</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{holerite.liquido}</div>
        </div>
      </div>
    </Modal>
  );
}
Object.assign(window, { Holerites, HoleriteModal });
