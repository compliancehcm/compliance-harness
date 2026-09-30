const NS = window.ComplianceHCMDesignSystem_dab0b1;
const { Sidebar, AppHeader, NavItem, DropdownMenu, MenuSection, MenuItem, Avatar, Toast, NotificationItem, IconButton, BrandMark } = NS;

const TEMAS = [
  { id: 'claro', label: 'Claro' }, { id: 'escuro', label: 'Escuro' },
  { id: 'compliance-light', label: 'Compliance Light' }, { id: 'alma-dark', label: 'Alma RH — Dark' },
  { id: 'netsuite-redwood', label: 'NetSuite Redwood' }
];

function Portal() {
  const [logado, setLogado] = React.useState(false);
  const [persona, setPersona] = React.useState('funcionario');
  const [screen, setScreen] = React.useState('dash');
  const [colapsada, setColapsada] = React.useState(false);
  const [layout, setLayout] = React.useState('sidebar');
  const [tema, setTema] = React.useState('claro');
  const [menu, setMenu] = React.useState(null); // 'user' | 'notif'
  const [modal, setModal] = React.useState(null);
  const [holerite, setHolerite] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const [clock, setClock] = React.useState('');
  const [batidas, setBatidas] = React.useState([{ t: '08:02', tipo: 'Entrada' }, { t: '12:01', tipo: 'Saída almoço' }, { t: '13:04', tipo: 'Retorno' }]);
  const [pendencias, setPendencias] = React.useState(window.pendenciasData);
  const [ajustes, setAjustes] = React.useState(window.ajustesData);
  const [feriasAprov, setFeriasAprov] = React.useState(window.feriasAprovData);
  const [minhasFerias, setMinhasFerias] = React.useState([
    { periodo: '10/08/2026 – 24/08/2026', dias: 15, solicitado: '12/07/2026', status: 'Aguardando aprovação' },
    { periodo: '22/12/2025 – 31/12/2025', dias: 10, solicitado: '02/11/2025', status: 'Concluída' }
  ]);
  const [reqs, setReqs] = React.useState(window.reqsData);
  const [aplicadas, setAplicadas] = React.useState({});
  const [notifs, setNotifs] = React.useState({ funcionario: window.notifsFunc, gestor: window.notifsGestor });

  React.useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    tick(); const iv = setInterval(tick, 15000); return () => clearInterval(iv);
  }, []);
  React.useEffect(() => { document.documentElement.setAttribute('data-theme', tema); }, [tema]);

  const aviso = msg => { setToast(msg); setTimeout(() => setToast(null), 2600); };
  const isFunc = persona === 'funcionario';
  const isGestor = !isFunc;
  const abertas = pendencias.filter(p => !p.status).length;
  const nav = (isFunc ? window.navFuncionario : window.navGestor).map(n => n.key === 'dash' && isGestor ? { ...n, badge: abertas || false } : n);
  const titles = { dash: 'Visão geral', ponto: isFunc ? 'Meu ponto' : 'Ponto da equipe', holerite: 'Holerites', ferias: 'Férias', vagas: isFunc ? 'Vagas internas' : 'Requisições de vaga' };
  const lista = notifs[persona];
  const naoLidas = lista.filter(n => !n.lida).length || false;
  const user = isFunc ? { name: 'Mariana Alves', role: 'Analista de Marketing Pl' } : { name: 'Ricardo Teixeira', role: 'Gerente de Tecnologia' };

  const decidir = (setter, key) => (i, status, msg) => { setter(list => list.map((it, j) => j === i ? { ...it, status } : it)); aviso(msg); };
  const registrarPonto = () => {
    const t = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    setBatidas(b => [...b, { t, tipo: b.length % 2 === 0 ? 'Entrada' : 'Saída' }]);
    aviso('Ponto registrado às ' + t + ' ✓');
  };
  const trocarPersona = p => { setPersona(p); setScreen('dash'); setModal(null); };

  if (!logado) return <window.Login onEntrar={msg => { setLogado(true); aviso(msg); }} />;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)' }}>
      {layout === 'sidebar' ? (
        <Sidebar items={nav} activeKey={screen} collapsed={colapsada} user={user} onSelect={setScreen} onUserClick={() => setMenu(m => m === 'user' ? null : 'user')} />
      ) : null}
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <AppHeader layout={layout} title={titles[screen]} items={nav} activeKey={screen} onSelect={setScreen}
          onToggleNav={() => setColapsada(c => !c)} persona={persona} onPersonaChange={trocarPersona}
          notificationCount={naoLidas} onNotifications={() => setMenu(m => m === 'notif' ? null : 'notif')}
          redwoodStripe={tema === 'netsuite-redwood'}
          avatar={layout === 'topo' ? <button onClick={() => setMenu(m => m === 'user' ? null : 'user')} aria-label="Menu do usuário" style={{ width: 34, height: 34, borderRadius: 999, border: '1px solid var(--border)', background: 'var(--muted)', color: 'var(--secondary-foreground)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{user.name.split(' ').map(x => x[0]).join('')}</button> : null} />
        <div style={{ padding: 'clamp(16px,3vw,28px)', maxWidth: 1180, width: '100%', boxSizing: 'border-box', margin: '0 auto' }}>
          {screen === 'dash' && isFunc ? <window.DashFuncionario clock={clock} batidas={batidas} onRegistrar={registrarPonto} ir={setScreen} abrirHolerite={() => setHolerite(window.holeriteData[0])} /> : null}
          {screen === 'dash' && isGestor ? <window.DashGestor pendencias={pendencias} decidir={decidir(setPendencias)} ir={setScreen} /> : null}
          {screen === 'ponto' ? <window.Ponto isGestor={isGestor} clock={clock} onRegistrar={registrarPonto} ajustes={ajustes} decidirAjuste={decidir(setAjustes)} /> : null}
          {screen === 'holerite' ? <window.Holerites onAbrir={setHolerite} /> : null}
          {screen === 'ferias' ? <window.Ferias isGestor={isGestor} minhas={minhasFerias} aprovacoes={feriasAprov} decidirFerias={decidir(setFeriasAprov)} onSolicitar={() => setModal('ferias')} /> : null}
          {screen === 'vagas' ? <window.Vagas isGestor={isGestor} reqs={reqs} aplicadas={aplicadas} onNovaReq={() => setModal('vaga')} candidatar={id => { setAplicadas(a => ({ ...a, [id]: true })); aviso('Candidatura enviada ao RH ✓'); }} /> : null}
        </div>
      </main>

      <window.HoleriteModal holerite={holerite} onClose={() => setHolerite(null)} onBaixar={() => aviso('Download iniciado (demonstração)')} />
      {modal === 'ferias' ? <window.FeriasModal onClose={() => setModal(null)} onEnviar={(raw, dias) => {
        let periodo = 'A definir';
        if (raw) { const d1 = new Date(raw + 'T12:00:00'); const d2 = new Date(d1); d2.setDate(d2.getDate() + dias - 1); periodo = d1.toLocaleDateString('pt-BR') + ' – ' + d2.toLocaleDateString('pt-BR'); }
        setMinhasFerias(l => [{ periodo, dias, solicitado: new Date().toLocaleDateString('pt-BR'), status: 'Aguardando aprovação' }, ...l]);
        setModal(null); aviso('Solicitação de férias enviada ao gestor ✓');
      }} /> : null}
      {modal === 'vaga' ? <window.VagaModal onClose={() => setModal(null)} onCriar={(titulo, area) => {
        setReqs(l => [{ id: 132, titulo, area, status: 'Em aprovação', cand: '—' }, ...l]); setModal(null); aviso('Requisição enviada para aprovação ✓');
      }} /> : null}

      {menu === 'notif' ? (
        <DropdownMenu width={360} anchor={{ right: 16, top: 60 }} onClose={() => setMenu(null)} style={{ padding: 0 }}
          header={<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Notificações</div>
            <button onClick={() => setNotifs(n => ({ ...n, [persona]: n[persona].map(x => ({ ...x, lida: true })) }))} style={{ border: 'none', background: 'none', fontSize: 13, color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2, padding: 0 }}>Marcar todas como lidas</button>
          </div>}>
          <div style={{ maxHeight: 380, overflowY: 'auto', margin: -6 }}>
            {lista.map((n, i) => <NotificationItem key={i} title={n.titulo} text={n.texto} time={n.tempo} read={n.lida} />)}
          </div>
        </DropdownMenu>
      ) : null}

      {menu === 'user' ? (
        <DropdownMenu width={220} onClose={() => setMenu(null)}
          anchor={layout === 'topo' ? { right: 16, top: 60 } : { left: colapsada ? 72 : 12, bottom: 60 }}
          header={<div><div style={{ fontSize: 14, fontWeight: 600 }}>{user.name}</div><div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{user.role}</div></div>}
          footer={<MenuItem icon="sair" label="Sair" onClick={() => { setLogado(false); setMenu(null); setScreen('dash'); }} />}>
          <MenuSection label="Menu">
            <MenuItem label="Sidebar retrátil" selected={layout === 'sidebar'} onClick={() => setLayout('sidebar')} />
            <MenuItem label="Menu superior" selected={layout === 'topo'} onClick={() => setLayout('topo')} />
          </MenuSection>
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 4 }}>
            <MenuSection label="Tema">
              {TEMAS.map(t => <MenuItem key={t.id} label={t.label} selected={t.id === tema} onClick={() => setTema(t.id)} />)}
            </MenuSection>
          </div>
        </DropdownMenu>
      ) : null}

      <Toast message={toast} />
    </div>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<Portal />);
