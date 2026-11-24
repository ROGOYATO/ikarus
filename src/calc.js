// Hover calculator: momentum theory for the four lift rotors. Defaults come from the team's presentation
// (6 kg, 2 × 8000 mAh 3S) and the technical drawing (15" lift propellers).
const G = 9.81;
const RHO = 1.225; // kg/m³, sea level
const FM = 0.6; // propeller figure of merit
const ETA = 0.85; // motor + ESC efficiency
const CELL = 3.7; // V per Li-Po cell
const USABLE = 0.8;

const fmt = (x, d = 0) => x.toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });

export function initCalc() {
  const root = document.querySelector('[data-calc]');
  if (!root) return;
  const input = (k) => root.querySelector(`[data-i="${k}"]`);
  const outp = (k) => root.querySelector(`[data-o="${k}"]`);
  const res = (k) => root.querySelector(`[data-r="${k}"]`);
  const segValue = (k) => +input(k).querySelector('[aria-pressed="true"]').dataset.v;

  const calc = () => {
    const m = +input('m').value;
    const cap = +input('c').value;
    const cells = segValue('s');
    const d = segValue('p') * 0.0254;
    outp('m').textContent = `${fmt(m, 1)} kg`;
    outp('c').textContent = `${fmt(cap)} mAh`;

    const T = (m * G) / 4; // N per motor
    const A = (Math.PI * d * d) / 4;
    const Pideal = T ** 1.5 / Math.sqrt(2 * RHO * A);
    const P = (4 * Pideal) / FM / ETA; // W from the battery
    const I = P / (cells * CELL);
    const minutes = ((cap / 1000) * USABLE / I) * 60;
    const share = ((I / 60) / (cap / 1000)) * 100;

    res('t').innerHTML = `${fmt(T / G, 2)}<small> kgf</small>`;
    res('tmax').innerHTML = `≥ ${fmt((2 * T) / G, 1)}<small> kgf</small>`;
    res('p').innerHTML = `${fmt(P)}<small> W</small>`;
    res('i').innerHTML = `${fmt(I)}<small> A</small>`;
    res('time').innerHTML = `${fmt(minutes, 1)}<small> dk</small>`;
    res('share').innerHTML = `%${fmt(share, 1)}`;
  };

  root.querySelectorAll('.seg').forEach((seg) => {
    seg.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      calc();
    });
  });
  root.addEventListener('input', calc);
  calc();
}
