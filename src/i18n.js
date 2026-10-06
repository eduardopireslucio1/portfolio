import { scramble } from './scramble.js';

// English lives in index.html (read once at start); this is the Portuguese side, by data-i18n key.
const pt = {
  'nav.about': 'sobre',
  'nav.ride': 'pedal',
  'nav.contact': 'contato',

  'hero.decoding': '> decodificando identidade',
  'hero.decoded': '> identidade decodificada',
  'hero.role': 'Engenheiro de Software na Predialize · construindo a EventosXP',
  'hero.scroll': 'role ↓',

  'about.bio':
    'Sou engenheiro de software na Predialize, onde trabalho na plataforma que construtoras usam depois da ' +
    'entrega das chaves. Por conta própria, construo a EventosXP, uma plataforma whitelabel para eventos ' +
    'esportivos, e, ultimamente, agentes e workflows de IA. Trabalho em toda a stack com TypeScript, Angular, React e NestJS, guiado por Clean ' +
    'Architecture e Domain-Driven Design.',
  'about.repos': 'repos públicos',
  'about.followers': 'seguidores',
  'about.since': 'no github desde',

  'pdz.kicker': 'trabalho · desde 2024',
  'pdz.pitch': 'Plataforma de pós-obra para construtoras: guias, manutenção, garantias e chamados, depois da entrega das chaves.',
  'pdz.did1': 'Redesign de 8 aplicações web com componentes e fluxos compartilhados.',
  'pdz.did2': 'Funcionalidades compartilhadas entre produtos: captação de leads, navegação de suporte, gestão de contas.',
  'pdz.did3': 'Módulos legados modernizados; bugs críticos corrigidos e cobertos por testes de regressão.',
  'pdz.roleLabel': 'cargo',
  'pdz.role': 'Engenheiro de Software',
  'pdz.arch': 'arquitetura',
  'pdz.fe': 'front-ends · Angular',
  'pdz.ms': 'microsserviços · Node.js + TS',
  'pdz.jobs': 'jobs em background',
  'pdz.more': 'chat em tempo real · Socket.io · MongoDB',

  'xp.kicker': 'construindo agora',
  'xp.pitch': 'Uma plataforma whitelabel para eventos esportivos. A marca do organizador na frente, a EventosXP na operação.',
  'xp.desc':
    'Cada organizador ganha um site de inscrições próprio, com nome, domínio, cores e patrocinadores. O atleta ' +
    'encontra a prova, se inscreve e paga com Pix ou cartão no mesmo fluxo. Por trás da largada, um painel ' +
    'cuida de participantes, pagamentos, categorias, lotes e check-in.',
  'xp.modelLabel': 'modelo',
  'xp.model': 'whitelabel · domínio próprio · sem mensalidade',
  'xp.sportsLabel': 'esportes',
  'xp.sports': 'corrida · ciclismo · MTB · triathlon',
  'xp.cases': 'rodando em',
  'xp.case1': 'corrida de rua · ciclismo · duathlon',
  'xp.case2': 'ciclismo',
  'xp.browse': 'ver eventos ↗',

  'ride.fig1': 'fig. 01 · estrada',
  'ride.kicker': 'longe do teclado',
  'ride.title': 'Eu pedalo.',
  'ride.pitch': 'Sou ciclista. Treino e compito, na estrada e contra o relógio.',
  'ride.desc': 'Competir me coloca do lado do atleta na largada, e essa visão molda como a EventosXP é construída.',
  'ride.fig2': 'fig. 02 · contrarrelógio',
  'ride.raceNo': 'Número de prova 047',
  'ride.data':
    'Fora da bike, os pedais viram dados: um projeto pessoal puxa minhas atividades da API do Strava e analisa com Python.',
  'ride.ridesLabel': 'pedais',
  'ride.rides': 'estrada · contrarrelógio',
  'ride.dataLabel': 'dados',
  'ride.link': 'dados dos pedais ↗',

  'contact.l1': 'Vamos construir algo',
  'contact.l2': 'que valha decodificar.',

  'ride.fig3': 'fig. 03 · último pedal',
  'strava.kicker': 'último pedal · strava',
  'strava.distance': 'distância',
  'strava.elevation': 'altimetria',
  'strava.time': 'tempo em movimento',
  'strava.speed': 'média',
  'strava.year': 'este ano',
  'strava.rides': 'pedais',

  'cal.title': 'o ano em bits',
  'cal.days': 'dias pedalados',
  'cal.streak': 'maior sequência · dias',
  'cal.month': 'melhor mês',
  'cal.biggest': 'maior dia',
  'cal.hint': 'aponte para um dia',
  'cal.rest': 'descanso',
  'cal.noDistance': 'pedal · sem distância',
  'cal.less': 'menos',
  'cal.more': 'mais',

  'nav.projects': 'projetos',
  'projects.back': 'início',
  'lucio.kicker': '01 · refatoração · 2025–26',
  'lucio.pitch': 'Gestão de pedidos para uma fábrica de troféus e brindes, do orçamento à entrega.',
  'lucio.note': 'A v2 é uma refatoração completa do SysAdmin do meu portfólio anterior: stack nova, interface nova, mesma empresa.',
  'lucio.did1': 'Kanban de produção por etapa, um responsável por etapa e relatório de produtividade por etapa e pessoa.',
  'lucio.did2': 'Chat nos pedidos com menções, notificações em tempo real e um assistente de IA.',
  'lucio.did3': 'Cobrança via Pix, pagamentos, despesas e um dashboard financeiro.',
  'lucio.fig1': 'fig. 01 · pedidos por etapa',
  'lucio.fig2': 'fig. 02 · por responsável',
  'lucio.fig3': 'fig. 03 · produtividade',
  'lucio.demo': 'telas da v2 com dados de demonstração.',
  'bi.kicker': '02 · grupo dbm · 2022–24',
  'bi.pitch': 'BI para os clientes da DBM: faturamento, perfil de clientes, churn e vendas em mapas interativos.',

  'light.dawn': 'luz da manhã',
  'light.day': 'luz do dia',
  'light.dusk': 'fim de tarde',
  'light.night': 'luz noturna',
  'foot.hint': 'aperte ~ para abrir o terminal',
};

