/**
 * Audits the built site in dist/ the way a crawler would (no JavaScript): titles, descriptions, canonicals,
 * headings, structured data, links, duplicates, sitemap coverage. Exits non-zero on any failure.
 * Usage: npm run audit   (after npm run export:web)
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join, relative, sep } from 'path';

const dist = join(__dirname, '..', 'dist');
const SITE = 'https://iduckpdf.com';
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));

const pages = walk(dist)
  .filter((f) => f.endsWith('.html'))
  .map((f) => {
    const rel = relative(dist, f).split(sep).join('/');
    return { rel, path: rel === 'index.html' ? '/' : '/' + rel.replace(/\.html$/, '').replace(/\/index$/, ''), html: readFileSync(f, 'utf8') };
  });

const fails: string[] = [];
const warns: string[] = [];
const fail = (p: string, m: string) => fails.push(`${p}: ${m}`);
const warn = (p: string, m: string) => warns.push(`${p}: ${m}`);
const one = (html: string, re: RegExp) => (html.match(re) || [])[1];

const titles = new Map<string, string[]>();
const descs = new Map<string, string[]>();
let indexable = 0;

for (const pg of pages) {
  const { html, path } = pg;
  const robots = one(html, /<meta name="robots" content="([^"]*)"/);
  const noindex = !!robots && robots.includes('noindex');
  if (!robots) fail(path, 'missing robots meta');
  if (noindex) continue; // placeholders and forms only need to say noindex
  indexable++;

  const titleTags = html.match(/<title[ >]/g) || [];
  const title = one(html, /<title[^>]*>([^<]*)<\/title>/);
  if (titleTags.length !== 1) fail(path, `${titleTags.length} <title> tags`);
  if (!title) fail(path, 'no title');
  else {
    if (title.length > 70) warn(path, `title is ${title.length} chars: ${title}`);
    titles.set(title, [...(titles.get(title) || []), path]);
  }

  const desc = one(html, /<meta[^>]*name="description" content="([^"]*)"/);
  if (!desc) fail(path, 'no meta description');
  else {
    if (desc.length < 60 || desc.length > 165) warn(path, `description is ${desc.length} chars`);
    descs.set(desc, [...(descs.get(desc) || []), path]);
  }

  const canon = one(html, /<link[^>]*rel="canonical" href="([^"]*)"/);
  if (canon !== SITE + (path === '/' ? '/' : path)) fail(path, `canonical is ${canon}`);

  const h1 = (html.match(/<h1[ >]/g) || []).length;
  if (h1 !== 1) fail(path, `${h1} <h1> tags`);
  if (!/<html lang="en"/.test(html)) fail(path, 'no html lang');
  if (!html.includes('property="og:title"') || !html.includes('property="og:image"')) fail(path, 'missing Open Graph tags');

  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (ld.length < 2) warn(path, `only ${ld.length} JSON-LD block(s)`);
  for (const m of ld) {
    try {
      JSON.parse(m[1]);
    } catch {
      fail(path, 'invalid JSON-LD');
    }
  }

  if (!/<script[^>]*src="\/_expo\/static\/js\/web\/entry-/.test(html)) fail(path, 'app bundle script tag missing: page would be static-only, not interactive');
  const links = (html.match(/<a [^>]*href="\/[^"]*"/g) || []).length;
  if (links < 10) fail(path, `only ${links} crawlable internal links`);
  const words = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  if (words < 150) warn(path, `thin content: ${words} words`);
}

for (const [t, ps] of titles) if (ps.length > 1) fail(ps.join(', '), `duplicate title "${t}"`);
for (const [d, ps] of descs) if (ps.length > 1) fail(ps.join(', '), `duplicate description "${d.slice(0, 50)}…"`);

// sitemap <-> files
const sm = readFileSync(join(dist, 'sitemap.xml'), 'utf8');
const urls = [...sm.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1].replace(SITE, '') || '/');
for (const u of urls) {
  const base = u.replace(/^\//, '');
  const ok = u === '/' ? existsSync(join(dist, 'index.html')) : existsSync(join(dist, base + '.html')) || existsSync(join(dist, base, 'index.html'));
  if (!ok) fail('sitemap', `${u} has no page`);
}
if (urls.length !== indexable) fail('sitemap', `${urls.length} URLs in the sitemap but ${indexable} indexable pages`);

for (const f of ['robots.txt', 'llms.txt', 'llms-full.txt', 'manifest.webmanifest', 'og.png', 'favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png']) {
  if (!existsSync(join(dist, f))) fail('assets', `${f} missing from dist`);
}
if (!/Sitemap: https:\/\/iduckpdf\.com\/sitemap\.xml/.test(readFileSync(join(dist, 'robots.txt'), 'utf8'))) fail('robots.txt', 'no Sitemap line');

console.log(`Audited ${pages.length} pages (${indexable} indexable). Sitemap lists ${urls.length}.`);
if (warns.length) console.log(`\n${warns.length} warning(s):\n  - ${warns.join('\n  - ')}`);
if (fails.length) {
  console.log(`\n${fails.length} FAILURE(S):\n  - ${fails.join('\n  - ')}`);
  process.exit(1);
}
console.log('\nAll SEO checks passed.');
