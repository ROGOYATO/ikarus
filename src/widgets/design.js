// Section 2–3 widgets: budget bars, flight-time calculator, centre-of-gravity plot + sortable table.
import { $, $$, fmt, segmented, svgEl, onThemeChange } from '../util.js';

/* ---------------- budget ---------------- */
const BUDGET = [
  ['Jetson Orin NX 8 GB', 30304.8],
  ['TATTU 6S 30000 mAh Li-Po', 27336],
  ['5× Savox SW1210SGP servo', 5 * 4199.9],
  ['PM-02D Power Module', 6240],
  ['Hobbywing 25A UBEC', 5445.82],
  ['T-Motor AT4125 KV540', 5241.43],
  ['Flycolor Waterproof ESC', 3588],
  ['Gemfan 16×8 pervane', 867.84],
  ['100 A in-line devre kesici', 378],
];

export function initBudget() {
  const host = $('#budgetBars');
  const max = Math.max(...BUDGET.map((b) => b[1]));
  const total = BUDGET.reduce((s, b) => s + b[1], 0);
  host.innerHTML = BUDGET.map(
    ([n, v]) => `<div class="bar-row"><span class="lbl" title="${n}">${n}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(v / max) * 100}%"></div></div>
      <span class="v">${fmt(v, 2)}</span></div>`,
  ).join('');
  $('#budgetSum').innerHTML = `${fmt(total, 0)}<small>TL</small>`;
}

/* ---------------- flight time ---------------- */
const COMPS = [
  { id: 'ap', name: 'Otopilot', a: 0.3, color: '--sky' },
  { id: 'ai', name: 'Yapay zekâ bilgisayarı', a: 1.25, color: '--ok' },
  { id: 'tm', name: 'Telemetri', a: 0.8, color: '--warn' },
  { id: 'hl', name: 'Herelink', a: 0.33, color: '--bad' },
  { id: 'ub', name: 'UBEC', a: 0.28, color: '--muted' },
];
// Peak: report gives 84.7 A total, i.e. motor ≈ 84.7 − 2.96 A of avionics.
const PRESETS = { cruise: 60, peak: 81.74 };

export function initFlight() {
  const list = $('#flightComps');
  list.innerHTML = COMPS.map(
    (c) => `<input type="checkbox" id="fc-${c.id}" checked><label for="fc-${c.id}">${c.name}</label><span class="amp">${fmt(c.a, 2)} A</span>`,
  ).join('');
  const motor = $('#motorA');
  const cap = $('#capMah');

  const calc = () => {
    const parts = COMPS.filter((c) => $(`#fc-${c.id}`).checked).map((c) => ({ ...c }));
    parts.push({ name: 'Ana motor', a: +motor.value, color: '--accent' });
    const I = parts.reduce((s, p) => s + p.a, 0);
    const t = (+cap.value / 1000 / I) * 60;
    $('#motorAOut').textContent = `${fmt(+motor.value, 2)} A`;
    $('#capOut').textContent = `${fmt(+cap.value)} mAh`;
    $('#ftI').innerHTML = `${fmt(I, 2)}<small>A</small>`;
    $('#ftT').innerHTML = `${fmt(t, 2)}<small>dk</small>`;
    $('#ftBar').innerHTML = parts
      .map((p) => `<span title="${p.name}: ${fmt(p.a, 2)} A" style="width:${(p.a / I) * 100}%;background:var(${p.color})"></span>`)
      .join('');
    $('#ftLegend').innerHTML = parts
      .map((p) => `<span><i style="background:var(${p.color})"></i>${p.name} ${fmt((p.a / I) * 100, 1)}%</span>`)
      .join('');
  };
  segmented($('#flight .seg'), (b) => {
    motor.value = PRESETS[b.dataset.preset];
    calc();
  });
  const clearPreset = () => $$('#flight .seg button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  motor.addEventListener('input', () => {
    clearPreset();
    calc();
  });
  cap.addEventListener('input', calc);
  list.addEventListener('change', calc);
  calc();
}