// Keys whose English text is not in the page from the start
const en = {
  'hero.decoded': '> identity decoded',
  'light.dawn': 'dawn light',
  'light.dusk': 'golden hour',
  'light.night': 'night light',
  'cal.hint': 'point at a day',
  'cal.rest': 'rest day',
  'cal.noDistance': 'ride · no distance',
};
const dicts = { en, pt };
let current = 'en';

const clean = (s) => s.replace(/\s+/g, ' ').trim();

export const t = (key) => dicts[current][key] ?? en[key];
export const lang = () => current;

function savedLang() {
  try {
    return localStorage.getItem('lang');
  } catch {
    return null;
  }
}

function saveLang(lang) {
  try {
    localStorage.setItem('lang', lang);
  } catch {
    // private mode or blocked storage: the choice just won't stick
  }
}

function apply(lang, animate) {
  current = lang;
  document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';

  for (const el of document.querySelectorAll('[data-i18n]')) {
    const text = t(el.dataset.i18n);
    if (animate) scramble(el, text, { duration: Math.min(900, 250 + text.length * 5) });
    else el.textContent = text;
  }
  for (const el of document.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));

  const toggle = document.querySelector('[data-lang-toggle]');
  for (const opt of toggle.querySelectorAll('[data-lang]')) opt.classList.toggle('on', opt.dataset.lang === lang);
  toggle.setAttribute('aria-label', lang === 'en' ? 'Mudar para português' : 'Switch to English');
  document.dispatchEvent(new Event('langchange'));
}

export function setLang(next) {
  saveLang(next);
  apply(next, true);
}

// Re-reads one element's text after its data-i18n key was changed in code.
export function refresh(el, animate = false) {
  const text = t(el.dataset.i18n);
  if (animate) scramble(el, text, { duration: 500 });
  else el.textContent = text;
}

export function initI18n() {
  for (const el of document.querySelectorAll('[data-i18n]')) en[el.dataset.i18n] ??= clean(el.textContent);
  for (const el of document.querySelectorAll('[data-i18n-aria]')) en[el.dataset.i18nAria] ??= el.getAttribute('aria-label');

  document.querySelector('[data-lang-toggle]').addEventListener('click', () => setLang(current === 'en' ? 'pt' : 'en'));

  const saved = savedLang();
  const browser = navigator.language?.toLowerCase().startsWith('pt') ? 'pt' : 'en';
  apply(saved === 'en' || saved === 'pt' ? saved : browser, false);
}
