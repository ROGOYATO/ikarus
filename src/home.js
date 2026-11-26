import './home.css';
import './planes.css';
import { initTheme } from './shell.js';
import { initPlanes } from './planes.js';
import { initFlight } from './flight.js';
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

// As the hero scrolls away, its aircraft shrinks into the top-right corner, under the top bar, and stays
// there for the rest of the page (rotors still turning). Clicking it there scrolls back to the top.
// The drawing is position: fixed throughout (a slot keeps its place in the hero); where the browser
// supports scroll-driven animations the whole move runs on the compositor in step with scrolling,
// otherwise a scroll handler drives the same path. Once docked it simply stays fixed.
function initDock() {
  const art = document.querySelector('.plane-art svg');
  const hero = document.querySelector('.hero');
  const bar = document.querySelector('.topbar');
  if (!art || !hero) return;
  const slot = document.createElement('div');
  art.before(slot);
  const scrollTimeline = CSS.supports('animation-timeline: scroll()');
  const kf = document.head.appendChild(document.createElement('style'));
  const STOPS = 16;
  let g = null;

  // Where the drawing sits at scroll s, as a transform from its place at the top of the page. It scrolls
  // with the page at full size until its top meets the top bar (s = start); from there it never leaves
  // the screen: it stays pinned under the bar while it shrinks and slides into the corner.
  const pose = (s) => {
    const u = Math.min(1, Math.max(0, (s - g.start) / g.range));
    const e = u * u * (3 - 2 * u);
    const x = g.x0 + (g.tx - g.x0) * e;
    const y = s < g.start ? g.y0 - s : g.ty;
    return { e, transform: `translate(${x - g.x0}px, ${y - g.y0}px) scale(${1 + (g.scale - 1) * e})` };
  };
  const badge = (e) => ({
    background: `color-mix(in srgb, var(--paper) ${(e * 94).toFixed(1)}%, transparent)`,
    shadow: `0 20px 50px rgba(0, 0, 0, ${(e * 0.25).toFixed(3)})`,
  });

  const measure = () => {
    art.style.cssText = '';
    art.classList.remove('docked');
    slot.style.height = '0px';
    const r = art.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const W = vw < 640 ? 96 : 176;
    const ty = bar.offsetHeight + 10;
    const y0 = r.top + scrollY;
    g = { x0: r.left, y0, w: r.width, tx: vw - 12 - W, ty, scale: W / r.width, start: Math.max(0, y0 - ty), range: Math.max(220, r.height * 0.9) };
    g.end = g.start + g.range;
    slot.style.height = `${r.height}px`;
    Object.assign(art.style, { position: 'fixed', left: `${g.x0}px`, top: `${g.y0}px`, width: `${g.w}px` });
    if (scrollTimeline) {
      // one stop where the pinning starts, then enough stops to follow the eased shrink
      const at = [0, ...Array.from({ length: STOPS + 1 }, (_, i) => g.start + (g.range * i) / STOPS)];
      let frames = '';
      for (const sAt of at) {
        const p = pose(sAt);
        const b = badge(p.e);
        frames += `${((100 * sAt) / g.end).toFixed(3)}% { transform: ${p.transform}; background-color: ${b.background}; box-shadow: ${b.shadow}; }\n`;
      }
      kf.textContent = `@keyframes plane-dock {\n${frames}}`;
      art.style.animation = 'plane-dock 1s linear both';
      art.style.animationTimeline = 'scroll(root block)';
      art.style.animationRange = `0px ${g.end}px`;
    }
    update();
  };
  const update = () => {
    art.classList.toggle('docked', scrollY >= g.end);
    if (scrollTimeline) return;
    const p = pose(scrollY);
    const b = badge(p.e);
    art.style.transform = p.transform;
    art.style.backgroundColor = b.background;
    art.style.boxShadow = b.shadow;
  };

  art.addEventListener('click', () => {
    if (art.classList.contains('docked')) scrollTo({ top: 0, behavior: 'smooth' });
  });
  let ticking = false;
  addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        update();
      });
    }
  }, { passive: true });
  addEventListener('resize', measure);
  document.fonts?.ready.then(measure);
  measure();
}

