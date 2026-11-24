import './home.css';
import './planes.css';
import { initTheme } from './shell.js';
import { initPlanes } from './planes.js';
import { initFlight } from './flight.js';
import { initCalc } from './calc.js';
import { initMission } from './mission.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Sections and their blocks rise into place just before they enter the viewport.
function initReveal() {
  document.documentElement.classList.add('motion');
  const blocks = [];
  document.querySelectorAll('main .slide:not(.hero) > .wrap').forEach((wrap) => {
    [...wrap.children].forEach((el, i) => {
      el.classList.add('rv');
      el.style.setProperty('--d', `${Math.min(i, 3) * 0.04}s`);
      blocks.push(el);
    });
  });
  document.querySelectorAll('.steps li').forEach((li, i) => li.style.setProperty('--i', i));
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('in');
      e.target.querySelectorAll?.('.steps').forEach((s) => s.classList.add('in'));
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px 15% 0px' });
  blocks.forEach((el) => io.observe(el));
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

// Hero drawing: rotors turn slowly in their own plane. Each rotor's hub cap is an ellipse, so the
// rotation is done in "unprojected" space: M = P · R(θ) · P⁻¹, with P mapping a circle onto that ellipse.
function initRotors() {
  const rotors = [...document.querySelectorAll('.plane-art .rotor')].map((g) => {
    const [cx, cy, a, b, c, d] = g.dataset.rotor.split(' ').map(Number); // P = [[a, c], [b, d]]
    const det = a * d - b * c;
    return { g, cx, cy, a, b, c, d, inv: [d / det, -b / det, -c / det, a / det], dir: +g.dataset.dir };
  });
  if (!rotors.length) return;
  const SPEED = (2 * Math.PI) / 3; // one turn every 3 s, slow enough to see the blades
  let visible = true;
  let raf = 0;
  const frame = (t) => {
    raf = 0;
    if (!visible) return;
    for (const r of rotors) {
      const th = r.dir * SPEED * (t / 1000);
      const cs = Math.cos(th);
      const sn = Math.sin(th);
      // Q = P · R
      const q11 = r.a * cs + r.c * sn;
      const q12 = -r.a * sn + r.c * cs;
      const q21 = r.b * cs + r.d * sn;
      const q22 = -r.b * sn + r.d * cs;
      // M = Q · P⁻¹
      const [i11, i21, i12, i22] = r.inv;
      const m11 = q11 * i11 + q12 * i21;
      const m12 = q11 * i12 + q12 * i22;
      const m21 = q21 * i11 + q22 * i21;
      const m22 = q21 * i12 + q22 * i22;
      const tx = r.cx - (m11 * r.cx + m12 * r.cy);
      const ty = r.cy - (m21 * r.cx + m22 * r.cy);
      r.g.setAttribute('transform', `matrix(${m11} ${m21} ${m12} ${m22} ${tx} ${ty})`);
    }
    raf = requestAnimationFrame(frame);
  };
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !raf) raf = requestAnimationFrame(frame);
  }).observe(document.querySelector('.plane-art'));
}

// The 3D model (and three.js) loads only when its section comes near the viewport.
function initModelLazy() {
  const box = document.querySelector('[data-model]');
  if (!box) return;
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    import('./model3d.js')
      .then((m) => m.initModel())
      .catch((err) => {
        console.error('[model]', err);
        box.querySelector('.model-hint').textContent = '3B model bu tarayıcıda açılamadı.';
      });
  }, { rootMargin: '600px 0px' });
  io.observe(box);
}

initTheme();
initPlanes();
initFlight(!reduced);
initCalc();
initMission(!reduced);
initModelLazy();
if (!reduced) {
  initReveal();
  initTakeoff();
  initRotors();
}
