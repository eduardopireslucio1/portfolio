import './style.css';
import portraitUrl from './assets/me.jpg';
import xpLogoUrl from './assets/eventosxp-logo.png';
import pdzLogoUrl from './assets/predialize-logo.png';
import roadUrl from './assets/ride-road.webp';
import ttUrl from './assets/ride-tt.webp';
import handUrl from './assets/hand.webp';
import { config } from './config.js';
import { initAltimetry } from './altimetry.js';
import { initCalendar } from './calendar.js';
import { initI18n, refresh, t } from './i18n.js';
import { loadGitHub } from './github.js';
import { scramble, toBinary } from './scramble.js';
import { createScene } from './scene.js';
import { initTerminal } from './terminal.js';

document.documentElement.classList.add('js');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (sel) => document.querySelector(sel);

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

const bits = (text) => text.replace(/\S/g, () => (Math.random() < 0.5 ? '0' : '1'));
const spaced = (n) => n.toLocaleString('en-US').replace(/,/g, ' ');

function countUp(node, to, duration) {
  if (reduced) {
    node.textContent = spaced(to);
    return;
  }
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - t0) / duration);
    node.textContent = spaced(Math.round(to * (1 - (1 - p) ** 3)));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---------- static content

const ghUrl = `https://github.com/${config.github}`;
const h1 = $('[data-name]');
h1.setAttribute('aria-label', config.name.join(' '));
h1.replaceChildren(
  ...config.name.map((line) => {
    const span = el('span', null, bits(line));
    span.dataset.text = line;
    span.setAttribute('aria-hidden', 'true');
    return span;
  }),
);
$('[data-binary]').textContent = toBinary(config.name[0]);
const year = new Date().getFullYear();
$('[data-year]').textContent = `${year} · ${year.toString(2)}`;

$('[data-links]').replaceChildren(
  ...[{ label: 'github', href: ghUrl }, ...config.links].map(({ label, href }) => {
    const a = el('a');
    a.href = href;
    if (!href.startsWith('mailto:')) {
      a.target = '_blank';
      a.rel = 'noopener';
    }
    const target = href.replace(/^mailto:|^https?:\/\/(www\.)?/g, '').replace(/\/$/, '');
    a.append(el('span', 'link-label', label), el('span', 'link-target', `${target} ↗`));
    const li = el('li');
    li.append(a);
    return li;
  }),
);

initI18n();

// ---------- the light of the visitor's hour tints the portrait and names itself in the hero

function daylight(hour) {
  if (hour >= 5 && hour < 8) return { key: 'light.dawn', tint: [1.12, 0.95, 1.02] };
  if (hour >= 8 && hour < 17) return { key: 'light.day', tint: [1, 1, 1] };
  if (hour >= 17 && hour < 20) return { key: 'light.dusk', tint: [1.25, 0.95, 0.72] };
  return { key: 'light.night', tint: [0.78, 0.9, 1.25] };
}
const light = daylight(new Date().getHours());
$('[data-light]').dataset.i18n = light.key;
refresh($('[data-light]'));
const clock = () => {
  $('[data-clock]').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
};
clock();
setInterval(clock, 30000);

// ---------- strava: public/strava.json is written by scripts/strava.mjs; without it the ride row stays hidden

