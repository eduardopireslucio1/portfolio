import './style.css';
import { initI18n } from './i18n.js';
import { scramble } from './scramble.js';

document.documentElement.classList.add('js');
initI18n();

const year = new Date().getFullYear();
document.querySelector('[data-year]').textContent = `${year} · ${year.toString(2)}`;

const io = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('in');
      entry.target.querySelectorAll('[data-scramble]').forEach((node) => scramble(node, undefined, { duration: 700 }));
      io.unobserve(entry.target);
    }
  },
  { threshold: 0.05 },
);
document.querySelectorAll('.reveal').forEach((node) => io.observe(node));

// click a screenshot to see it full size; click anywhere or Esc to close
const viewer = document.querySelector('[data-viewer]');
const big = viewer.querySelector('img');
for (const shot of document.querySelectorAll('[data-zoom]')) {
  shot.addEventListener('click', () => {
    const img = shot.querySelector('img');
    big.src = img.currentSrc || img.src;
    big.alt = img.alt;
    viewer.showModal();
  });
}
viewer.addEventListener('click', () => viewer.close());
