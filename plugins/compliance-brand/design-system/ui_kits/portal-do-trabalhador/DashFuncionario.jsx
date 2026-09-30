const { Card, StatCard, Button, Badge } = window.ComplianceHCMDesignSystem_dab0b1;

function DashFuncionario({ clock, batidas, onRegistrar, ir, abrirHolerite }) {
  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const h = new Date().getHours();
  const saudacao = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  return (
    <section data-screen-label="Dashboard Funcionário" style={{ animation: 'fadeIn .25s ease' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-.02em' }}>{saudacao}, Mariana</h1>
        <div style={{ fontSize: 14, color: 'var(--muted-foreground)', marginTop: 4 }}>{hoje}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,340px),1fr))', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: 'var(--primary)', color: 'var(--primary-foreground)', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--primary-muted-foreground)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>Registro de ponto</div>
                <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1.1, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{clock}</div>
                <div style={{ fontSize: 14, color: 'var(--primary-muted-foreground)', marginTop: 2 }}>Jornada prevista: 08:48 · Realizado hoje: 5h 03min</div>
              </div>
              <Button variant="onPrimary" onClick={onRegistrar} style={{ padding: '12px 22px' }}>Registrar ponto</Button>
            </div>
            <div style={{ display: 'flex', gap: 20, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--primary-hover)', flexWrap: 'wrap' }}>
              {batidas.map((b, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--presence-on-dark)' }}></span>
                  <span style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{b.t}</span>
                  <span style={{ fontSize: 13, color: 'var(--primary-muted-foreground)' }}>{b.tipo}</span>
                </div>
              ))}
            </div>
          </div>
          <Card title="Último holerite" action={<Button variant="link" onClick={() => ir('holerite')}>Ver todos</Button>}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>Junho 2026 · Mensal</div>
                <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', marginTop: 2 }}>R$ 6.842,19</div>
                <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>líquido · pago em 30/06/2026</div>
              </div>
              <Button variant="secondary" onClick={abrirHolerite}>Ver detalhes</Button>
            </div>
          </Card>
          <Card title="Avisos do RH">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {window.avisos.map(a => (
                <div key={a.titulo} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--primary)', marginTop: 6, flexShrink: 0 }}></span>
                  <div><div style={{ fontSize: 14, fontWeight: 500 }}>{a.titulo}</div><div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 1 }}>{a.data} · {a.resumo}</div></div>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <StatCard size="lg" label="Banco de horas" value="+ 6h 12min" tone="positive" caption="Atualizado em 27/07 · compensação até 30/09" />
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, color: 'var(--muted-foreground)', fontWeight: 500 }}>Saldo de férias</div>
              <Button variant="link" style={{ fontSize: 13 }} onClick={() => ir('ferias')}>Agendar</Button>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-.02em', marginTop: 4 }}>22 dias</div>
            <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 2 }}>Período aquisitivo vence em 14/03/2027</div>
            <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--muted)', borderRadius: 8, fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>Próximas férias:</span> 10/08 – 24/08 <Badge style={{ marginLeft: 6, padding: '1px 8px' }}>Aguardando aprovação</Badge>
            </div>
          </div>
          <Card title="Atalhos">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[['ponto', 'Espelho de ponto'], ['ferias', 'Solicitar férias'], ['holerite', 'Holerites'], ['vagas', 'Vagas internas']].map(([k, l]) => (
                <Button key={l} variant="secondary" onClick={() => ir(k)} style={{ padding: 10, fontSize: 13, fontWeight: 500, justifyContent: 'flex-start' }}>{l}</Button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
Object.assign(window, { DashFuncionario });
