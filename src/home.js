import './home.css';
import './planes.css';
import { initTheme } from './shell.js';
import { initPlanes } from './planes.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Technical drawing: view tabs (arrow keys move between them) and the dimension toggle.
function initDrawing() {
  const box = document.querySelector('[data-drawing]');
  if (!box) return;
  const tabs = [...box.querySelectorAll('[role="tab"]')];
  const select = (tab) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', (e) => {
      const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!d) return;
      const next = tabs[(i + d + tabs.length) % tabs.length];
      select(next);
      next.focus();
    });
  });
  const dims = document.getElementById('dimToggle');
  dims.addEventListener('change', () => box.classList.toggle('no-dims', !dims.checked));
}

// Count a stat up from zero the first time it scrolls into view ("~35 dk" keeps its prefix and unit).
function countUp(el) {
  const m = el.textContent.match(/^(\D*)(\d+(?:[.,]\d+)?)(.*)$/);
  if (!m || Number(m[2]) >= 1000) return;
  const [, pre, num, post] = m;
  const end = Number(num.replace(',', '.'));
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / 1100);
    el.textContent = `${pre}${Math.round(end * (1 - (1 - k) ** 3))}${post}`;
    if (k < 1) requestAnimationFrame(step);
    else el.textContent = `${pre}${num}${post}`;
  };
  requestAnimationFrame(step);
}

// Sections and their blocks rise into place as they enter the viewport.
function initReveal() {
  document.documentElement.classList.add('motion');
  const blocks = [];
  document.querySelectorAll('main .slide:not(.hero) > .wrap').forEach((wrap) => {
    [...wrap.children].forEach((el, i) => {
      el.classList.add('rv');
      el.style.setProperty('--d', `${Math.min(i, 4) * 0.08}s`);
      blocks.push(el);
    });
  });
  document.querySelectorAll('.steps li').forEach((li, i) => li.style.setProperty('--i', i));
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('in');
      e.target.querySelectorAll?.('.stat dt').forEach(countUp);
      e.target.querySelectorAll?.('.steps').forEach((s) => s.classList.add('in'));
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -12% 0px' });
  blocks.forEach((el) => io.observe(el));
  document.querySelectorAll('main .slide').forEach((s) => io.observe(s));
}

// The hero aircraft climbs away to the upper right as the page scrolls past the hero.
function initTakeoff() {
  const art = document.querySelector('.plane-art svg');
  const hero = document.querySelector('.hero');
  if (!art || !hero) return;
  let ticking = false;
  const update = () => {
    ticking = false;
    const k = Math.min(1, Math.max(0, scrollY / hero.offsetHeight));
    const e = k * k;
    art.style.transform = `translate(${e * 34}%, ${-e * 46}%) rotate(${-e * 9}deg) scale(${1 - e * 0.35})`;
  };
  addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });
  update();
}

initTheme();
initPlanes();
initDrawing();
if (!reduced) {
  initReveal();
  initTakeoff();
}
