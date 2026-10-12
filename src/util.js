export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const trNum = (digits) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const fmt = (v, digits = 0) => trNum(digits).format(v);

export const svgEl = (tag, attrs = {}, text) => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text != null) el.textContent = text;
  return el;
};

/** Run `fn` whenever the effective color theme changes (OS setting or data-theme toggle). */
export function onThemeChange(fn) {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', fn);
  new MutationObserver(fn).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

/** Wire a `.seg` button group: sets aria-pressed and calls fn(button). */
export function segmented(group, fn) {
  const btns = $$('button', group);
  btns.forEach((b) =>
    b.addEventListener('click', () => {
      btns.forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
      fn(b);
    }),
  );
}

export const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable: state just won't persist */
    }
  },
};

/** Size a canvas to its CSS width at device pixel ratio; returns a 2D context in CSS pixels. */
export function fitCanvas(canvas, aspect) {
  const w = canvas.clientWidth || canvas.parentElement.clientWidth;
  const h = Math.round(w / aspect);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.style.height = `${h}px`;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}
