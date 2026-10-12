// Sections 6 and 8 widgets: comms map + table, YKİ tabs, inference benchmark, flight checklist.
import { $, $$, fmt, segmented, svgEl, store } from '../util.js';

/* ---------------- comms ---------------- */
const NODES = {
  jetson: { x: 120, y: 90, t: 'Jetson Orin NX', s: 'görev bilgisayarı' },
  cube: { x: 120, y: 240, t: 'Orange Cube', s: 'otopilot (PX4)' },
  yki: { x: 470, y: 165, t: 'YKİ', s: 'PyQt5 arayüz' },
  rc: { x: 470, y: 290, t: 'Herelink kumanda', s: 'yedek RC' },
  srv: { x: 670, y: 165, t: 'Yarışma sunucusu', s: 'REST API' },
};
const LINKS = [
  { a: 'cube', b: 'yki', band: 'sub', name: 'İHA (Pixhawk) ↔ YKİ', hw: 'RFD900x Plus', proto: 'MAVLink v2 (868/900 MHz)', dir: 'Çift yönlü', why: 'Uçuş telemetrisinin aktarımı ve operatör komutlarının iletimi.', bend: 30 },
  { a: 'jetson', b: 'cube', band: 'wire', name: 'İHA içi (Jetson ↔ Pixhawk)', hw: 'Dahili UART', proto: 'MAVLink v2', dir: 'Çift yönlü', why: 'Jetson otonom seyrüsefer komutlarının ve anlık sensör verilerinin paylaşımı.', bend: 0 },
  { a: 'jetson', b: 'yki', band: '24', name: 'İHA (Jetson) ↔ YKİ', hw: 'Herelink v1.1 (köprü)', proto: 'TCP soket / JSON (yerel ağ)', dir: 'Çift yönlü', why: 'Sunucu rakip verilerinin ve otonom algoritma sonuçlarının paylaşımı.', bend: -34 },
  { a: 'jetson', b: 'yki', band: '24', name: 'İHA (Jetson) → YKİ', hw: 'Herelink v1.1 (video)', proto: 'UDP / RTSP (2.4 GHz)', dir: 'İHA → YKİ', why: 'İşlenmiş canlı video akışının operatör arayüzüne iletimi.', bend: 8, arrow: true },
  { a: 'cube', b: 'rc', band: '24', name: 'İHA (Pixhawk) ↔ Kumanda (yedek)', hw: 'Herelink v1.1 (RC)', proto: 'S.Bus (2.4 GHz)', dir: 'Çift yönlü', why: 'Acil durumlarda (failsafe) manuel uçuş kontrolünün sağlanması.', bend: 20 },
  { a: 'yki', b: 'srv', band: 'wire', name: 'YKİ ↔ Yarışma sunucusu', hw: 'Ethernet (kablolu)', proto: 'REST API (HTTP/JSON)', dir: 'Çift yönlü', why: 'Yarışma telemetrisinin gönderimi ve rakip/HSS verilerinin alınması.', bend: 0 },
];
const BAND = { sub: 'var(--sky)', '24': 'var(--accent)', wire: 'var(--muted)' };

