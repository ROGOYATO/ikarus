// "Nasıl uçar?": scroll position drives one flight from vertical take-off to vertical landing.
// Progress p runs 0..1 over the pinned section; each phase owns a slice of it.
const PHASES = [0, 0.22, 0.4, 0.6, 0.78, 1];
const CRUISE = 17; // m/s, from the team's presentation
const ALT = 60; // m, illustrative
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function state(p) {
  const alt = smooth(0.04, 0.2, p) - smooth(0.8, 0.96, p);
  const speed = smooth(0.24, 0.38, p) - smooth(0.62, 0.74, p);
  // positive pitch = nose up
  const pitch = -4 * (smooth(0.22, 0.3, p) - smooth(0.32, 0.42, p)) + 6 * (smooth(0.6, 0.68, p) - smooth(0.72, 0.8, p));
  return {
    alt,
    speed,
    pitch,
    lift: p > 0.015 && (p < 0.36 || p > 0.6) && p < 0.985,
    push: p > 0.23 && p < 0.7,
    phase: Math.max(0, PHASES.findIndex((b, i) => p >= b && p < PHASES[i + 1])),
  };
}

// Distance flown up to p, so the ground and clouds move with the aircraft's speed.
const DIST = (() => {
  const n = 400;
  const d = [0];
  for (let i = 1; i <= n; i++) d.push(d[i - 1] + state(i / n).speed / n);
  return (p) => d[Math.round(Math.min(1, Math.max(0, p)) * n)];
})();

export function initFlight(animate) {
  const root = document.querySelector('[data-flight]');
  if (!root) return;
  const q = (s) => root.querySelector(s);
  const plane = q('[data-plane]');
  const lift = [...root.querySelectorAll('.lift')];
  const push = q('.push');
  const down = q('.down');
  const back = q('.back');
  const layers = { ticks: q('[data-ticks]'), trees: q('[data-trees]'), hills: q('[data-hills]'), clouds: q('[data-clouds]') };
  const pad = q('[data-pad]');
  const shadow = q('[data-shadow]');
  const dust = q('[data-dust]');
  const items = [...root.querySelectorAll('.phases li')];
  const lamps = { lift: q('[data-m="lift"]'), push: q('[data-m="push"]') };
  const out = { speed: q('[data-speed]'), alt: q('[data-alt]') };

  const S = 0.5; // drawing mm -> scene units
  // on narrow screens crop the scene to the aircraft's flight band so it is not tiny
  const svg = root.querySelector('svg');
  const fitView = () => svg.setAttribute('viewBox', innerWidth < 640 ? '350 60 900 800' : '0 0 1600 900');
  fitView();
  addEventListener('resize', fitView);
  const PAD = 870; // midpoint of the landing gear in scene units
  // 2D fallback, used until the 3D scene has loaded (or if WebGL is unavailable)
  const drawSvg = (s, p, t) => {
    // a gentle bob while the rotors hold it in the air, a smaller one in wing-borne flight
    const airborne = s.alt > 0.02;
    const bob = airborne ? Math.sin(t * 2.2) * (s.lift ? 5 : 2) : 0;
    const y = 800 - 260 * S - s.alt * 380 + bob;
    const pitch = s.pitch + (airborne ? Math.sin(t * 1.6) * 0.6 : 0);
    // the drawing faces left; mirror it so the aircraft flies to the right
    plane.setAttribute('transform', `translate(800 ${y}) rotate(${-pitch}) scale(${-S} ${S}) translate(-560 0)`);
    lift.forEach((g) => g.classList.toggle('on', s.lift));
    push.classList.toggle('on', s.push);
    down.classList.toggle('on', s.lift);
    back.classList.toggle('on', s.push);
    dust.classList.toggle('on', s.lift && s.alt < 0.22);
    shadow.setAttribute('rx', 400 * (1 - 0.45 * s.alt));
    shadow.style.opacity = 0.35 * (1 - 0.75 * s.alt);

    // parallax: nearer layers slide faster
    const d = DIST(p) * 9000;
    const slide = (el, k, w) => el.setAttribute('transform', `translate(${-((d * k) % w)} 0)`);
    slide(layers.ticks, 1, 80);
    slide(layers.trees, 1, 1600);
    slide(layers.hills, 0.2, 1600);
    slide(layers.clouds, 0.35, 1600);
    // the take-off pad scrolls away; a second one (the landing pad) arrives during the descent
    pad.setAttribute('transform', `translate(${PAD - d + (p > 0.5 ? DIST(1) * 9000 : 0)} 0)`);
  };

  const hud = (s) => {
    items.forEach((li, i) => li.classList.toggle('on', i === s.phase));
    lamps.lift.classList.toggle('on', s.lift);
    lamps.push.classList.toggle('on', s.push);
    out.speed.textContent = Math.round(s.speed * CRUISE);
    out.alt.textContent = Math.round(s.alt * ALT);
  };

  const METRES = 120; // scene metres per unit of DIST, so trees and pads slide past at a believable pace
  let view3d = null;
  let lastP = 0;
  let lastT = 0;
  const render = (p, t = 0) => {
    const s = state(p);
    if (view3d) view3d.update(s, DIST(p) * METRES, DIST(1) * METRES, t);
    else drawSvg(s, p, t);
    hud(s);
    lastP = p;
    lastT = t;
  };

  // swap in the 3D scene once three.js has loaded near the section
  const sceneBox = root.querySelector('.fl-scene');
  const load3d = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    load3d.disconnect();
    import('./flight3d.js')
      .then((m) => {
        view3d = m.createFlightScene(sceneBox);
        sceneBox.classList.add('is3d');
        render(lastP, lastT);
      })
      .catch((err) => console.error('[flight3d]', err));
  }, { rootMargin: '800px 0px' });
  load3d.observe(root);

  const mid = (i) => (PHASES[i] + PHASES[i + 1]) / 2;
  if (!animate) {
    // reduced motion: no pinning; the phase buttons step through still frames
    document.documentElement.classList.add('no-scrolly');
    items.forEach((li, i) => li.querySelector('button').addEventListener('click', () => render(mid(i))));
    render(mid(2));
    return;
  }

  const progress = () => {
    const r = root.getBoundingClientRect();
    const span = root.offsetHeight - (innerHeight - parseFloat(getComputedStyle(root.firstElementChild).top));
    return Math.min(1, Math.max(0, -r.top / span));
  };
  items.forEach((li, i) => li.querySelector('button').addEventListener('click', () => {
    const span = root.offsetHeight - root.firstElementChild.offsetHeight;
    scrollTo({ top: root.getBoundingClientRect().top + scrollY + mid(i) * span, behavior: 'smooth' });
  }));
  // Scrolling sets a target; the scene eases towards it every frame so wheel steps don't make it jump.
  let target = progress();
  let cur = target;
  let last = 0;
  let raf = 0;
  let visible = false;
  const frame = (t) => {
    raf = 0;
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t;
    cur += (target - cur) * Math.min(1, dt * 7);
    render(cur, t / 1000);
    if (visible) raf = requestAnimationFrame(frame);
    else last = 0;
  };
  const wake = () => {
    if (!raf && visible) raf = requestAnimationFrame(frame);
  };
  addEventListener('scroll', () => {
    target = progress();
    wake();
  }, { passive: true });
  addEventListener('resize', () => {
    target = progress();
    wake();
  });
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    wake();
  }).observe(root);
  render(cur);
}
