// Section 4 widgets: lock-on pipeline, APF grid + A* demo, IBVS demo, kamikaze profile, QR pixel density.
import { $, $$, css, fmt, segmented, svgEl, onThemeChange, fitCanvas } from '../util.js';

/* ---------------- pipeline ---------------- */
const STAGES = [
  { k: '4.1.1', t: 'Sunucu verisi', h: 'Sunucu veri akışı ve veri parçalama', p: 'Yarışma sunucusundan rakip durumları, HSS bilgisi ve görev parametreleri JSON’dan ayrıştırılır; WGS84 koordinatları yerel ENU’ya çevrilir ve eski/NaN/sınır dışı örnekler elenir.', kv: [['Hız', '1 Hz HTTP/REST'], ['Zaman aşımı', '200 ms → son geçerli kestirim'], ['Çıktı', 'Temizlenmiş rakip ve HSS listesi']] },
  { k: '4.1.2', t: 'Hedef seçimi', h: 'İdeal hedef seçimi', p: 'IMM-EKF ile kısa vadeli konum/yönelim/belirsizlik tahmini yapılır. Yasaklı alandaki, HSS’ye gireceği öngörülen, son kilitlenilen veya belirsizliği eşik üstü adaylar elenir; kalanlar arasında M(x,t) maliyeti en küçük olan seçilir.', kv: [['Kestirim', 'IMM-EKF'], ['Maliyet', 'Açı farkı + mesafe + belirsizlik'], ['Çıktı', 'Hedef İHA']] },
  { k: '4.1.3', t: 'Global rota', h: 'İdeal rotanın çıkarılması', p: 'Alan, APF ile loss ve danger rate değerleri taşıyan grid haritaya dönüştürülür. Yasaklı alanlar geçilemez, rakip tahminleri zaman bağımlı risk maliyetidir. A* bu harita üzerinde global yolu üretir.', kv: [['Harita', 'APF ağırlıklı grid'], ['Arama', 'A*'], ['Çıktı', 'Global yol']] },
  { k: '4.1.4', t: 'Yerel planlayıcı', h: 'Yerel planlayıcı (MPPI)', p: 'Global yol; dönüş yarıçapı, yatış, hız ve tırmanma sınırlarına göre uygulanabilir referanslara çevrilir. MPPI rota, HSS, rakip riski ve enerji terimlerini aynı maliyette birleştirir ve GPU’da paralel çalışır.', kv: [['Yöntem', 'MPPI'], ['Alternatifler', 'MPC, TEB'], ['Çıktı', 'Hız, yönelim, irtifa referansı']] },
  { k: '4.1.5', t: 'PID döngüleri', h: 'Düşük seviyeli kontrol', p: 'PX4 sabit kanat yığınında dış kademe açı hatasını açısal hız referansına, iç kademe açısal hız hatasını PWM çıkışına dönüştürür.', kv: [['Donanım', 'Orange Cube / Pixhawk'], ['Yığın', 'PX4 fixed-wing'], ['Çıktı', 'Servo ve ESC PWM']] },
  { k: '4.1.6', t: 'Tespit ve takip', h: 'Görüntü işleme ve kilitlenme', p: 'SimCLR ile eğitilmiş YOLO11s rakibi tespit eder; ByteTrack düşük güven skorlu tespitleri de eşleştirerek ID sürekliliği sağlar.', kv: [['Model', 'YOLO11s (FP16, ~56–60 FPS)'], ['Veri seti', '~10.000 görüntü'], ['Takip', 'ByteTrack']] },
  { k: '4.1.7', t: 'Visual servoing', h: 'Görüntü tabanlı kontrol (IBVS)', p: 'Sınırlayıcı kutu merkezi normalize piksel hatasına çevrilir. Yatay hata bank-to-turn ile yatış komutuna, dikey hata yunuslamaya, kutu alanı itkiye eşlenir.', kv: [['Yatay', 'e_x → φ_cmd'], ['Dikey', 'e_y → θ_cmd'], ['Mesafe', 'A_bbox → T_cmd']] },
  { k: '4.1', t: 'Kilitlenme', h: 'Kilitlenme ve bildirim', p: 'Hedef 4 saniyeden uzun süre takip edilirse kilitlenme YKİ’ye ve sunucuya bildirilir. Rakip kaybolursa ~1 s boyunca rota tahminiyle yetişilmeye çalışılır; bulunamazsa serbest uçuşa dönülür.', kv: [['Şart', '≥ 4 s kesintisiz takip'], ['Kayıp penceresi', '~1 s ileri-besleme'], ['Bildirim', '/api/kilitlenme_bilgisi']] },
];

