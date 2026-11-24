// Illustrative mission: the UAV follows the route path, leaving a trail, and loops while the map is on screen.
const LAP = 22000; // ms per lap

export function initMission(animate) {
  const root = document.querySelector('[data-mission]');
  if (!root) return;
  const route = root.querySelector('[data-route]');
  const trail = root.querySelector('[data-trail]');
  const uav = root.querySelector('[data-uav]');
  const btn = root.querySelector('[data-play]');
  const len = route.getTotalLength();
  trail.setAttribute('d', route.getAttribute('d'));
  trail.style.strokeDasharray = `${len} ${len}`;

  const place = (k) => {
    const at = k * len;
    const p = route.getPointAtLength(at);
    const q = route.getPointAtLength(Math.min(len, at + 1));
    const r = route.getPointAtLength(Math.max(0, at - 1));
    const ang = (Math.atan2(q.y - r.y, q.x - r.x) * 180) / Math.PI + 90;
    uav.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${ang})`);
    trail.style.strokeDashoffset = String(len - at);
  };

  if (!animate) {
    // reduced motion: show the finished route with the aircraft back over the start
    place(1);
    btn.hidden = true;
    return;
  }

  let playing = true;
  let visible = false;
  let k = 0;
  let last = 0;
  let raf = 0;
  const frame = (t) => {
    raf = 0;
    if (!playing || !visible) return;
    if (last) k = (k + (t - last) / LAP) % 1;
    last = t;
    place(k);
    raf = requestAnimationFrame(frame);
  };
  const run = () => {
    last = 0;
    if (!raf && playing && visible) raf = requestAnimationFrame(frame);
  };
  btn.addEventListener('click', () => {
    playing = !playing;
    btn.setAttribute('aria-pressed', String(playing));
    btn.textContent = playing ? 'Duraklat' : 'Oynat';
    run();
  });
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    run();
  }).observe(root);
  place(0);
}
