const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const running = new WeakMap();

// Resolves `text` into `el` left to right, unresolved chars flicker as 0/1.
export function scramble(el, text = el.dataset.text ?? el.textContent, { duration = 900, delay = 0 } = {}) {
  el.dataset.text = text;
  cancelAnimationFrame(running.get(el));

  if (reduced) {
    el.textContent = text;
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let start = null;
    let lastSwap = 0;
    let noise = '';

    const tick = (now) => {
      start ??= now + delay;
      const p = Math.max(0, Math.min(1, (now - start) / duration));
      const revealed = Math.floor(p * text.length);

      // Re-roll the noise ~20x per second, not every frame
      if (now - lastSwap > 50) {
        lastSwap = now;
        noise = Array.from(text, () => (Math.random() < 0.5 ? '0' : '1')).join('');
      }

      let out = '';
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        out += i < revealed || c === ' ' ? c : noise[i];
      }
      el.textContent = out;

      if (p < 1) running.set(el, requestAnimationFrame(tick));
      else resolve();
    };
    running.set(el, requestAnimationFrame(tick));
  });
}

export function toBinary(str) {
  return Array.from(new TextEncoder().encode(str), (b) => b.toString(2).padStart(8, '0')).join(' ');
}
