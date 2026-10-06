import { lang, t } from './i18n.js';

const CUTS = [40, 80, 130]; // km per day: under 40 is level 1, then 2, 3, and 4 from 130 up
const level = (cell) => (cell.rode ? 1 + CUTS.filter((cut) => cell.km >= cut).length : 0);
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const locale = () => (lang() === 'pt' ? 'pt-BR' : 'en-US');
const short = (s) => s.replace('.', '').toLowerCase();

// Every day of `year` placed GitHub-style: columns are weeks (Sunday first), rows are weekdays.
export function yearGrid(year, days, today = new Date()) {
  const offset = new Date(year, 0, 1).getDay();
  const cells = [];
  for (let i = 0, d = new Date(year, 0, 1); d.getFullYear() === year; d = new Date(year, 0, 1 + ++i)) {
    const key = iso(d);
    // a day with a ride counts even at 0 km (indoor rides without a speed sensor)
    const rode = key in days;
    cells.push({ key, date: d, week: Math.floor((i + offset) / 7), weekday: d.getDay(), km: days[key] ?? 0, rode, future: d > today });
  }
  return cells;
}

export function glyph(cell) {
  if (cell.future) return '·';
  return cell.rode ? '1' : '0';
}

function stats(cells) {
  const ridden = cells.filter((c) => c.rode);
  let streak = 0;
  let run = 0;
  for (const c of cells) {
    run = c.rode ? run + 1 : 0;
    streak = Math.max(streak, run);
  }
  const months = Array(12).fill(0);
  for (const c of ridden) months[c.date.getMonth()] += c.km;
  const biggest = ridden.reduce((best, c) => (c.km > best.km ? c : best), { km: 0 });
  return { days: ridden.length, streak, month: months.indexOf(Math.max(...months)), biggest };
}

// The ride section's year in bits: 1 = rode that day (brighter with more km), 0 = rest, · = still to come.
export function initCalendar(calendar) {
  const root = document.querySelector('[data-calendar]');
  if (!calendar?.days) return;
  const q = (name) => root.querySelector(`[data-cal-${name}]`);
  const grid = root.querySelector('[data-cal]');
  const cells = yearGrid(calendar.year, calendar.days);
  const summary = stats(cells);
  const weeks = cells.at(-1).week + 1;
  grid.style.setProperty('--weeks', weeks);

  const today = iso(new Date());
  const spans = cells.map((c) => {
    const span = document.createElement('span');
    span.className = `cal-day ${c.future ? 'future' : `l${level(c)}`}${c.key === today ? ' today' : ''}`;
    span.style.gridArea = `${c.weekday + 2} / ${c.week + 2}`;
    span.dataset.day = c.key;
    span.textContent = glyph(c);
    return span;
  });
  const labels = document.createElement('div');
  labels.className = 'cal-labels';
  labels.style.display = 'contents';
  grid.replaceChildren(labels, ...spans);

  q('year').textContent = calendar.year;
  q('days').textContent = summary.days;
  q('streak').textContent = summary.streak;
  q('biggest').textContent = `${summary.biggest.km} km`;

  // everything that depends on the language: month and weekday names, the hovered day
  const fmtDay = () => new Intl.DateTimeFormat(locale(), { weekday: 'short', day: 'numeric', month: 'short' });
  function renderLabels() {
    const month = new Intl.DateTimeFormat(locale(), { month: 'short' });
    const weekday = new Intl.DateTimeFormat(locale(), { weekday: 'short' });
    const monthStarts = cells.filter((c) => c.date.getDate() === 1);
    labels.replaceChildren(
      ...monthStarts.map((c) => {
        const span = document.createElement('span');
        span.className = 'cal-month';
        span.style.gridArea = `1 / ${c.week + 2} / 2 / span 4`;
        span.textContent = short(month.format(c.date));
        return span;
      }),
      // Monday, Wednesday, Friday, like GitHub (1 Jan 2024 was a Monday)
      ...[1, 3, 5].map((wd) => {
        const span = document.createElement('span');
        span.className = 'cal-weekday';
        span.style.gridArea = `${wd + 2} / 1`;
        span.textContent = short(weekday.format(new Date(2024, 0, wd)));
        return span;
      }),
    );
    q('month').textContent = new Intl.DateTimeFormat(locale(), { month: 'long' }).format(new Date(calendar.year, summary.month, 1));
    grid.setAttribute('aria-label', `${summary.days} ${t('cal.days')} · ${calendar.year}`);
    q('status').textContent = t('cal.hint');
  }
  renderLabels();
  document.addEventListener('langchange', renderLabels);

  grid.addEventListener('pointerover', (e) => {
    const key = e.target.dataset?.day;
    if (!key) return;
    const cell = cells.find((c) => c.key === key);
    const what = cell.future ? '' : cell.km ? ` · ${cell.km} km` : ` · ${t(cell.rode ? 'cal.noDistance' : 'cal.rest')}`;
    q('status').textContent = `> ${short(fmtDay().format(cell.date))}${what}`;
  });
  grid.addEventListener('pointerleave', () => (q('status').textContent = t('cal.hint')));

  root.hidden = false;
  // on narrow screens the year scrolls sideways: start at today
  const scroller = root.querySelector('.cal-scroll');
  const now = spans.find((s) => s.dataset.day === today);
  if (now) scroller.scrollLeft = now.offsetLeft - scroller.clientWidth + 48;

  // the first time it scrolls into view, the bits flicker and settle week by week
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const io = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    io.disconnect();
    const t0 = performance.now();
    let last = 0;
    const tick = (time) => {
      const sweep = ((time - t0) / 1400) * (weeks + 6);
      if (time - last > 50) {
        last = time;
        cells.forEach((c, i) => {
          spans[i].textContent = c.week < sweep || c.future ? glyph(c) : Math.random() < 0.5 ? '0' : '1';
        });
      }
      if (sweep < weeks + 6) requestAnimationFrame(tick);
      else cells.forEach((c, i) => (spans[i].textContent = glyph(c)));
    };
    requestAnimationFrame(tick);
  }, { threshold: 0.3 });
  io.observe(grid);
}
