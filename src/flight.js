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
  const ticks = q('[data-ticks]');
  const clouds = q('[data-clouds]');
  const pad = q('[data-pad]');
  const items = [...root.querySelectorAll('.phases li')];
  const lamps = { lift: q('[data-m="lift"]'), push: q('[data-m="push"]') };
  const out = { speed: q('[data-speed]'), alt: q('[data-alt]') };

  const S = 0.5; // drawing mm -> scene units
  const render = (p) => {
    const s = state(p);
    const y = 800 - 260 * S - s.alt * 380;
    // the drawing faces left; mirror it so the aircraft flies to the right
    plane.setAttribute('transform', `translate(800 ${y}) rotate(${-s.pitch}) scale(${-S} ${S}) translate(-560 0)`);
    lift.forEach((g) => g.classList.toggle('on', s.lift));
    push.classList.toggle('on', s.push);
    down.classList.toggle('on', s.lift);
    back.classList.toggle('on', s.push);
    const d = DIST(p) * 9000;
    ticks.setAttribute('transform', `translate(${-(d % 80)} 0)`);
    clouds.setAttribute('transform', `translate(${-((d * 0.25) % 1600)} 0)`);
    pad.setAttribute('transform', `translate(${800 - d + (p > 0.5 ? DIST(1) * 9000 : 0)} 0)`);
    items.forEach((li, i) => li.classList.toggle('on', i === s.phase));
    lamps.lift.classList.toggle('on', s.lift);
    lamps.push.classList.toggle('on', s.push);
    out.speed.textContent = Math.round(s.speed * CRUISE);
    out.alt.textContent = Math.round(s.alt * ALT);
  };

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
  let ticking = false;
  const update = () => {
    ticking = false;
    render(progress());
  };
  addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });
  addEventListener('resize', update);
  update();
}
