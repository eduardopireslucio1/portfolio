const W = 200;
const H = 44;
const TOP = 6;
const BOTTOM = 4;

// A generic climb for when there is no ride data: rolling at first, steeper towards the top.
function climb(n = 120) {
  return Array.from({ length: n }, (_, i) => {
    const x = i / (n - 1);
    return Math.min(1, Math.max(0, 0.08 + 0.78 * x ** 1.6 + 0.05 * Math.sin(x * 19) * x + 0.03 * Math.sin(x * 47)));
  });
}

function normalize(values) {
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  return values.map((v) => (v - min) / span);
}

// Scroll progress drawn as an elevation profile: a dot climbs it as you read, section starts are ticks.
// With a Strava ride it is that ride's real profile; otherwise a generic climb.
export function initAltimetry(ride) {
  const root = document.querySelector('[data-alti]');
  const q = (name) => root.querySelector(`[data-alti-${name}]`);
  const heights = ride?.profile?.length > 1 ? normalize(ride.profile) : climb();
  const pts = heights.map((h, i) => [(i / (heights.length - 1)) * W, H - BOTTOM - h * (H - TOP - BOTTOM)]);
  const line = `M${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L')}`;
  q('line').setAttribute('d', line);
  q('line-done').setAttribute('d', line);
  q('area').setAttribute('d', `${line}L${W},${H}L0,${H}Z`);

  const sections = [...document.querySelectorAll('main > section[id]')];
  let starts = [];

  function measure() {
    const max = document.documentElement.scrollHeight - innerHeight;
    starts = sections.map((s) => Math.min(1, s.offsetTop / max));
    q('ticks').replaceChildren(
      ...starts.slice(1).map((f) => {
        const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        Object.entries({ x1: f * W, x2: f * W, y1: H - 3, y2: H, class: 'alti-tick' }).forEach(([k, v]) => tick.setAttribute(k, v));
        return tick;
      }),
    );
  }

  function update() {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const p = Math.min(1, Math.max(0, scrollY / max));
    root.classList.toggle('on', scrollY > innerHeight * 0.6);
    q('clip').setAttribute('width', (p * W).toFixed(1));

    const i = p * (pts.length - 1);
    const [a, b] = [pts[Math.floor(i)], pts[Math.ceil(i)]];
    const y = a[1] + (b[1] - a[1]) * (i - Math.floor(i));
    q('dot').setAttribute('cx', (p * W).toFixed(1));
    q('dot').setAttribute('cy', y.toFixed(1));

    // the section you are in, by its binary number, and where you are on the climb
    let current = 0;
    starts.forEach((f, n) => p + 0.02 >= f && (current = n));
    const section = sections[current];
    const label = document.querySelector(`nav a[href="#${section.id}"]`)?.textContent ?? '~';
    q('section').textContent = label.replace(/^(\d+)/, '$1 ');
    q('note').textContent = ride ? `km ${(p * ride.km).toFixed(1)}/${ride.km}` : `${Math.round(p * 100)}%`;
  }

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      update();
    });
  };
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', () => {
    measure();
    schedule();
  });
  // nav labels are translated, so the section name follows the language
  document.addEventListener('langchange', schedule);
  // sections grow when fonts and data arrive
  new ResizeObserver(() => {
    measure();
    schedule();
  }).observe(document.querySelector('main'));
  measure();
  update();
}
