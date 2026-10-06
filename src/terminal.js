import { lang, setLang, t } from './i18n.js';
import { glyph, yearGrid } from './calendar.js';
import { toBinary } from './scramble.js';

const SECTIONS = ['about', 'predialize', 'eventosxp', 'ride', 'contact'];
const DIRS = [...SECTIONS, 'projects'];
const FILES = ['readme.txt', ...SECTIONS];
const COMMANDS = ['help', 'whoami', 'ls', 'cd', 'cat', 'ride', 'strava', 'cal', 'matrix', 'lang', 'bin', 'date', 'echo', 'sudo', 'clear', 'exit'];
const PROMPT = 'eduardo@portfolio:~$';
// not listed anywhere. If you know, you know.
const HIDDEN = new Set(['soad', 'system of a down', 'toxicity', 'aerials', 'chop suey', 'chop suey!', 'byob', 'b.y.o.b.', 'sugar', 'spiders', 'question!', 'lonely day', 'hypnotize', 'mezmerize']);

const copy = {
  en: {
    hello: 'type `help` to see what this terminal can do.',
    help: [
      'whoami          who is this',
      'ls              what is on this page',
      'cd <dir>        jump to a section (cd ride, cd projects, cd ~)',
      'cat <file>      read a section (cat readme.txt)',
      'strava          last ride and this year',
      'cal             the year, one bit per day',
      'matrix          …',
      'lang <en|pt>    switch language',
      'bin <text>      text to binary',
      'date            local time and light',
      'clear · exit',
    ],
    whoami: 'Eduardo Pires Lucio · software engineer at Predialize · building EventosXP · AI agents & workflows · cyclist',
    readme: 'Everything on this page is a few thousand bits arranged by three.js. Move the cursor, scroll fast, try `matrix`.',
    notFound: (cmd) => `command not found: ${cmd} · try help`,
    noDir: (dir) => `cd: no such directory: ${dir}`,
    noFile: (file) => `cat: ${file}: no such file`,
    noStrava: 'no ride data published yet · strava.com/athletes/3400462',
    last: 'last ride',
    year: 'this year',
    rides: 'rides',
    matrix: 'follow the white rabbit.',
    denied: 'hire: permission denied (try sudo)',
    sudoNo: 'nice try.',
    hire: ['[sudo] password for recruiter: ********', 'access granted. opening contact…'],
    usage: 'usage: lang <en|pt>',
  },
  pt: {
    hello: 'digite `help` para ver o que este terminal faz.',
    help: [
      'whoami          quem é este',
      'ls              o que tem nesta página',
      'cd <dir>        ir para uma seção (cd ride, cd projects, cd ~)',
      'cat <arquivo>   ler uma seção (cat readme.txt)',
      'strava          último pedal e o ano',
      'cal             o ano, um bit por dia',
      'matrix          …',
      'lang <en|pt>    trocar idioma',
      'bin <texto>     texto para binário',
      'date            hora local e luz',
      'clear · exit',
    ],
    whoami: 'Eduardo Pires Lucio · engenheiro de software na Predialize · construindo a EventosXP · agentes e workflows de IA · ciclista',
    readme: 'Tudo nesta página são alguns milhares de bits organizados pelo three.js. Mexa o cursor, role rápido, tente `matrix`.',
    notFound: (cmd) => `comando não encontrado: ${cmd} · tente help`,
    noDir: (dir) => `cd: diretório não existe: ${dir}`,
    noFile: (file) => `cat: ${file}: arquivo não existe`,
    noStrava: 'nenhum pedal publicado ainda · strava.com/athletes/3400462',
    last: 'último pedal',
    year: 'este ano',
    rides: 'pedais',
    matrix: 'siga o coelho branco.',
    denied: 'hire: permissão negada (tente sudo)',
    sudoNo: 'boa tentativa.',
    hire: ['[sudo] senha para recrutador: ********', 'acesso liberado. abrindo contato…'],
    usage: 'uso: lang <en|pt>',
  },
};

