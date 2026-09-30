// Mock data — copied from Portal do Trabalhador.dc.html.
const navFuncionario = [
  { key: 'dash', icon: 'dash', label: 'Início' },
  { key: 'ponto', icon: 'ponto', label: 'Meu ponto' },
  { key: 'holerite', icon: 'holerite', label: 'Holerites' },
  { key: 'ferias', icon: 'ferias', label: 'Minhas férias' },
  { key: 'vagas', icon: 'vagas', label: 'Vagas internas' }
];
const navGestor = [
  { key: 'dash', icon: 'dash', label: 'Início' },
  { key: 'ponto', icon: 'ponto', label: 'Ponto da equipe' },
  { key: 'holerite', icon: 'holerite', label: 'Meu holerite' },
  { key: 'ferias', icon: 'ferias', label: 'Férias da equipe' },
  { key: 'vagas', icon: 'vagas', label: 'Requisições de vaga' }
];
const holeriteData = [
  { mes: 'Junho 2026', tipo: 'Mensal', bruto: 'R$ 9.480,00', liquido: 'R$ 6.842,19', pago: '30/06/2026' },
  { mes: 'Maio 2026', tipo: 'Mensal', bruto: 'R$ 9.480,00', liquido: 'R$ 6.798,55', pago: '29/05/2026' },
  { mes: 'Abril 2026', tipo: 'Mensal', bruto: 'R$ 9.792,40', liquido: 'R$ 7.011,08', pago: '30/04/2026' },
  { mes: 'Março 2026', tipo: 'Mensal', bruto: 'R$ 9.480,00', liquido: 'R$ 6.842,19', pago: '31/03/2026' },
  { mes: 'Fevereiro 2026', tipo: 'Mensal', bruto: 'R$ 9.480,00', liquido: 'R$ 6.842,19', pago: '27/02/2026' },
  { mes: 'Dezembro 2025', tipo: '13º salário', bruto: 'R$ 9.480,00', liquido: 'R$ 7.914,30', pago: '18/12/2025' }
];
const proventos = [
  { nome: 'Salário base', ref: '30 dias', valor: 'R$ 8.900,00' },
  { nome: 'Horas extras 50%', ref: '6h', valor: 'R$ 364,00' },
  { nome: 'Adicional por tempo de serviço', ref: '2%', valor: 'R$ 216,00' }
];
const descontos = [
  { nome: 'INSS', ref: '14%', valor: 'R$ 951,62' },
  { nome: 'IRRF', ref: '22,5%', valor: 'R$ 1.186,19' },
  { nome: 'Vale-transporte', ref: '6%', valor: 'R$ 300,00' },
  { nome: 'Plano de saúde', ref: 'coparticipação', valor: 'R$ 200,00' }
];
const espelhoData = [
  { data: 'Seg, 21/07', horas: '08:01 · 12:03 · 13:00 · 17:58', previsto: '8h48', realizado: '8h58', saldo: '+0h10', ok: true },
  { data: 'Ter, 22/07', horas: '07:58 · 12:00 · — · 18:04', previsto: '8h48', realizado: '—', saldo: '—', ok: false },
  { data: 'Qua, 23/07', horas: '08:05 · 12:01 · 13:02 · 18:10', previsto: '8h48', realizado: '9h04', saldo: '+0h16', ok: true },
  { data: 'Qui, 24/07', horas: '08:00 · 12:02 · 13:00 · 17:45', previsto: '8h48', realizado: '8h31', saldo: '−0h17', ok: true },
  { data: 'Sex, 25/07', horas: '08:03 · 12:00 · 13:01 · 18:00', previsto: '8h48', realizado: '8h44', saldo: '−0h04', ok: true },
  { data: 'Seg, 28/07', horas: '08:02 · 12:01 · 13:04', previsto: '8h48', realizado: 'em andamento', saldo: '—', ok: true }
];
const equipeData = [
  { nome: 'Ana Souza', cargo: 'Dev Front-end Pl', status: 'Presente' },
  { nome: 'Carlos Lima', cargo: 'Dev Back-end Sr', status: 'Presente' },
  { nome: 'Juliana Prado', cargo: 'QA Pleno', status: 'Home office' },
  { nome: 'Diego Farias', cargo: 'DevOps Sr', status: 'Presente' },
  { nome: 'Beatriz Melo', cargo: 'Product Designer', status: 'Ausente' },
  { nome: 'Rafael Nunes', cargo: 'Dev Back-end Pl', status: 'Presente' },
  { nome: 'Larissa Costa', cargo: 'Dev Front-end Jr', status: 'Férias' },
  { nome: 'Pedro Ramos', cargo: 'Tech Lead', status: 'Férias' }
];
const escalaData = [
  { nome: 'Larissa Costa', periodo: '20/07 – 03/08', ini: 0, len: 32 },
  { nome: 'Pedro Ramos', periodo: '27/07 – 10/08', ini: 16, len: 32 },
  { nome: 'Ana Souza', periodo: '10/08 – 24/08', ini: 30, len: 32 },
  { nome: 'Juliana Prado', periodo: '01/09 – 10/09', ini: 55, len: 22 },
  { nome: 'Diego Farias', periodo: '14/09 – 28/09', ini: 70, len: 30 }
];
const vagasData = [
  { id: 'v1', titulo: 'Desenvolvedor(a) Back-end Sr', area: 'Tecnologia', local: 'São Paulo · Híbrido', regime: 'CLT', desc: 'Plataforma de folha e integrações. Node.js, PostgreSQL e mensageria.' },
  { id: 'v2', titulo: 'Analista de DevOps', area: 'Tecnologia', local: 'Remoto', regime: 'CLT', desc: 'Esteiras CI/CD, observabilidade e infraestrutura como código.' },
  { id: 'v3', titulo: 'Analista de RH · DP', area: 'Pessoas & Cultura', local: 'São Paulo · Presencial', regime: 'CLT', desc: 'Rotinas de departamento pessoal, folha e atendimento ao colaborador.' },
  { id: 'v4', titulo: 'Coordenador(a) Financeiro', area: 'Financeiro', local: 'Campinas · Híbrido', regime: 'CLT', desc: 'Liderança do time de contas a pagar/receber e planejamento.' }
];
const reqsData = [
  { id: 131, titulo: 'Analista de Dados Pleno', area: 'Tecnologia', status: 'Em aprovação', cand: '—' },
  { id: 128, titulo: 'Desenvolvedor(a) Back-end Sr', area: 'Tecnologia', status: 'Divulgada', cand: 14 },
  { id: 124, titulo: 'Analista de DevOps', area: 'Tecnologia', status: 'Divulgada', cand: 9 },
  { id: 119, titulo: 'Tech Lead · Plataforma', area: 'Tecnologia', status: 'Em entrevistas', cand: 6 },
  { id: 112, titulo: 'Estágio em QA', area: 'Tecnologia', status: 'Encerrada', cand: 41 }
];
const avisos = [
  { titulo: 'Recadastramento do plano de saúde', data: '25/07', resumo: 'prazo até 08/08 no portal de benefícios' },
  { titulo: 'Feriado de 7 de setembro', data: '22/07', resumo: 'expediente encerra às 14h na sexta 04/09' },
  { titulo: 'Campanha de vacinação contra a gripe', data: '18/07', resumo: 'agendamento aberto para colaboradores e dependentes' }
];
const notifsFunc = [
  { titulo: 'Holerite de Junho disponível', texto: 'Seu demonstrativo de Junho/2026 já pode ser consultado.', tempo: 'há 2 horas', lida: false },
  { titulo: 'Inconsistência no ponto', texto: 'Batida de retorno ausente em 22/07. Solicite o ajuste no espelho de ponto.', tempo: 'há 1 dia', lida: false },
  { titulo: 'Recadastramento do plano de saúde', texto: 'O RH pede a atualização dos dados de dependentes até 08/08.', tempo: 'há 3 dias', lida: false },
  { titulo: 'Férias registradas', texto: 'Sua solicitação de 10/08 a 24/08 foi enviada ao gestor.', tempo: 'há 2 semanas', lida: true }
];
const notifsGestor = [
  { titulo: 'Nova solicitação de férias', texto: 'Ana Souza solicitou férias de 10/08 a 24/08 (15 dias).', tempo: 'há 40 min', lida: false },
  { titulo: 'Ajuste de ponto pendente', texto: 'Carlos Lima pediu inclusão de batida em 22/07.', tempo: 'há 3 horas', lida: false },
  { titulo: 'Requisição de vaga aprovada', texto: 'Req. #128 · Desenvolvedor(a) Back-end Sr foi aprovada pela diretoria.', tempo: 'há 1 dia', lida: false },
  { titulo: 'Fechamento da folha', texto: 'A competência 07/2026 fecha em 31/07. Revise as pendências da equipe.', tempo: 'há 2 dias', lida: false },
  { titulo: 'Aniversariante da equipe', texto: 'Larissa Costa faz aniversário em 30/07.', tempo: 'há 3 dias', lida: true }
];
const pendenciasData = [
  { tipo: 'Férias', titulo: 'Ana Souza', detalhe: '10/08 – 24/08 · 15 dias · saldo 22 dias', status: null },
  { tipo: 'Ponto', titulo: 'Carlos Lima', detalhe: 'Ajuste em 22/07 · esquecimento de batida (retorno do almoço)', status: null },
  { tipo: 'Vaga', titulo: 'Req. #128 · Analista de Dados Pl', detalhe: 'Aumento de quadro · aguardando sua aprovação', status: null },
  { tipo: 'Férias', titulo: 'Juliana Prado', detalhe: '01/09 – 10/09 · 10 dias · saldo 18 dias', status: null },
  { tipo: 'Ponto', titulo: 'Rafael Nunes', detalhe: 'Ajuste em 24/07 · marcação duplicada', status: null }
];
const ajustesData = [
  { nome: 'Carlos Lima', detalhe: '22/07 · incluir batida de retorno do almoço às 13:00', status: null },
  { nome: 'Rafael Nunes', detalhe: '24/07 · excluir marcação duplicada às 18:02', status: null },
  { nome: 'Beatriz Melo', detalhe: '25/07 · abono por consulta médica (atestado anexo)', status: null }
];
const feriasAprovData = [
  { nome: 'Ana Souza', periodo: '10/08 – 24/08', dias: 15, saldo: '22 dias', status: null },
  { nome: 'Juliana Prado', periodo: '01/09 – 10/09', dias: 10, saldo: '18 dias', status: null },
  { nome: 'Diego Farias', periodo: '14/09 – 28/09', dias: 15, saldo: '30 dias', status: null }
];
const alertasPonto = [
  { nome: 'Carlos Lima', motivo: 'Batida ausente em 22/07 — ajuste pendente' },
  { nome: 'Rafael Nunes', motivo: 'Marcação duplicada em 24/07' },
  { nome: 'Beatriz Melo', motivo: 'Sem registro hoje até 09:40' }
];
const destaques = [
  { nome: 'Larissa Costa', motivo: 'Aniversário · 30/07' },
  { nome: 'Diego Farias', motivo: 'Aniversário · 02/08' },
  { nome: 'Rafael Nunes', motivo: '2 anos de empresa · 15/07' }
];
const tagTone = { 'Férias': 'info', 'Ponto': 'warning', 'Vaga': 'purple' };
const reqTone = { 'Em aprovação': 'warning', 'Divulgada': 'info', 'Em entrevistas': 'purple', 'Encerrada': 'neutral' };

Object.assign(window, { navFuncionario, navGestor, holeriteData, proventos, descontos, espelhoData, equipeData, escalaData, vagasData, reqsData, avisos, notifsFunc, notifsGestor, pendenciasData, ajustesData, feriasAprovData, alertasPonto, destaques, tagTone, reqTone });
