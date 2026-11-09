/**
 * Post-build step: writes the Content-Security-Policy into dist/_headers.
 * The built pages contain a few constant inline scripts (theme bootstrap, router hydration). They are allowed by their
 * SHA-256 hash instead of 'unsafe-inline', so an injected script would still be blocked. The hashes are computed from the
 * real pages here, so they can never drift from the build.
 * Usage: tsx scripts/gen-csp.ts   (runs automatically as part of `npm run export:web`)
 */
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

const dist = join(__dirname, '..', 'dist');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.html') ? [p] : [];
  });

const hashes = new Set<string>();
for (const file of walk(dist)) {
  const html = readFileSync(file, 'utf8');
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/type="application\/ld\+json"/.test(m[1])) continue; // data blocks are not executed, CSP ignores them
    hashes.add(`'sha256-${createHash('sha256').update(m[2], 'utf8').digest('base64')}'`);
  }
}
if (!hashes.size || hashes.size > 6) {
  console.error(`[gen-csp] expected a handful of inline scripts, found ${hashes.size}. Review before shipping.`);
  process.exit(1);
}

const csp = [
  "default-src 'self'",
  // 'wasm-unsafe-eval' lets the OCR engine run WebAssembly; the Cloudflare Web Analytics beacon is added by the host at the edge
  `script-src 'self' 'wasm-unsafe-eval' ${[...hashes].sort().join(' ')} https://static.cloudflareinsights.com`,
  "style-src 'self' 'unsafe-inline'", // the web UI toolkit writes inline styles
  "img-src 'self' data: blob:",
  "font-src 'self' data: blob:",
  // the AI tools call the provider the visitor chose, with the visitor's own key; analytics reports to Cloudflare
  "connect-src 'self' https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com https://cloudflareinsights.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ');

const file = join(dist, '_headers');
if (!existsSync(file)) {
  console.error('[gen-csp] dist/_headers is missing');
  process.exit(1);
}
const text = readFileSync(file, 'utf8');
if (/Content-Security-Policy/i.test(text)) {
  console.log('[gen-csp] a policy is already present, leaving it');
} else {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const out = text.replace(/(\r?\n\/\*\r?\n)/, `$1  Content-Security-Policy: ${csp}${eol}`);
  if (out === text) {
    console.error('[gen-csp] could not find the "/*" block in _headers');
    process.exit(1);
  }
  writeFileSync(file, out);
  console.log(`[gen-csp] Content-Security-Policy written (${hashes.size} inline script hashes)`);
}