const duration = (s) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`;

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

// A small shell over the page. `scene` may be null (no WebGL); `strava` resolves to the data or null.
export function initTerminal({ scene, strava }) {
  const root = el('div', 'term');
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Terminal');
  const out = el('div', 'term-out');
  out.setAttribute('aria-live', 'polite');
  const form = el('form', 'term-line');
  const input = el('input');
  Object.assign(input, { autocomplete: 'off', spellcheck: false, autocapitalize: 'off' });
  input.setAttribute('aria-label', 'command');
  form.append(el('span', 'term-prompt', PROMPT), input);
  root.append(out, form);
  document.body.append(root);

  const toggle = document.querySelector('[data-term-toggle]');
  const history = [];
  let cursor = 0;
  let greeted = false;
  let returnFocus = null;

  const c = () => copy[lang()];
  const print = (lines, cls) => {
    for (const line of [lines].flat()) out.append(el('div', cls, line));
    out.scrollTop = out.scrollHeight;
  };

  function open() {
    if (!root.hidden) return;
    returnFocus = document.activeElement;
    root.hidden = false;
    requestAnimationFrame(() => root.classList.add('on'));
    if (!greeted) print(c().hello, 'dim');
    greeted = true;
    input.focus();
  }

  function close() {
    root.classList.remove('on');
    root.hidden = true;
    (returnFocus ?? toggle)?.focus?.();
  }

  // runs an action on the page after the terminal is out of the way
  const thenClose = (fn) =>
    setTimeout(() => {
      close();
      fn();
    }, 450);
  const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  const run = {
    help: () => print(c().help),
    whoami: () => print(c().whoami),
    ls: () => print(`${DIRS.map((s) => `${s}/`).join('  ')}  readme.txt`),
    cd: ([dir = '~']) => {
      const name = dir.replace(/\/$/, '');
      if (['~', '/', '..', ''].includes(name)) return thenClose(() => scrollTo({ top: 0, behavior: 'smooth' }));
      if (name === 'projects') return thenClose(() => location.assign('projects.html'));
      if (!SECTIONS.includes(name)) return print(c().noDir(dir), 'err');
      print(`→ ${name}`, 'dim');
      thenClose(() => go(name));
    },
    cat: ([file = '']) => {
      const name = file.replace(/\/$/, '');
      const text = {
        'readme.txt': c().readme,
        about: t('about.bio'),
        predialize: t('pdz.pitch'),
        eventosxp: t('xp.pitch'),
        ride: `${t('ride.pitch')} ${t('ride.desc')}`,
        contact: [...document.querySelectorAll('[data-links] .link-target')].map((n) => n.textContent.replace(' ↗', '')),
      }[name];
      print(text ?? c().noFile(file), text ? undefined : 'err');
    },
    ride: () => {
      print('→ ride', 'dim');
      thenClose(() => go('ride'));
    },
    strava: async () => {
      const data = await strava;
      if (!data) return print(c().noStrava, 'dim');
      const { last, ytd } = data;
      if (last) {
        print(`${c().last}  ${last.date} · ${last.km} km · ${last.elevation_m} m ↑ · ${duration(last.moving_s)} · ${last.avg_kmh} km/h`);
      }
      print(`${c().year}  ${ytd.km} km · ${ytd.elevation_m} m ↑ · ${ytd.rides} ${c().rides}`);
    },
    cal: async () => {
      const calendar = (await strava)?.calendar;
      if (!calendar) return print(c().noStrava, 'dim');
      const cells = yearGrid(calendar.year, calendar.days);
      const rows = Array.from({ length: 7 }, () => []);
      for (const cell of cells) rows[cell.weekday][cell.week] = glyph(cell);
      print(`${calendar.year} · ${cells.filter((x) => x.rode).length} ${t('cal.days')}`);
      print(rows.map((r) => Array.from(r, (g) => g ?? ' ').join('')), 'pre');
    },
    matrix: () => {
      print(c().matrix, 'ok');
      thenClose(() => scene?.matrix(6000));
    },
    lang: ([next]) => {
      if (next !== 'en' && next !== 'pt') return print(c().usage, 'err');
      setLang(next);
      print(`lang → ${next}`, 'dim');
    },
    bin: (args) => print(toBinary(args.join(' ') || 'eduardo')),
    echo: (args) => print(args.join(' ')),
    date: () => {
      const light = document.querySelector('[data-light]')?.textContent ?? '';
      print(`${new Date().toLocaleString(lang() === 'pt' ? 'pt-BR' : 'en-US')} · ${light}`);
    },
    hire: () => print(c().denied, 'err'),
    sudo: (args) => {
      if (args.join(' ') !== 'hire eduardo') return print(c().sudoNo, 'err');
      print(c().hire, 'ok');
      thenClose(() => go('contact'));
    },
    clear: () => out.replaceChildren(),
    exit: () => close(),
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const line = input.value.trim();
    input.value = '';
    print(`${PROMPT} ${line}`, 'cmd');
    if (!line) return;
    history.push(line);
    cursor = history.length;
    if (HIDDEN.has(line.toLowerCase())) {
      print('5 finger hat die hand.', 'err');
      return thenClose(() => go('contact'));
    }
    const [cmd, ...args] = line.split(/\s+/);
    const command = run[cmd.toLowerCase()];
    if (command) command(args);
    else print(c().notFound(cmd), 'err');
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') return close();
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      cursor = Math.max(0, Math.min(history.length, cursor + (e.key === 'ArrowUp' ? -1 : 1)));
      input.value = history[cursor] ?? '';
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const parts = input.value.split(' ');
      const pool = parts.length > 1 ? (parts[0] === 'cat' ? FILES : DIRS) : COMMANDS;
      const match = pool.filter((w) => w.startsWith(parts.at(-1)));
      if (match.length === 1) {
        parts[parts.length - 1] = match[0];
        input.value = parts.join(' ') + ' ';
      } else if (match.length > 1) print(match.join('  '), 'dim');
    }
  });

  toggle?.addEventListener('click', () => (root.hidden ? open() : close()));
  // clicking the output keeps the prompt focused, unless you are selecting text
  root.addEventListener('click', () => !getSelection().toString() && input.focus());

  // ~ or ` opens it. On Brazilian ABNT keyboards ~ is a dead key, reported as "Dead".
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !root.hidden) return close();
    const typing = e.target.closest?.('input, textarea, [contenteditable="true"]');
    const tilde = e.key === '~' || e.key === '`' || e.code === 'Backquote' || (e.key === 'Dead' && e.code === 'Quote');
    if (typing || !tilde || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    open();
  });
}
