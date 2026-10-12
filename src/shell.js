import { $, $$ } from './util.js';

export function initTheme() {
  $('#themeBtn').addEventListener('click', () => {
    const root = document.documentElement;
    const current = root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try {
      localStorage.setItem('ikarus-theme', next);
    } catch {
      /* ignore */
    }
  });
}

export function initToc() {
  const toc = $('#toc');
  const btn = $('#tocBtn');
  const links = $$('a', toc);
  const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  const targets = links.map((a) => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);

  btn.addEventListener('click', () => {
    const show = !toc.classList.contains('show');
    toc.classList.toggle('show', show);
    btn.setAttribute('aria-expanded', String(show));
  });
  toc.addEventListener('click', (e) => {
    if (e.target.closest('a')) {
      toc.classList.remove('show');
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  const progress = $('#progress');
  let ticking = false;
  const update = () => {
    ticking = false;
    const doc = document.documentElement;
    const max = doc.scrollHeight - innerHeight;
    progress.style.width = `${max > 0 ? (scrollY / max) * 100 : 0}%`;

    const line = 120;
    let current = targets[0];
    for (const t of targets) {
      if (t.getBoundingClientRect().top - line <= 0) current = t;
      else break;
    }
    links.forEach((a) => a.classList.remove('active'));
    $$('li.open', toc).forEach((li) => li.classList.remove('open'));
    const a = current && byId.get(current.id);
    if (a) {
      a.classList.add('active');
      const top = a.closest('#toc > ol > li');
      top?.classList.add('open');
      top?.querySelector(':scope > a')?.classList.add('active');
    }
  };
  addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });
  update();
}

export function initLightbox() {
  const dlg = $('#lightbox');
  const img = $('#lbImg');
  const cap = $('#lbCap');
  const count = $('#lbCount');
  let items = [];
  let i = 0;

  const collect = () => $$('button.zoom').filter((b) => !b.closest('[hidden]') || b.closest('#benchImgs'));
  const show = () => {
    const b = items[i];
    const src = b.querySelector('img');
    img.src = src.currentSrc || src.src;
    img.alt = src.alt;
    cap.textContent = b.dataset.cap || src.alt;
    count.textContent = `${i + 1} / ${items.length}`;
  };
  const open = (btn, group) => {
    items = group || collect().filter((b) => !b.closest('#benchImgs'));
    i = Math.max(0, items.indexOf(btn));
    show();
    if (!dlg.open) dlg.showModal();
  };
  const step = (d) => {
    i = (i + d + items.length) % items.length;
    show();
  };

  document.addEventListener('click', (e) => {
    const b = e.target.closest('button.zoom');
    if (b) open(b);
  });
  $('#lbPrev').addEventListener('click', () => step(-1));
  $('#lbNext').addEventListener('click', () => step(1));
  $('#lbClose').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg || e.target.classList.contains('lb-stage')) dlg.close();
  });
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
  });

  let x0 = null;
  dlg.addEventListener('touchstart', (e) => (x0 = e.touches[0].clientX), { passive: true });
  dlg.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    x0 = null;
  });

  return { openGroup: (btns) => open(btns[0], btns) };
}
