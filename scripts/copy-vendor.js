// Copies browser builds that the site serves itself into public/vendor (no third-party CDN at runtime):
//   - pdf.js (reading and rendering pages)
//   - Tesseract.js (OCR): the script, its worker, the WebAssembly core and the language data
// Runs automatically after `npm install` (public/vendor is not committed).
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const nm = path.join(root, 'node_modules');
const dest = path.join(root, 'public', 'vendor');
const copy = (from, to) => {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
};

try {
  // The "legacy" build also runs on older Safari and Chrome versions. It is an ES module, loaded by scripts/pdfjs-loader.mjs.
  const base = path.join(nm, 'pdfjs-dist');
  const pdfjs = path.join(base, 'legacy', 'build');
  for (const f of ['pdf.min.mjs', 'pdf.worker.min.mjs']) copy(path.join(pdfjs, f), path.join(dest, f));
  copy(path.join(root, 'scripts', 'pdfjs-loader.mjs'), path.join(dest, 'pdfjs-loader.mjs'));
  // WebAssembly decoders (JPEG 2000 and colour profiles), standard fonts and character maps, all served from this site
  for (const d of ['wasm', 'standard_fonts', 'cmaps']) {
    const from = path.join(base, d);
    for (const f of fs.readdirSync(from)) copy(path.join(from, f), path.join(dest, 'pdfjs', d, f));
  }
  console.log('[copy-vendor] pdf.js copied to public/vendor');
} catch (e) {
  console.warn('[copy-vendor] pdf.js skipped:', e.message);
}

try {
  const t = path.join(dest, 'tesseract');
  const tj = path.join(nm, 'tesseract.js', 'dist');
  for (const f of ['tesseract.min.js', 'worker.min.js']) copy(path.join(tj, f), path.join(t, f));
  // the WebAssembly core: the engine picks the variant that suits the device (plain, SIMD, relaxed SIMD) at run time
  const core = path.join(nm, 'tesseract.js-core');
  for (const f of fs.readdirSync(core).filter((n) => /^tesseract-core.*\.wasm\.js$/.test(n))) copy(path.join(core, f), path.join(t, 'core', f));
  // language data: Latin-script languages that the standard PDF fonts can write into a text layer
  const langs = ['eng', 'spa', 'fra', 'deu', 'ita', 'por', 'nld'];
  let n = 0;
  for (const l of langs) {
    const f = path.join(nm, '@tesseract.js-data', l, '4.0.0_best_int', `${l}.traineddata.gz`);
    if (fs.existsSync(f)) {
      copy(f, path.join(t, 'lang', `${l}.traineddata.gz`));
      n++;
    }
  }
  console.log(`[copy-vendor] Tesseract OCR copied to public/vendor/tesseract (${n} languages)`);
} catch (e) {
  console.warn('[copy-vendor] OCR skipped:', e.message);
}