/* ---------------- CG ---------------- */
const CG = [
  ['ESC', 102, 72.13, -3.25, -56.51],
  ['UBEC', 74, -138.36, -50.2, 28.37],
  ['Motor', 350, 769.61, -20.88, 0.4],
  ['Görev PC', 100, 35.56, -60.65, 2.87],
  ['Telemetri', 14.5, 244.4, -59.51, 14.57],
  ['Air Unit', 95, -70.14, -53.44, 0.4],
  ['Otopilot', 73, 131.51, -55.52, 0.7],
  ['Batarya', 2324, -301.35, -15.22, 5.83],
  ['Hız sensörü', 3.5, 157.52, -5.91, -60.42],
  ['Here 3+ GPS', 48.8, -8.63, 60.66, -2.74],
  ['Güç dağıtım', 20, -193.06, 7.5, -61.6],
  ['Sol aileron servo', 71, 55.02, 0.88, 556.19],
  ['Sağ aileron servo', 71, 54.75, -0.01, -549.72],
  ['Sol elevator servo', 71, 634.54, 20.1, 94.4],
  ['Rudder servo', 71, 634.03, 83.64, -0.25],
  ['Sağ elevator servo', 71, 623.29, 27.28, -93.6],
].map(([name, w, x, y, z], i) => ({ i, name, w, x, y, z }));