async function loadStrava() {
  try {
    const res = await fetch('strava.json', { cache: 'no-cache' });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

function renderStrava(data) {
  if (data?.profile) $('[data-strava-link]').href = data.profile;
  const last = data?.last;
  if (!last?.route?.length) return;
  const hm = `${Math.floor(last.moving_s / 3600)}:${String(Math.floor((last.moving_s % 3600) / 60)).padStart(2, '0')}`;
  $('[data-strava-date]').textContent = last.date;
  $('[data-strava-km]').textContent = `${last.km} km`;
  $('[data-strava-elev]').textContent = `${last.elevation_m} m`;
  $('[data-strava-time]').textContent = hm;
  $('[data-strava-speed]').textContent = `${last.avg_kmh} km/h`;
  $('[data-ytd-km]').textContent = spaced(data.ytd.km);
  $('[data-ytd-elev]').textContent = spaced(data.ytd.elevation_m);
  $('[data-ytd-rides]').textContent = data.ytd.rides;
  $('[data-strava]').hidden = false;
}

const strava = loadStrava();
strava.then((data) => {
  renderStrava(data);
  initCalendar(data?.calendar);
  initAltimetry(data?.last?.route?.length ? data.last : null);
});

// the scene loads later, so the terminal talks to it through this handle
let scene = null;
initTerminal({ scene: { matrix: (ms) => scene?.matrix(ms) }, strava });

// ---------- reveal on scroll

const io = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('in');
      entry.target.querySelectorAll('[data-scramble]').forEach((node) => scramble(node, undefined, { duration: 700 }));
      io.unobserve(entry.target);
    }
  },
  { threshold: 0.12 },
);
document.querySelectorAll('.reveal').forEach((node) => io.observe(node));

// ---------- github

function renderLangs(repos) {
  const hidden = new Set(config.hideLanguages);
  const counts = {};
  for (const r of repos) if (r.language && !hidden.has(r.language)) counts[r.language] = (counts[r.language] ?? 0) + 1;
  const top = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const max = top[0]?.[1] ?? 1;
  const width = 16;

  $('[data-langs]').replaceChildren(
    ...top.map(([lang, n]) => {
      const on = Math.max(1, Math.round((n / max) * width));
      const bar = el('span', 'lang-bar');
      bar.append(el('b', null, '1'.repeat(on)), el('i', null, '0'.repeat(width - on)));
      const row = el('div', 'lang');
      row.append(el('span', 'lang-name', lang.toLowerCase()), bar, el('span', 'lang-n', String(n).padStart(2, '0')));
      return row;
    }),
  );
}

async function renderGitHub() {
  try {
    const { profile, repos } = await loadGitHub(config.github);
    const own = repos.filter((r) => !r.fork && r.name.toLowerCase() !== profile.login.toLowerCase());

    for (const [key, value] of Object.entries({ repos: profile.repos, followers: profile.followers, since: profile.since })) {
      scramble($(`[data-stat="${key}"]`), String(value), { duration: 800 });
    }
    renderLangs(own);
  } catch (err) {
    // the stats keep their "--" placeholders; the GitHub link in contact still works
    console.warn(err);
  }
}

// ---------- scene + intro

async function boot() {
  try {
    scene = await createScene({
      canvas: $('#scene'),
      image: portraitUrl,
      logos: { eventosxp: xpLogoUrl, predialize: pdzLogoUrl },
      rides: { road: roadUrl, tt: ttUrl },
      hand: handUrl,
      route: strava.then((data) => data?.last?.route ?? null),
      tint: light.tint,
      reduced,
    });
  } catch (err) {
    console.error(err);
    document.documentElement.classList.add('no-webgl');
  }

  if (scene) {
    scene.setStages({
      pdz: $('[data-pdz-stage]'),
      logo: $('[data-logo-stage]'),
      rideA: $('[data-ride-a]'),
      rideB: $('[data-ride-b]'),
      route: $('[data-route-stage]'),
      hand: $('[data-hand-stage]'),
    });
    const onScroll = () => scene.setScroll(Math.min(1, scrollY / (innerHeight * 0.8)));
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    countUp($('[data-bits]'), scene.count, 2600);
  }

  [...h1.children].forEach((span, i) =>
    scramble(span, span.dataset.text, { duration: 1500, delay: scene && !reduced ? 900 + i * 350 : 0 }),
  );
  await scene?.introDone;
  const prompt = $('[data-prompt]');
  prompt.dataset.i18n = 'hero.decoded'; // a later language switch keeps the decoded wording
  scramble(prompt, t('hero.decoded'), { duration: 500 });
}

boot();
renderGitHub();