export function initComms() {
  const svg = $('#commsSvg');
  const detail = $('#commsDetail');
  const tbody = $('#commsTable tbody');
  let sel = 0;

  // airframe boundary
  svg.append(svgEl('rect', { x: 20, y: 30, width: 200, height: 270, rx: 10, fill: 'none', stroke: 'var(--line)', 'stroke-dasharray': '5 5' }));
  svg.append(svgEl('text', { x: 32, y: 50, 'font-size': 11, fill: 'var(--muted)', 'letter-spacing': '0.08em' }, 'İHA'));
  svg.append(svgEl('rect', { x: 395, y: 120, width: 330, height: 90, rx: 10, fill: 'none', stroke: 'var(--line)', 'stroke-dasharray': '5 5' }));
  svg.append(svgEl('text', { x: 406, y: 138, 'font-size': 11, fill: 'var(--muted)', 'letter-spacing': '0.08em' }, 'YER'));

  const defs = svgEl('defs', {});
  defs.innerHTML = '<marker id="arrowA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--accent)"/></marker>';
  svg.append(defs);

  const linkEls = LINKS.map((l, i) => {
    const A = NODES[l.a], B = NODES[l.b];
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
    const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy);
    const nx = -dy / len, ny = dx / len;
    const d = `M${A.x} ${A.y} Q${mx + nx * l.bend * 2} ${my + ny * l.bend * 2} ${B.x} ${B.y}`;
    const g = svgEl('g', { class: 'link', tabindex: 0, role: 'button', 'aria-label': l.name });
    g.append(svgEl('path', { class: 'hit', d }));
    const ln = svgEl('path', { class: 'ln', d, stroke: BAND[l.band], 'stroke-dasharray': l.band === 'wire' ? '0' : l.arrow ? '7 5' : '0' });
    if (l.arrow) ln.setAttribute('marker-end', 'url(#arrowA)');
    g.append(ln);
    g.addEventListener('click', () => select(i));
    g.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), select(i)));
    svg.append(g);
    return g;
  });

  for (const n of Object.values(NODES)) {
    const w = 150, h = 46;
    svg.append(svgEl('rect', { x: n.x - w / 2, y: n.y - h / 2, width: w, height: h, rx: 6, fill: 'var(--surface)', stroke: 'var(--ink)', 'stroke-width': 1.2 }));
    svg.append(svgEl('text', { x: n.x, y: n.y - 3, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 600, fill: 'var(--ink)' }, n.t));
    svg.append(svgEl('text', { x: n.x, y: n.y + 13, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--muted)' }, n.s));
  }

  tbody.innerHTML = LINKS.map(
    (l, i) => `<tr data-i="${i}" tabindex="0" style="cursor:pointer"><td>${l.name}</td><td>${l.hw}</td><td class="mono">${l.proto}</td><td>${l.dir}</td><td>${l.why}</td></tr>`,
  ).join('');
  tbody.addEventListener('click', (e) => {
    const tr = e.target.closest('tr');
    if (tr) {
      select(+tr.dataset.i);
      $('#comms').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  function select(i) {
    sel = i;
    const l = LINKS[i];
    linkEls.forEach((g, j) => g.classList.toggle('on', j === i));
    $$('tr', tbody).forEach((tr) => tr.classList.toggle('hl', +tr.dataset.i === i));
    detail.innerHTML = `<h5>${l.name}</h5><dl class="kv"><dt>Donanım</dt><dd>${l.hw}</dd><dt>Protokol</dt><dd>${l.proto}</dd><dt>Yön</dt><dd>${l.dir}</dd><dt>Amaç</dt><dd>${l.why}</dd></dl>`;
  }
  select(sel);
}

/* ---------------- YKİ tabs ---------------- */
const TABS = [
  ['Kontroller', 'Hız, irtifa, uçuş modu, armed/disarmed, batarya seviyesi.', 'pymavlink ile RFD900x hattı dinlenir; hız ve irtifa TapeWidget şerit göstergeleriyle sunulur.'],
  ['Kamera', 'Canlı video akışı, kilitlenme dörtgeni ve YOLO11s tespit kutuları.', 'Hesaplamalar Jetson’da yapılıp TCP ile YKİ’ye iletilir. %5 merkez alan kısıtı ve 4 saniye takip şartı sağlandığında dörtgen yeşile, sağlanmazsa kırmızıya döner.'],
  ['Harita', 'Öz konum, uçuş sınırları, HSS bölgeleri, rakip İHA ve QR kod konumu.', 'Leaflet.js tabanlıdır. Uçuş sınırı mavi poligon, güncellenen HSS bölgeleri kırmızı (#FF0000) daireler, QR siyah, rakipler sarı ve öz konum yeşil ikonla görselleştirilir.'],
  ['Mesajlar', 'Sunucu durumu, API gecikmesi ve sistem logları.', 'Sunucu verileri ve Orange Cube’dan gelen STATUSTEXT (hata/durum) mesajları kronolojik bir kuyruk yapısında listelenir.'],
  ['Parametreler', 'PID katsayıları, failsafe limitleri ve sensör ofsetleri.', 'MAVLink Parameter Microservice ile EEPROM verilerinin okunması ve anlık güncellenmesi sağlanır.'],
  ['Kumanda', 'Ham PWM değerleri (CH1–CH16), RSSI sinyal gücü, anahtar pozisyonları.', 'Herelink üzerinden iletilen radyo sinyalleri, RC_CHANNELS mesajı baz alınarak arayüzde görselleştirilir.'],
];

export function initYki() {
  const tabs = $('#yki .tabs');
  const panel = $('#ykiPanel');
  tabs.innerHTML = TABS.map((t, i) => `<button type="button" role="tab" id="ykt${i}" aria-selected="${i === 2}" aria-controls="ykiPanel">${t[0]}</button>`).join('');
  const show = (i) => {
    $$('button', tabs).forEach((b, j) => b.setAttribute('aria-selected', String(i === j)));
    panel.setAttribute('aria-labelledby', `ykt${i}`);
    panel.innerHTML = `<dl class="kv" style="padding-top:6px"><dt>Gösterilen bilgi</dt><dd>${TABS[i][1]}</dd><dt>Teknik detay</dt><dd>${TABS[i][2]}</dd></dl>`;
  };
  tabs.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) show($$('button', tabs).indexOf(b));
  });
  show(2);
}

/* ---------------- inference benchmark (values read from Fig. 23 labels) ---------------- */
const MODELS = ['YOLO11m FP16', 'YOLO11m FP32', 'YOLO11s FP16', 'YOLO11s FP32', 'RF-DETR Medium FP32 (ORT)', 'RF-DETR Nano FP32 (ORT)', 'RF-DETR Small FP32 (ORT)'];
const DATA = {
  fps: { 15: [28, 14, 56, 30, 4, 8, 5], 25: [31, 15, 60, 31, 6, 14, 7] },
  lat: { 15: [35.3, 71.6, 17.7, 33.3, 275.0, 122.0, 206.7], 25: [32.5, 65.7, 16.7, 31.9, 181.7, 73.9, 136.3] },
};
const PICK = 2;

export function initBench(lightbox) {
  let metric = 'fps', power = '15';
  const bars = $('#benchBars'), axis = $('#benchAxis');
  bars.innerHTML = MODELS.map(
    (m, i) => `<div class="bar-row${i === PICK ? ' pick' : ''}"><span class="lbl" title="${m}">${m}</span><div class="bar-track"><div class="bar-fill"></div></div><span class="v"></span></div>`,
  ).join('');
  const render = () => {
    const vals = DATA[metric][power];
    const max = metric === 'fps' ? 60 : 300;
    $$('.bar-row', bars).forEach((row, i) => {
      $('.bar-fill', row).style.width = `${(vals[i] / max) * 100}%`;
      $('.v', row).textContent = metric === 'fps' ? `${vals[i]} FPS` : `${fmt(vals[i], 1)} ms`;
    });
    const ticks = metric === 'fps' ? [0, 15, 30, 45, 60] : [0, 100, 200, 300];
    axis.innerHTML = `<span></span><div class="ticks">${ticks.map((t) => `<span>${t}</span>`).join('')}</div><span>${metric === 'fps' ? 'FPS' : 'ms'}</span>`;
  };
  $$('#bench .seg').forEach((g) =>
    segmented(g, (b) => {
      if (b.dataset.metric) metric = b.dataset.metric;
      if (b.dataset.power) power = b.dataset.power;
      render();
    }),
  );
  $('#benchOrig').addEventListener('click', () => lightbox.openGroup($$('#benchImgs button.zoom')));
  render();
}

/* ---------------- checklist ---------------- */
const CHECK = [
  ['Gövde & Kanat', 'Bağlantı noktaları sağlam, yapısal çatlak veya gevşeme yok.'],
  ['Motor & Pervane', 'Motor mesneti sağlam, pervane hasarsız ve gevşemeyecek şekilde takılı.'],
  ['İniş Takımı', 'Tekerlek dönme direnci düşük, bağlantılar stabil.'],
  ['Kontrol Yüzeyleri', 'Servo motorlar ve menteşeler sağlam, hareket alanı engellenmemiş.'],
  ['Kapaklar & Montaj', 'Gövde erişim kapakları kilitli, dahili cihazlar uçağa tam sabitlenmiş.'],
  ['Ağırlık Merkezi', 'Uçağın balans ve ağırlık merkezi belirlenen sınırlar içerisinde.'],
  ['Batarya (İHA)', 'Hücre voltajları dengeli, tam şarjlı ve fiziksel hasarsız.'],
  ['Kumanda & Alıcı', 'Kumanda şarjı yeterli, alıcı antenleri 90 derece açıyla gövde dışında.'],
  ['ESC & Bağlantılar', 'Kablo bağlantıları güvenli, ısınma veya kısa devre belirtisi yok.'],
  ['Firmware & Sensör', 'Yazılım güncel, IMU ve barometre kalibrasyonları tamamlanmış.'],
  ['Telemetri', 'Yer Kontrol İstasyonu (GCS) ile uçuş kartı bağlantısı kesintisiz.'],
  ['Kamera & Görüntü', 'Kamera odağı net, lens temiz ve görüntü aktarımı stabil.'],
  ['Sunucu Bağlantısı', 'Yarışma sunucusu ile iletişim kuruldu, ping/veri trafiği normal.'],
];

export function initChecklist() {
  const KEY = 'ikarus-checklist';
  const list = $('#checkList');
  const state = store.get(KEY, []);
  list.innerHTML = CHECK.map(
    ([p, c], i) => `<label><input type="checkbox" id="chk${i}" ${state[i] ? 'checked' : ''}><b>${p}</b><span>${c}</span></label>`,
  ).join('');
  const update = () => {
    const vals = CHECK.map((_, i) => $(`#chk${i}`).checked);
    const n = vals.filter(Boolean).length;
    $('#checkCount').textContent = `${n}/${CHECK.length}`;
    $('#checkMeter').style.width = `${(n / CHECK.length) * 100}%`;
    $('#checkStatus').innerHTML = n === CHECK.length
      ? '<span class="chip ok">Tüm kontroller tamam. Pervaneler uçuş onayından sonra takılır.</span>'
      : `${CHECK.length - n} madde kaldı. Uçuşa hazır olmak için tüm maddeler işaretlenmelidir.`;
    store.set(KEY, vals);
  };
  list.addEventListener('change', update);
  $('#checkReset').addEventListener('click', () => {
    $$('input', list).forEach((i) => (i.checked = false));
    update();
  });
  update();
}