export function initCG() {
  const plot = $('#cgPlot');
  const tbody = $('#cgTable tbody');
  let view = 'top';
  let hi = -1;

  const M = CG.reduce((s, c) => s + c.w, 0);
  const cx = CG.reduce((s, c) => s + c.w * c.x, 0) / M;
  const cy = CG.reduce((s, c) => s + c.w * c.y, 0) / M;
  const cz = CG.reduce((s, c) => s + c.w * c.z, 0) / M;
  $('#cgMass').innerHTML = `${fmt(M, 1)}<small>g</small>`;
  $('#cgXYZ').textContent = `${fmt(cx, 1)}, ${fmt(cy, 1)}, ${fmt(cz, 1)}`;

  const draw = () => {
    plot.innerHTML = '';
    const W = 760, H = view === 'top' ? 380 : 250;
    const pad = { l: 52, r: 16, t: 14, b: 36 };
    const xr = [-400, 850];
    const yr = view === 'top' ? [-650, 650] : [-120, 140];
    const sx = (v) => pad.l + ((v - xr[0]) / (xr[1] - xr[0])) * (W - pad.l - pad.r);
    const sy = (v) => H - pad.b - ((v - yr[0]) / (yr[1] - yr[0])) * (H - pad.t - pad.b);
    const vert = (c) => (view === 'top' ? c.z : c.y);

    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Alt sistemlerin konum grafiği', style: 'width:100%;height:auto;display:block' });
    const g = svgEl('g', {});
    svg.append(g);
    const ink = 'var(--muted)';
    for (let v = -400; v <= 800; v += 200) {
      g.append(svgEl('line', { x1: sx(v), x2: sx(v), y1: pad.t, y2: H - pad.b, stroke: 'var(--line)', 'stroke-width': 1 }));
      g.append(svgEl('text', { x: sx(v), y: H - pad.b + 16, 'text-anchor': 'middle', 'font-size': 11, fill: ink }, v));
    }
    const ystep = view === 'top' ? 200 : 50;
    for (let v = Math.ceil(yr[0] / ystep) * ystep; v <= yr[1]; v += ystep) {
      g.append(svgEl('line', { x1: pad.l, x2: W - pad.r, y1: sy(v), y2: sy(v), stroke: 'var(--line)', 'stroke-width': 1 }));
      g.append(svgEl('text', { x: pad.l - 8, y: sy(v) + 4, 'text-anchor': 'end', 'font-size': 11, fill: ink }, v));
    }
    g.append(svgEl('text', { x: W - pad.r, y: H - 4, 'text-anchor': 'end', 'font-size': 11, fill: ink }, 'X (mm) → kuyruk'));
    g.append(svgEl('text', { x: 4, y: pad.t + 2, 'font-size': 11, fill: ink, 'dominant-baseline': 'hanging' }, view === 'top' ? 'Z' : 'Y'));

    // reference point + crosshair
    g.append(svgEl('line', { x1: sx(0), x2: sx(0), y1: pad.t, y2: H - pad.b, stroke: 'var(--sky)', 'stroke-dasharray': '3 3' }));
    g.append(svgEl('line', { x1: pad.l, x2: W - pad.r, y1: sy(0), y2: sy(0), stroke: 'var(--sky)', 'stroke-dasharray': '3 3' }));
    g.append(svgEl('circle', { cx: sx(0), cy: sy(0), r: 4, fill: 'var(--sky)' }));

    const maxR = 26;
    const rOf = (w) => Math.max(3, Math.sqrt(w / 2324) * maxR);
    [...CG].sort((a, b) => b.w - a.w).forEach((c) => {
      const on = c.i === hi;
      const circ = svgEl('circle', {
        cx: sx(c.x), cy: sy(vert(c)), r: rOf(c.w),
        fill: on ? 'var(--accent)' : 'var(--sky-soft)', stroke: on ? 'var(--accent)' : 'var(--sky)', 'stroke-width': 1.5,
        tabindex: 0, 'data-i': c.i,
      });
      circ.append(svgEl('title', {}, `${c.name}: ${c.w} g`));
      g.append(circ);
    });
    // combined CG cross
    const X = sx(cx), Y = sy(view === 'top' ? cz : cy);
    g.append(svgEl('path', { d: `M${X - 8} ${Y}h16M${X} ${Y - 8}v16`, stroke: 'var(--accent)', 'stroke-width': 2.5 }));
    g.append(svgEl('text', { x: X + 10, y: Y - 8, 'font-size': 11, fill: 'var(--accent-ink)' }, 'Ortak AM'));

    if (hi >= 0) {
      const c = CG[hi];
      const tx = Math.min(sx(c.x) + rOf(c.w) + 6, W - 150);
      g.append(svgEl('text', { x: tx, y: sy(vert(c)) + 4, 'font-size': 12, fill: 'var(--ink)', 'font-weight': 600 }, `${c.name} · ${c.w} g`));
    }
    svg.addEventListener('pointerover', (e) => {
      const i = e.target.getAttribute?.('data-i');
      if (i != null) setHi(+i);
    });
    svg.addEventListener('focusin', (e) => {
      const i = e.target.getAttribute?.('data-i');
      if (i != null) setHi(+i);
    });
    svg.addEventListener('pointerleave', () => setHi(-1));
    plot.append(svg);
  };

  const setHi = (i) => {
    if (i === hi) return;
    hi = i;
    draw();
    $$('tr', tbody).forEach((tr) => tr.classList.toggle('hl', +tr.dataset.i === hi));
  };

  // table
  let sortKey = null, dir = 1;
  const renderTable = () => {
    const rows = [...CG];
    if (sortKey) rows.sort((a, b) => (typeof a[sortKey] === 'string' ? a[sortKey].localeCompare(b[sortKey], 'tr') : a[sortKey] - b[sortKey]) * dir);
    tbody.innerHTML = rows
      .map((c) => `<tr data-i="${c.i}"><td>${c.name}</td><td class="num">${fmt(c.w, c.w % 1 ? 1 : 0)}</td><td class="num">${fmt(c.x, 2)}</td><td class="num">${fmt(c.y, 2)}</td><td class="num">${fmt(c.z, 2)}</td></tr>`)
      .join('');
  };
  $$('#cgTable th button').forEach((b) =>
    b.addEventListener('click', () => {
      const k = b.dataset.k;
      dir = sortKey === k ? -dir : k === 'name' ? 1 : -1;
      sortKey = k;
      $$('#cgTable th').forEach((th) => th.setAttribute('aria-sort', 'none'));
      b.parentElement.setAttribute('aria-sort', dir === 1 ? 'ascending' : 'descending');
      renderTable();
    }),
  );
  tbody.addEventListener('pointerover', (e) => {
    const tr = e.target.closest('tr');
    if (tr) setHi(+tr.dataset.i);
  });
  tbody.addEventListener('pointerleave', () => setHi(-1));

  segmented($('#cg .seg'), (b) => {
    view = b.dataset.view;
    draw();
  });
  renderTable();
  draw();
  onThemeChange(draw);
}
