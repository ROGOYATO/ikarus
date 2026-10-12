import { defineConfig } from 'vite';
import katex from 'katex';

const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// Render every <span class="tex">…</span> to MathML at build time, so no math library ships to the browser.
const prerenderMath = () => ({
  name: 'prerender-math',
  transformIndexHtml(html) {
    return html.replace(/<span class="tex"( data-display)?>([\s\S]*?)<\/span>/g, (_, display, tex) => {
      const out = katex.renderToString(decode(tex), { output: 'mathml', displayMode: Boolean(display), throwOnError: true });
      return `<span class="tex"${display ?? ''}>${out}</span>`;
    });
  },
});

// Relative base so the build works on GitHub Pages project URLs (/<repo>/) and any static host.
export default defineConfig({
  base: './',
  plugins: [prerenderMath()],
  build: { outDir: 'dist', assetsInlineLimit: 0 },
});
