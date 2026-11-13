/**
 * A tiny static server for the built site, for the browser tests (locally and in CI):
 *   node scripts/serve-dist.js [dir] [port]      (defaults: dist, 8080)
 * Like the real host it serves /about from about.html, adds gzip, marks hashed assets as cacheable, and answers unknown
 * addresses with 404.html. It applies the headers of the "/*" block of _headers (including the Content-Security-Policy, so the
 * browser tests run under the real policy) but not public/_redirects.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.resolve(process.argv[2] || 'dist');
const port = Number(process.argv[3]) || 8080;
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.mjs': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.gz': 'application/gzip', '.pdf': 'application/pdf' };
const zippable = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt', '.xml', '.webmanifest']);

// headers from the "/*" block of _headers, like the real host
const siteHeaders = {};
try {
  const lines = fs.readFileSync(path.join(root, '_headers'), 'utf8').split(/\r?\n/).map((l) => l.replace(/^﻿/, ''));
  const at = lines.findIndex((l) => l.trim() === '/*');
  for (let i = at + 1; at >= 0 && i < lines.length && /^\s+\S/.test(lines[i]); i++) {
    const k = lines[i].indexOf(':');
    if (k > 0) siteHeaders[lines[i].slice(0, k).trim()] = lines[i].slice(k + 1).trim();
  }
} catch {}

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const base = path.join(root, urlPath);
  if (!base.startsWith(root)) { res.writeHead(403); return res.end(); }
  const hit = [base, base + '.html', path.join(base, 'index.html')].find((x) => fs.existsSync(x) && fs.statSync(x).isFile());
  const file = hit || path.join(root, '404.html');
  const ext = path.extname(file);
  const headers = { ...siteHeaders, 'Content-Type': mime[ext] || 'application/octet-stream' };
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
}).listen(port, () => console.log(`serving ${root} on http://localhost:${port}${siteHeaders['Content-Security-Policy'] ? ' (with the Content-Security-Policy)' : ''}`));