export function initPipeline() {
  const list = $('#pipeline .pipe');
  const panel = $('#pipeline .pipe-detail');
  list.innerHTML = STAGES.map(
    (s, i) => `<button type="button" role="tab" id="pt${i}" aria-selected="${i === 0}" aria-controls="ppanel"><span class="k">${s.k}</span>${s.t}</button>`,
  ).join('');
  panel.id = 'ppanel';
  const show = (i) => {
    const s = STAGES[i];
    $$('button', list).forEach((b, j) => b.setAttribute('aria-selected', String(i === j)));
    panel.setAttribute('aria-labelledby', `pt${i}`);
    const link = s.k.split('.').length === 3 ? `<a href="#s4-1-${s.k.split('.')[2]}">Bölüm ${s.k} →</a>` : '';
    panel.innerHTML = `<h5>${s.h}</h5><p>${s.p}</p><dl class="kv">${s.kv.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl>${link ? `<p class="note">${link}</p>` : ''}`;
  };
  list.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) show($$('button', list).indexOf(b));
  });
  list.addEventListener('keydown', (e) => {
    const btns = $$('button', list);
    const i = btns.indexOf(document.activeElement);
    if (i < 0) return;
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (d) {
      const n = (i + d + btns.length) % btns.length;
      btns[n].focus();
      show(n);
    }
  });
  show(0);
}

