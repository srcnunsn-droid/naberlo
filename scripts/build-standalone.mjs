import { build } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import archiver from 'archiver';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
await build({
  configFile: false,
  plugins: [react()],
  define: { 'import.meta.env.VITE_STANDALONE': JSON.stringify('1') },
  build: {
    outDir: '.standalone',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
let html = await fs.readFile('.standalone/index.html', 'utf8');
const script = html.match(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/);
const css = html.match(/<link\b[^>]*href="([^"]+\.css)"[^>]*>/);
if (!script || !css) throw new Error('Standalone build assets missing.');
const js = await fs.readFile(path.join('.standalone', script[1]), 'utf8');
const style = await fs.readFile(path.join('.standalone', css[1]), 'utf8');
html = html.replace(
  script[0],
  () => `<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`,
);
html = html.replace(css[0], () => `<style>${style}</style>`);
html = html.replace(
  '<title>Naberlo — Stadium Studio</title>',
  '<title>Naberlo — Tek HTML Stüdyo</title>',
);
html = html.replace(
  '<div id="root"></div>',
  '<div id="root"></div><noscript>Programı kullanmak için tarayıcınızda JavaScript açık olmalıdır.</noscript>',
);
await fs.writeFile('NABERLO.html', html);
await new Promise((resolve, reject) => {
  const output = createWriteStream('NABERLO-HTML.zip');
  const zip = archiver('zip', { zlib: { level: 9 } });
  output.on('close', resolve);
  output.on('error', reject);
  zip.on('error', reject);
  zip.pipe(output);
  zip.append(html, { name: 'NABERLO.html' });
  zip.append(
    'NABERLO.html dosyasini ZIP disina cikarip Chrome veya Edge ile acin. Kurulum veya sunucu gerekmez. Projeler tarayicida saklanir; baska cihaza gecmeden once Yedegi indir dugmesini kullanin. Otomatik AI gorsel uretimi bu HTML surumunde yoktur; prompt ve gorsel yukleme akisi vardir.',
    { name: 'ONCE-OKU.txt' },
  );
  void zip.finalize();
});
console.log(
  `NABERLO.html hazır (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(1)} MB). Sunucu gerektirmez.`,
);
