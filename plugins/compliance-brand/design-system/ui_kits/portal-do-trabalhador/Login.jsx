const { Input, Checkbox, Button, Icon } = window.ComplianceHCMDesignSystem_dab0b1;

const loginStats = [
  { n: '+1.200', l: 'colaboradores ativos' },
  { n: '99,9%', l: 'de disponibilidade' },
  { n: 'ISO 27001', l: 'segurança certificada' }
];

function Login({ onEntrar }) {
  const [email, setEmail] = React.useState('');
  const [senha, setSenha] = React.useState('');
  const [erro, setErro] = React.useState(null);
  const [ver, setVer] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const entrar = (via) => {
    if (via !== 'sso' && (!email.trim() || !senha)) { setErro('Informe seu e-mail (ou CPF) e senha.'); return; }
    if (loading) return;
    setLoading(true);
    setTimeout(() => onEntrar(via === 'sso' ? 'Autenticado via SSO corporativo' : 'Bem-vindo(a) de volta!'), via === 'sso' ? 900 : 700);
  };
  const blob = { position: 'absolute', borderRadius: '50%', background: 'rgba(245,166,35,.08)', pointerEvents: 'none' };
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'flex-start', background: 'var(--background)', color: 'var(--foreground)', overflow: 'auto', animation: 'fadeIn .25s ease' }}>
      <section style={{ position: 'relative', overflow: 'hidden', flex: '0 0 46%', alignSelf: 'stretch', minHeight: '100vh', gap: 48, background: 'var(--primary)', color: 'var(--primary-foreground)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '56px clamp(28px,4vw,64px) 44px' }}>
        <div style={{ ...blob, top: -40, right: -70, width: 220, height: 220 }}></div>
        <div style={{ ...blob, bottom: -110, left: -100, width: 290, height: 290 }}></div>
        <header style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <img src="../../assets/logo-compliance-branco.png" alt="Compliance Soluções" style={{ width: 238, height: 'auto', display: 'block', maxWidth: '100%' }} />
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--primary-muted-foreground)' }}>Portal do Trabalhador</div>
        </header>
        <div style={{ position: 'relative', maxWidth: 520 }}>
          <div style={{ width: 64, height: 4, borderRadius: 999, background: 'var(--accent)', marginBottom: 28 }}></div>
          <h2 style={{ margin: 0, fontSize: 'clamp(30px,3.4vw,44px)', lineHeight: 1.1, fontWeight: 700, letterSpacing: 'var(--tracking-h1)' }}>Seu RH, resolvido em poucos cliques.</h2>
          <p style={{ margin: '22px 0 0', fontSize: 16, lineHeight: 1.55, color: 'var(--primary-muted-foreground)', maxWidth: 440, textWrap: 'pretty' }}>Férias, ponto, holerites e vagas internas em um só lugar — 100% cloud, disponível quando você precisar.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 28, rowGap: 24, marginTop: 40 }}>
            {loginStats.map((s, i) => (
              <div key={s.n} style={i ? { borderLeft: '1px solid var(--nav-border)', paddingLeft: 28 } : null}>
                <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 'var(--tracking-h1)' }}>{s.n}</div>
                <div style={{ fontSize: 13, color: 'var(--primary-muted-foreground)', marginTop: 4 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: 'relative', fontSize: 13, color: 'var(--nav-muted)' }}>© 2026 Compliance Soluções · Todos os direitos reservados</div>
      </section>
      <section style={{ flex: 1, minWidth: 0, alignSelf: 'stretch', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(24px,4vw,48px) clamp(20px,4vw,40px)' }}>
        <div style={{ width: '100%', maxWidth: 440 }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 'var(--tracking-caps)', textTransform: 'uppercase', color: 'var(--accent-strong)' }}>Bem-vindo de volta</div>
          <h1 style={{ margin: '12px 0 0', fontSize: 34, fontWeight: 700, letterSpacing: 'var(--tracking-h1)', color: 'var(--heading)' }}>Acesse sua conta</h1>
          <p style={{ margin: '10px 0 0', fontSize: 15, color: 'var(--muted-foreground)' }}>Use seu e-mail corporativo para entrar no portal.</p>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--secondary-foreground)', margin: '30px 0 8px' }}>E-mail corporativo</label>
          <Input placeholder="nome@empresa.com.br" value={email} onChange={e => { setEmail(e.target.value); setErro(null); }} />
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, margin: '20px 0 8px' }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--secondary-foreground)' }}>Senha</label>
            <a href="#" onClick={e => e.preventDefault()} style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-strong)', textDecoration: 'none' }}>Esqueci minha senha</a>
          </div>
          <Input type={ver ? 'text' : 'password'} placeholder="••••••••" value={senha} onChange={e => { setSenha(e.target.value); setErro(null); }}
            trailing={<button type="button" onClick={() => setVer(v => !v)} title={ver ? 'Ocultar senha' : 'Mostrar senha'} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 6, color: 'var(--muted-foreground)', display: 'flex' }}><Icon name="olho" size={16} /></button>} />
          {erro ? <div style={{ fontSize: 13, color: 'var(--danger-soft-fg)', background: 'var(--danger-soft-bg)', border: '1px solid var(--danger-soft-border)', borderRadius: 8, padding: '8px 12px', marginTop: 12 }}>{erro}</div> : null}
          <div style={{ margin: '20px 0 24px' }}><Checkbox label="Manter conectado neste dispositivo" defaultChecked /></div>
          <Button size="lg" fullWidth onClick={() => entrar('senha')}>{loading ? 'Entrando…' : 'Entrar'}</Button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '24px 0' }}>
            <span style={{ flex: 1, height: 1, background: 'var(--border)' }}></span>
            <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>ou</span>
            <span style={{ flex: 1, height: 1, background: 'var(--border)' }}></span>
          </div>
          <Button variant="secondary" size="lg" fullWidth onClick={() => entrar('sso')} icon={<Icon name="sso" size={16} />}>Entrar com SSO da empresa</Button>
          <p style={{ margin: '28px 0 0', fontSize: 14, color: 'var(--muted-foreground)' }}>Primeiro acesso? <a href="#" onClick={e => e.preventDefault()} style={{ color: 'var(--accent-strong)', fontWeight: 600, textDecoration: 'none' }}>Ative sua conta</a> com o código enviado pelo RH.</p>
        </div>
      </section>
    </div>
  );
}
Object.assign(window, { Login });
