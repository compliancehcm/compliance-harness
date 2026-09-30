const { PageHeader, Button, Card, DataTable, Badge, ApprovalRow } = window.ComplianceHCMDesignSystem_dab0b1;

function Ponto({ isGestor, clock, onRegistrar, ajustes, decidirAjuste }) {
  const saldoStyle = s => ({ color: s.startsWith('+') ? 'var(--success)' : s.startsWith('−') ? 'var(--danger)' : 'var(--muted-foreground)', fontWeight: 500 });
  return (
    <section data-screen-label="Ponto" style={{ animation: 'fadeIn .25s ease' }}>
      <PageHeader title="Espelho de ponto" subtitle="Julho de 2026 · fechamento em 31/07"
        action={<Button size="lg" onClick={onRegistrar}>Registrar ponto · {clock}</Button>} />
      <DataTable style={{ marginBottom: 20 }} minWidth={660} rows={window.espelhoData} columns={[
        { key: 'data', label: 'Data', width: '1.1fr', style: { fontWeight: 500 } },
        { key: 'horas', label: 'Batidas', width: '1.8fr', style: { color: 'var(--secondary-foreground)', fontVariantNumeric: 'tabular-nums' } },
        { key: 'previsto', label: 'Previsto', width: '.7fr', style: { color: 'var(--muted-foreground)' } },
        { key: 'realizado', label: 'Realizado', width: '.7fr' },
        { key: 'saldo', label: 'Saldo', width: '.7fr', render: r => <span style={saldoStyle(r.saldo)}>{r.saldo}</span> },
        { key: 'st', label: 'Situação', width: '.9fr', render: r => <Badge status={r.ok ? 'OK' : 'Inconsistente'} /> }
      ]} />
      {isGestor ? (
        <Card title="Ajustes de ponto da equipe">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ajustes.map((a, i) => (
              <ApprovalRow key={i} title={a.nome} detail={a.detalhe} status={a.status} approveLabel="Aprovar ajuste"
                onApprove={() => decidirAjuste(i, 'Aprovado', 'Ajuste de ponto aprovado ✓')} onReject={() => decidirAjuste(i, 'Rejeitado', 'Ajuste de ponto rejeitado')} />
            ))}
          </div>
        </Card>
      ) : null}
    </section>
  );
}
Object.assign(window, { Ponto });
