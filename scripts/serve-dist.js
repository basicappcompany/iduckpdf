/**
 * A tiny static server for the built site, for the browser tests (locally and in CI):
 *   node scripts/serve-dist.js [dir] [port]      (defaults: dist, 8080)
 * Like the real host it serves /about from about.html, adds gzip, marks hashed assets as cacheable, and answers unknown
 * addresses with 404.html. It does not apply public/_redirects.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.resolve(process.argv[2] || 'dist');
const port = Number(process.argv[3]) || 8080;
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.gz': 'application/gzip', '.pdf': 'application/pdf' };
const zippable = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt', '.xml', '.webmanifest']);

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const base = path.join(root, urlPath);
  if (!base.startsWith(root)) { res.writeHead(403); return res.end(); }
  const hit = [base, base + '.html', path.join(base, 'index.html')].find((x) => fs.existsSync(x) && fs.statSync(x).isFile());
  const file = hit || path.join(root, '404.html');
  const ext = path.extname(file);
  const headers = { 'Content-Type': mime[ext] || 'application/octet-stream' };
  if (/\/_expo\/static\//.test(req.url)) headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  const body = fs.readFileSync(file);
  const code = hit ? 200 : 404;
  if (zippable.has(ext) && /gzip/.test(req.headers['accept-encoding'] || '')) {
    headers['Content-Encoding'] = 'gzip';
    res.writeHead(code, headers);
    return res.end(zlib.gzipSync(body));
  }
  res.writeHead(code, headers);
  res.end(body);
}).listen(port, () => console.log(`serving ${root} on http://localhost:${port}`));