// Hero drawing: rotors turn slowly in their own plane (horizontal for the lift rotors, taken from the
// four hub positions; vertical for the pusher). The rotation is done in that plane and projected back:
// M = P · R(θ) · P⁻¹, with P mapping the rotor's plane onto the drawing.
// Viewing direction of the drawing in each rotor plane's axes, from how much the drawing shortens the
// aircraft's three axes (tail-ward 0.35, starboard 0.449, up ~0.47 px/mm): the viewer sits towards the
// nose, the starboard side and above. Lift plane axes: (tail-ward, starboard); pusher: (starboard, up).
const DEPTH = { lift: [-0.717, 0.447], push: [0.447, 0.351] };

function initRotors() {
  const rotors = [...document.querySelectorAll('.plane-art .rotor')].map((g) => {
    const [cx, cy, a, b, c, d] = g.dataset.rotor.split(' ').map(Number); // P = [[a, c], [b, d]]
    const det = a * d - b * c;
    const inv = [d / det, -b / det, -c / det, a / det];
    // blade direction at rest, taken back into the rotor's own plane
    const box = g.getBBox();
    const bx = box.x + box.width / 2 - cx;
    const by = box.y + box.height / 2 - cy;
    const w0 = [inv[0] * bx + inv[2] * by, inv[1] * bx + inv[3] * by];
    const node = g.closest('.rotor-mask') || g; // the pusher's blades sit in an unrotated masking wrapper
    const set = node.parentElement;
    return { g, node, set, kind: set.dataset.kind, cx, cy, a, b, c, d, inv, w0, phase: 0, front: null, dir: +g.dataset.dir };
  });
  if (!rotors.length) return;
  // The drawn blades of a rotor are not exactly 180° apart; turn the second one so that it stays
  // directly opposite the first, otherwise the pair stops reading as one propeller while it spins.
  const angle = ([x, y]) => Math.atan2(y, x);
  for (const set of new Set(rotors.map((r) => r.set))) {
    const [first, second] = rotors.filter((r) => r.set === set);
    if (second) second.phase = angle(first.w0) + Math.PI - angle(second.w0);
  }
  // Rotors idle very slowly; each one speeds up the closer the pointer comes to its own hub.
  const SLOW = (2 * Math.PI) / 3; // one turn every 3 s
  const FAST = 2 * Math.PI * 1.5; // 1.5 turns a second with the pointer on the hub
  const REACH = 260; // px from a hub at which its rotor is back to idle
  const art = document.querySelector('.plane-art');
  const svg = art.querySelector('svg');
  // one spin state per rotor (both blades of a rotor share it)
  const spin = new Map([...new Set(rotors.map((r) => r.set))].map((set) => {
    const r = rotors.find((x) => x.set === set);
    return [set, { hub: new DOMPoint(r.cx, r.cy), rate: 0, turn: 0 }];
  }));
  let pointer = null;
  const onPointer = (e) => (pointer = { x: e.clientX, y: e.clientY });
  addEventListener('pointermove', onPointer, { passive: true });
  addEventListener('pointerdown', onPointer, { passive: true });
  document.addEventListener('mouseleave', () => (pointer = null));
  addEventListener('blur', () => (pointer = null));
  let last = 0;
  let visible = true;
  let raf = 0;
  const frame = (t) => {
    raf = 0;
    if (!visible) {
      last = 0;
      return;
    }
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t;
    const ctm = svg.getScreenCTM(); // hubs move with scroll and the take-off transform
    for (const st of spin.values()) {
      let near = 0;
      if (pointer && ctm) {
        const h = st.hub.matrixTransform(ctm);
        near = Math.max(0, 1 - Math.hypot(pointer.x - h.x, pointer.y - h.y) / REACH);
      }
      st.rate += (near - st.rate) * Math.min(1, dt * 3);
      st.turn += (SLOW + (FAST - SLOW) * st.rate * st.rate) * dt;
    }
    for (const r of rotors) {
      const th = r.dir * spin.get(r.set).turn + r.phase;
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
      // Draw the blade over the motor while it points towards the viewer, under it otherwise.
      const wx = cs * r.w0[0] - sn * r.w0[1];
      const wy = sn * r.w0[0] + cs * r.w0[1];
      const [ka, kb] = DEPTH[r.kind];
      const front = ka * wx + kb * wy > 0;
      if (front !== r.front) {
        r.front = front;
        if (front) r.set.append(r.node);
        else r.set.prepend(r.node);
      }
    }
    raf = requestAnimationFrame(frame);
  };
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !raf) raf = requestAnimationFrame(frame);
  }).observe(art.querySelector('svg')); // the drawing itself: docked, it stays on screen after the hero has gone
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
initMission(!reduced);
initModelLazy();
if (!reduced) {
  initReveal();
  initDock();
  initRotors();
}
