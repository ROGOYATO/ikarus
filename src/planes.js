// "Uçaklarımız" menu in the top bar, shared by both pages.
export function initPlanes() {
  const btn = document.getElementById('planesBtn');
  const menu = document.getElementById('planesMenu');
  if (!btn || !menu) return;

  const set = (open) => {
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  };
  btn.addEventListener('click', () => set(menu.hidden));
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.planes')) set(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) {
      set(false);
      btn.focus();
    }
  });
}
