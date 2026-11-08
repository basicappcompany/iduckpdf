// Copies the pdf.js browser build into public/vendor so the site serves it itself
// (no third-party CDN at runtime). Runs automatically after `npm install`.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'node_modules', 'pdfjs-dist', 'build');
const dest = path.join(root, 'public', 'vendor');

try {
  fs.mkdirSync(dest, { recursive: true });
  for (const f of ['pdf.min.js', 'pdf.worker.min.js']) {
    fs.copyFileSync(path.join(src, f), path.join(dest, f));
  }
  console.log('[copy-vendor] pdf.js copied to public/vendor');
} catch (e) {
  console.warn('[copy-vendor] skipped:', e.message);
}