/* ---------------- APF grid + A* ---------------- */
export function initAstar() {
  const canvas = $('#astarCanvas');
  const COLS = 48, ROWS = 26;
  const start = { c: 2, r: 13 }, goal = { c: 45, r: 12 };
  let zones = [
    { c: 14, r: 10, rad: 4 },
    { c: 26, r: 16, rad: 5 },
    { c: 36, r: 8, rad: 3.5 },
  ];
  const rs = $('#astarRs'), bk = $('#astarB');
  let grid, path, size;

  const build = () => {
    const Rs = +rs.value, B = +bk.value;
    grid = new Float32Array(COLS * ROWS);
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        let L = 0;
        for (const z of zones) {
          const d = Math.hypot(r - z.r, c - z.c);
          if (d <= z.rad) { L = Infinity; break; }
          if (Rs > 0 && d <= z.rad + Rs) L = Math.max(L, B * (1 - (d - z.rad) / Rs) ** 2);
        }
        grid[r * COLS + c] = L;
      }
  };

  const solve = () => {
    const N = COLS * ROWS;
    const g = new Float64Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const h = (i) => {
      const dc = Math.abs((i % COLS) - goal.c), dr = Math.abs(Math.floor(i / COLS) - goal.r);
      return Math.max(dc, dr) + (Math.SQRT2 - 1) * Math.min(dc, dr);
    };
    const s = start.r * COLS + start.c, t = goal.r * COLS + goal.c;
    if (!isFinite(grid[s]) || !isFinite(grid[t])) return null;
    g[s] = 0;
    const open = [[h(s), s]];
    while (open.length) {
      let bi = 0;
      for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
      const [, cur] = open.splice(bi, 1)[0];
      if (closed[cur]) continue;
      if (cur === t) break;
      closed[cur] = 1;
      const cc = cur % COLS, cr = Math.floor(cur / COLS);
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nc = cc + dc, nr = cr + dr;
          if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
          const n = nr * COLS + nc;
          if (closed[n] || !isFinite(grid[n])) continue;
          if (dr && dc && (!isFinite(grid[cr * COLS + nc]) || !isFinite(grid[nr * COLS + cc]))) continue;
          const step = (dr && dc ? Math.SQRT2 : 1) * (1 + grid[n]);
          const ng = g[cur] + step;
          if (ng < g[n]) {
            g[n] = ng;
            came[n] = cur;
            open.push([ng + h(n), n]);
          }
        }
    }
    if (came[t] < 0) return null;
    const out = [];
    for (let i = t; i >= 0; i = came[i]) out.push(i);
    return out.reverse();
  };

  const draw = () => {
    const { ctx, w, h } = fitCanvas(canvas, COLS / ROWS);
    size = w / COLS;
    const accent = css('--accent'), bad = css('--bad'), sky = css('--sky'), line = css('--line'), sunken = css('--sunken'), ink = css('--ink');
    ctx.fillStyle = sunken;
    ctx.fillRect(0, 0, w, h);
    const Bmax = Math.max(1, +bk.value);
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const L = grid[r * COLS + c];
        if (!isFinite(L)) {
          ctx.fillStyle = bad;
          ctx.globalAlpha = 0.85;
        } else if (L > 0) {
          ctx.fillStyle = accent;
          ctx.globalAlpha = 0.12 + 0.55 * (L / Bmax);
        } else continue;
        ctx.fillRect(c * size, r * size, size, size);
      }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 0; c <= COLS; c++) { ctx.moveTo(c * size + 0.5, 0); ctx.lineTo(c * size + 0.5, h); }
    for (let r = 0; r <= ROWS; r++) { ctx.moveTo(0, r * size + 0.5); ctx.lineTo(w, r * size + 0.5); }
    ctx.globalAlpha = 0.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
    // HSS outlines
    ctx.strokeStyle = bad;
    ctx.lineWidth = 2;
    zones.forEach((z) => {
      ctx.beginPath();
      ctx.arc((z.c + 0.5) * size, (z.r + 0.5) * size, z.rad * size, 0, Math.PI * 2);
      ctx.stroke();
    });
    if (path) {
      ctx.strokeStyle = sky;
      ctx.lineWidth = Math.max(2.5, size * 0.28);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      path.forEach((i, k) => {
        const x = ((i % COLS) + 0.5) * size, y = (Math.floor(i / COLS) + 0.5) * size;
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.stroke();
    }
    const dot = (p, fill, label) => {
      const x = (p.c + 0.5) * size, y = (p.r + 0.5) * size;
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(5, size * 0.55), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ink;
      ctx.font = `600 ${Math.max(10, size * 0.7)}px "IBM Plex Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(label, x, y - size * 0.9);
    };
    dot(start, sky, 'İHA');
    dot(goal, ink, 'HEDEF');
  };

  const run = () => {
    $('#astarRsOut').textContent = `${rs.value} hücre`;
    $('#astarBOut').textContent = bk.value;
    build();
    path = solve();
    if (path) {
      let len = 0, clr = Infinity;
      for (let k = 1; k < path.length; k++) {
        const a = path[k - 1], b = path[k];
        len += Math.hypot((a % COLS) - (b % COLS), Math.floor(a / COLS) - Math.floor(b / COLS));
      }
      for (const i of path) for (const z of zones) clr = Math.min(clr, Math.hypot((i % COLS) - z.c, Math.floor(i / COLS) - z.r) - z.rad);
      $('#astarState').innerHTML = '<span class="chip ok">Güvenli rota</span>';
      $('#astarLen').innerHTML = `${fmt(len, 1)}<small>hücre</small>`;
      $('#astarClr').innerHTML = zones.length ? `${fmt(Math.max(0, clr), 1)}<small>hücre</small>` : '–';
    } else {
      $('#astarState').innerHTML = '<span class="chip bad">Rota yok → loiter</span>';
      $('#astarLen').textContent = '–';
      $('#astarClr').textContent = '–';
    }
    draw();
  };

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const c = Math.floor((e.clientX - rect.left) / size), r = Math.floor((e.clientY - rect.top) / size);
    const hit = zones.findIndex((z) => Math.hypot(r - z.r, c - z.c) <= z.rad);
    if (hit >= 0) zones.splice(hit, 1);
    else if (Math.hypot(c - start.c, r - start.r) > 4 && Math.hypot(c - goal.c, r - goal.r) > 4) zones.push({ c, r, rad: 3 + Math.random() * 2.5 });
    run();
  });
  $('#astarRand').addEventListener('click', () => {
    zones = [];
    const n = 3 + Math.floor(Math.random() * 3);
    let guard = 0;
    while (zones.length < n && guard++ < 200) {
      const z = { c: 8 + Math.floor(Math.random() * 32), r: 2 + Math.floor(Math.random() * 22), rad: 2.5 + Math.random() * 3.5 };
      if (zones.every((o) => Math.hypot(o.c - z.c, o.r - z.r) > o.rad + z.rad + 1)) zones.push(z);
    }
    run();
  });
  $('#astarClear').addEventListener('click', () => { zones = []; run(); });
  rs.addEventListener('input', run);
  bk.addEventListener('input', run);
  addEventListener('resize', draw);
  onThemeChange(draw);
  run();
}

/* ---------------- IBVS ---------------- */
export function initIbvs() {
  const canvas = $('#ibvsCanvas');
  const FW = 1280, FH = 720;
  // Example gains: not specified in the report.
  const G = { lx: 35, ly: 15, kdx: 4, kdy: 2, thTrim: 2, tTrim: 55, kT: 400, aRef: 0.04 };
  const zone = { x0: 0.25, x1: 0.75, y0: 0.1, y1: 0.9 };
  const sizeIn = $('#ibvsSize');
  let tgt = { u: 860, v: 300 };
  let prev = { ex: 0, ey: 0, t: performance.now() };
  let dex = 0, dey = 0;
  let lockStart = null, locked = false, dragging = false, scale = 1;

  const box = () => {
    const bw = (+sizeIn.value / 100) * FW;
    return { w: bw, h: bw * 0.42 };
  };

  const frame = (now) => {
    const { ctx, w, h } = fitCanvas(canvas, 16 / 9);
    scale = w / FW;
    const b = box();
    const ex = (tgt.u - FW / 2) / (FW / 2), ey = (tgt.v - FH / 2) / (FH / 2);
    const dt = Math.max(0.016, (now - prev.t) / 1000);
    dex = 0.8 * dex + 0.2 * ((ex - prev.ex) / dt);
    dey = 0.8 * dey + 0.2 * ((ey - prev.ey) / dt);
    prev = { ex, ey, t: now };
    const phi = Math.max(-45, Math.min(45, -G.lx * ex - G.kdx * dex));
    const theta = G.thTrim - G.ly * ey - G.kdy * dey;
    const A = (b.w * b.h) / (FW * FH);
    const T = Math.max(0, Math.min(100, G.tTrim + G.kT * (G.aRef - A)));

    const inZone = tgt.u - b.w / 2 >= zone.x0 * FW && tgt.u + b.w / 2 <= zone.x1 * FW && tgt.v - b.h / 2 >= zone.y0 * FH && tgt.v + b.h / 2 <= zone.y1 * FH;
    const bigEnough = b.w >= 0.05 * FW || b.h >= 0.05 * FH;
    const ok = inZone && bigEnough;
    if (ok) {
      lockStart ??= now;
      if (now - lockStart >= 4000) locked = true;
    } else {
      lockStart = null;
      locked = false;
    }
    const held = lockStart ? Math.min(4, (now - lockStart) / 1000) : 0;

    // sky / ground backdrop (fixed colors: this is a camera image, not UI chrome)
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#7fa7cf');
    grd.addColorStop(0.62, '#c8d7e6');
    grd.addColorStop(0.63, '#7d8c5c');
    grd.addColorStop(1, '#5b6b40');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    const S = (v) => v * scale;
    // lock zone
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(S(zone.x0 * FW), S(zone.y0 * FH), S((zone.x1 - zone.x0) * FW), S((zone.y1 - zone.y0) * FH));
    ctx.setLineDash([]);
    // crosshair
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.moveTo(S(FW / 2 - 18), S(FH / 2)); ctx.lineTo(S(FW / 2 + 18), S(FH / 2));
    ctx.moveTo(S(FW / 2), S(FH / 2 - 18)); ctx.lineTo(S(FW / 2), S(FH / 2 + 18));
    ctx.stroke();
    // error vector
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(S(FW / 2), S(FH / 2));
    ctx.lineTo(S(tgt.u), S(tgt.v));
    ctx.stroke();
    ctx.setLineDash([]);

    // target aircraft silhouette
    const cx = S(tgt.u), cy = S(tgt.v), sw = S(b.w) * 0.9;
    ctx.fillStyle = '#f4f6f8';
    ctx.strokeStyle = '#334';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy, sw * 0.42, sw * 0.045, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - sw * 0.06, cy - sw * 0.02);
    ctx.lineTo(cx - sw * 0.02, cy - sw * 0.16);
    ctx.lineTo(cx + sw * 0.5, cy - sw * 0.16 + sw * 0.02);
    ctx.lineTo(cx + sw * 0.08, cy + sw * 0.02);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - sw * 0.38, cy - sw * 0.03);
    ctx.lineTo(cx - sw * 0.44, cy - sw * 0.14);
    ctx.lineTo(cx - sw * 0.33, cy - sw * 0.03);
    ctx.fill(); ctx.stroke();

    // bounding box: #FF0000, ≤3 px (report spec); green once lock holds
    ctx.strokeStyle = locked ? '#00c853' : '#ff0000';
    ctx.lineWidth = 3;
    ctx.strokeRect(S(tgt.u - b.w / 2), S(tgt.v - b.h / 2), S(b.w), S(b.h));
    ctx.fillStyle = locked ? '#00c853' : '#ff0000';
    ctx.font = `600 ${Math.max(10, S(22))}px "IBM Plex Mono", monospace`;
    ctx.textAlign = 'left';
    ctx.fillText(`iha ${held ? held.toFixed(1) + ' s' : ''}`, S(tgt.u - b.w / 2), S(tgt.v - b.h / 2) - 5);

    // server clock, top-right, ms precision
    const d = new Date();
    const clock = `${d.toLocaleTimeString('tr-TR', { hour12: false })}.${String(d.getMilliseconds()).padStart(3, '0')}`;
    ctx.font = `500 ${Math.max(10, S(24))}px "IBM Plex Mono", monospace`;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    const tw = ctx.measureText(clock).width;
    ctx.fillRect(w - tw - S(28), S(10), tw + S(18), S(34));
    ctx.fillStyle = '#ffffff';
    ctx.fillText(clock, w - S(19), S(36));

    $('#ibE').innerHTML = `${fmt(ex, 2)} / ${fmt(ey, 2)}`;
    $('#ibPhi').innerHTML = `${fmt(phi, 1)}<small>°</small>`;
    $('#ibTheta').innerHTML = `${fmt(theta, 1)}<small>°</small>`;
    $('#ibT').innerHTML = `${fmt(T, 0)}<small>%</small>`;
    $('#ibLock').innerHTML = locked
      ? '<span class="chip ok">Kilitlendi</span>'
      : ok
        ? `<span class="chip warn">Takip ${held.toFixed(1)} / 4 s</span>`
        : !bigEnough
          ? '<span class="chip bad">Hedef çok küçük</span>'
          : '<span class="chip bad">Bölge dışında</span>';
    $('#ibvsSizeOut').textContent = `%${fmt(+sizeIn.value, 1)} · alan %${fmt(A * 100, 2)}`;
  };

  let raf = 0, visible = false;
  const loop = (t) => {
    frame(t);
    raf = visible ? requestAnimationFrame(loop) : 0;
  };
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !raf) raf = requestAnimationFrame(loop);
  }).observe(canvas);

  const toFrame = (e) => {
    const r = canvas.getBoundingClientRect();
    return { u: (e.clientX - r.left) / scale, v: (e.clientY - r.top) / scale };
  };
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    canvas.setPointerCapture(e.pointerId);
    tgt = toFrame(e);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (dragging) {
      const p = toFrame(e);
      tgt = { u: Math.max(0, Math.min(FW, p.u)), v: Math.max(0, Math.min(FH, p.v)) };
    }
  });
  canvas.addEventListener('pointerup', () => (dragging = false));
  canvas.style.cursor = 'grab';
  frame(performance.now());
}

/* ---------------- kamikaze profile ---------------- */
export function initKamikaze() {
  const host = $('#kkPlot');
  const ins = { h: $('#kkH'), th: $('#kkTh'), v: $('#kkV'), lag: $('#kkLag') };
  const g = 9.81;

  const draw = () => {
    const h = +ins.h.value, th = +ins.th.value, v = +ins.v.value, lag = +ins.lag.value;
    const rad = (th * Math.PI) / 180;
    const dTrig = h / Math.tan(rad) + v * lag;
    const dh = h - 15;
    const vt = Math.sqrt(v * v + 2 * g * dh * Math.sin(rad));
    const vEnd = 35; // report: with drag, dive-end speed stabilises at 35–38 m/s
    const R = (vEnd * 1.5) / 1.22;
    const G = 1 + (vEnd * vEnd) / (g * R);

    $('#kkHOut').textContent = `${h} m`;
    $('#kkThOut').textContent = `${th}°`;
    $('#kkVOut').textContent = `${v} m/s`;
    $('#kkLagOut').textContent = `${fmt(lag, 1)} s`;
    $('#kkD').innerHTML = `${fmt(dTrig, 1)}<small>m</small>`;
    $('#kkVt').innerHTML = `${fmt(vt, 1)}<small>m/s</small>`;
    $('#kkG').innerHTML = `${fmt(G, 2)}<small>G</small>`;
    $('#kkGd').textContent = `v = ${vEnd} m/s, R = ${fmt(R, 1)} m`;
    $('#kkSF').innerHTML = `${fmt(5 / G, 2)}`;

    const W = 760, H = 300, pad = { l: 44, r: 16, t: 16, b: 34 };
    const xr = [-800, 120], yr = [0, 170];
    const sx = (x) => pad.l + ((x - xr[0]) / (xr[1] - xr[0])) * (W - pad.l - pad.r);
    const sy = (y) => H - pad.b - ((y - yr[0]) / (yr[1] - yr[0])) * (H - pad.t - pad.b);
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Kamikaze görev profili', style: 'width:100%;min-width:520px;height:auto;display:block' });
    const ink = 'var(--muted)';
    for (let x = -800; x <= 100; x += 100) {
      svg.append(svgEl('line', { x1: sx(x), x2: sx(x), y1: pad.t, y2: H - pad.b, stroke: 'var(--line)' }));
      svg.append(svgEl('text', { x: sx(x), y: H - pad.b + 16, 'text-anchor': 'middle', 'font-size': 10.5, fill: ink }, x));
    }
    for (let y = 0; y <= 150; y += 30) {
      svg.append(svgEl('line', { x1: pad.l, x2: W - pad.r, y1: sy(y), y2: sy(y), stroke: 'var(--line)' }));
      svg.append(svgEl('text', { x: pad.l - 6, y: sy(y) + 4, 'text-anchor': 'end', 'font-size': 10.5, fill: ink }, y));
    }
    svg.append(svgEl('text', { x: W - pad.r, y: H - 4, 'text-anchor': 'end', 'font-size': 10.5, fill: ink }, 'hedefe yatay mesafe (m)'));
    svg.append(svgEl('text', { x: 4, y: pad.t - 4, 'font-size': 10.5, fill: ink, 'dominant-baseline': 'hanging' }, 'AGL (m)'));

    // floors
    const floor = (y, label, color) => {
      svg.append(svgEl('line', { x1: pad.l, x2: W - pad.r, y1: sy(y), y2: sy(y), stroke: color, 'stroke-dasharray': '4 4' }));
      svg.append(svgEl('text', { x: pad.l + 6, y: sy(y) - 4, 'font-size': 10.5, fill: color }, label));
    };
    floor(15, 'güvenlik tabanı 15 m', 'var(--bad)');
    floor(60, 'pull-up sonu 60 m', 'var(--ok)');
    // CLAHE band
    svg.append(svgEl('rect', { x: pad.l, width: W - pad.l - pad.r, y: sy(70), height: sy(30) - sy(70), fill: 'var(--sky-soft)' }));
    svg.append(svgEl('text', { x: W - pad.r - 6, y: sy(70) + 13, 'text-anchor': 'end', 'font-size': 10.5, fill: 'var(--sky)' }, 'CLAHE 30–70 m'));

    // path
    const xDive = -h / Math.tan(rad); // dive begins after lag, aimed at the target
    const xFloor = -15 / Math.tan(rad);
    const pts = [];
    pts.push(`M${sx(-800)} ${sy(150)}`, `L${sx(-650)} ${sy(150)}`, `L${sx(-600)} ${sy(h)}`);
    pts.push(`L${sx(-dTrig)} ${sy(h)}`, `L${sx(xDive)} ${sy(h)}`, `L${sx(xFloor)} ${sy(15)}`);
    const cx1 = sx(xFloor + 18), cy1 = sy(4);
    pts.push(`Q${cx1} ${cy1} ${sx(xFloor + 45)} ${sy(30)}`, `L${sx(xFloor + 75)} ${sy(60)}`);
    svg.append(svgEl('path', { d: pts.join(' '), fill: 'none', stroke: 'var(--sky)', 'stroke-width': 2.5, 'stroke-linejoin': 'round' }));
    // aim line
    svg.append(svgEl('line', { x1: sx(xFloor), y1: sy(15), x2: sx(0), y2: sy(0), stroke: 'var(--sky)', 'stroke-dasharray': '2 4' }));

    const mark = (x, y, label, color, anchor = 'middle', dy = -10, dx = 0) => {
      svg.append(svgEl('circle', { cx: sx(x), cy: sy(y), r: 4.5, fill: color }));
      svg.append(svgEl('text', { x: sx(x) + dx, y: sy(y) + dy, 'text-anchor': anchor, 'font-size': 11, fill: 'var(--ink)', 'font-weight': 600 }, label));
    };
    mark(-600, h, 'IP · 600 m', 'var(--muted)', 'middle', -10);
    mark(-dTrig, h, `tetik · ${fmt(dTrig, 0)} m`, 'var(--accent)', 'end', -10, -4);
    mark(xFloor, 15, 'pull-up', 'var(--bad)', 'end', 4, -9);
    svg.append(svgEl('text', { x: sx(-760), y: sy(150) - 8, 'font-size': 10.5, fill: ink }, 'seyir 150 m'));
    // target + QR
    svg.append(svgEl('rect', { x: sx(0) - 7, y: sy(0) - 7, width: 14, height: 7, fill: 'var(--ink)' }));
    svg.append(svgEl('text', { x: sx(0) + 11, y: sy(0) - 1, 'font-size': 11, fill: 'var(--ink)', 'font-weight': 600 }, 'QR'));
    // dive angle arc
    const ax = sx(xDive), ay = sy(h);
    svg.append(svgEl('text', { x: ax + 12, y: ay + 22, 'font-size': 11, fill: 'var(--accent-ink)' }, `${th}°`));

    host.innerHTML = '';
    host.append(svg);
  };
  Object.values(ins).forEach((i) => i.addEventListener('input', draw));
  draw();
}

/* ---------------- QR pixel density ---------------- */
const QR = (() => {
  const N = 21, m = new Uint8Array(N * N);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < N * N; i++) m[i] = rnd() > 0.5 ? 1 : 0;
  const finder = (r0, c0) => {
    for (let r = -1; r < 8; r++)
      for (let c = -1; c < 8; c++) {
        const rr = r0 + r, cc = c0 + c;
        if (rr < 0 || cc < 0 || rr >= N || cc >= N) continue;
        const ring = Math.max(Math.abs(r - 3), Math.abs(c - 3));
        m[rr * N + cc] = r < 0 || c < 0 || r > 6 || c > 6 ? 0 : ring === 2 ? 0 : 1;
      }
  };
  finder(0, 0); finder(0, 14); finder(14, 0);
  return m;
})();

export function initPpm() {
  const d = $('#ppmD');
  const svg = $('#ppmSvg');
  let fov = 85;
  const RES = 1200, TARGET = 2;
  const draw = () => {
    const dist = +d.value;
    const px = (TARGET * RES) / (2 * dist * Math.tan((fov * Math.PI) / 360));
    $('#ppmDOut').textContent = `${dist} m`;
    $('#ppmPx').innerHTML = `${fmt(px, 1)}<small>px</small>`;
    $('#ppmOk').innerHTML = px >= 18.5 ? '<span class="chip ok">Okunabilir</span>' : '<span class="chip bad">Yetersiz</span>';
    $('#ppmClahe').innerHTML = dist >= 30 && dist <= 70 ? '<span class="chip info">Etkin</span>' : '<span class="chip warn">Kapalı</span>';
    // Resample a 21×21 (version 1) QR pattern at the sensor's pixel count to show how much detail survives.
    const n = Math.max(1, Math.round(px));
    const cell = 120 / n;
    svg.innerHTML = '';
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        let on = 0, samples = 0;
        for (let a = 0; a < 3; a++)
          for (let b = 0; b < 3; b++) {
            const mr = Math.min(20, Math.floor(((i + (a + 0.5) / 3) / n) * 21));
            const mc = Math.min(20, Math.floor(((j + (b + 0.5) / 3) / n) * 21));
            on += QR[mr * 21 + mc];
            samples++;
          }
        const shade = Math.round(255 * (1 - on / samples));
        if (shade < 250) svg.append(svgEl('rect', { x: j * cell, y: i * cell, width: cell + 0.3, height: cell + 0.3, fill: `rgb(${shade},${shade},${shade})` }));
      }
    $('#ppmNote').textContent = `QR kod sensörde ${n}×${n} piksele düşüyor (21×21 modüllük kodun her modülüne ${fmt(px / 21, 2)} piksel).`;
  };
  segmented($('#ppm .seg'), (b) => {
    fov = +b.dataset.fov;
    draw();
  });
  d.addEventListener('input', draw);
  draw();
}
