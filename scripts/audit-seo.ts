/**
 * Audits the built site in dist/ the way a crawler would (no JavaScript): titles, descriptions, canonicals,
 * headings, structured data, links, duplicates, sitemap coverage. Exits non-zero on any failure.
 * Usage: npm run audit   (after npm run export:web)
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join, relative, sep } from 'path';
import { splitPath, localeOf, localePath, liveLocales, ENGLISH_ONLY_PATHS, DEFAULT_LANG } from '../src/i18n/locales';

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

const canonOf = new Map<string, string>();
const altsOf = new Map<string, { hreflang: string; href: string }[]>();
const langOf = new Map<string, string>();
const titles = new Map<string, string[]>();
const descs = new Map<string, string[]>();
let indexable = 0;
let overlayPages = 0; // indexable English (UK) pages: hreflang alternates only, not sitemap URLs

for (const pg of pages) {
  const { html, path } = pg;
  const robots = one(html, /<meta name="robots" content="([^"]*)"/);
  const noindex = !!robots && robots.includes('noindex');
  if (!robots) fail(path, 'missing robots meta');
  if (noindex) continue; // placeholders and forms only need to say noindex
  indexable++;
  if (/^\/en-gb(\/|$)/.test(path)) overlayPages++;

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
  const { lang, path: enPath } = splitPath(path);
  const slashed = enPath === '/guides' || (lang !== DEFAULT_LANG && enPath === '/'); // /guides/ and /es/ are folders on the host
  const expectCanon = SITE + (slashed ? localePath(enPath, lang).replace(/\/?$/, '/') : path);
  if (canon !== expectCanon) fail(path, `canonical is ${canon}, expected ${expectCanon}`);
  canonOf.set(path, canon || '');
  const alts = [...html.matchAll(/<link rel="alternate" hreflang="([^"]*)" href="([^"]*)"/g)].map((m) => ({ hreflang: m[1], href: m[2] }));
  if (alts.length) altsOf.set(canon || path, alts);
  langOf.set(canon || path, lang);

  const h1 = (html.match(/<h1[ >]/g) || []).length;
  if (h1 !== 1) fail(path, `${h1} <h1> tags`);
  if (!html.includes(`<html lang="${localeOf(lang).hreflang}"`)) fail(path, `html lang should be ${localeOf(lang).hreflang}`);
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

// hreflang: every language version lists the same cluster, includes itself and x-default, and each member points back (reciprocity)
{
  const multi = liveLocales().length > 1;
  for (const [self, alts] of altsOf) {
    if (!alts.some((a) => a.href === self)) fail(self, 'hreflang set does not include the page itself');
    if (!alts.some((a) => a.hreflang === 'x-default')) fail(self, 'hreflang set has no x-default');
    const live = liveLocales().length;
    if (alts.length !== live + 1) fail(self, `hreflang set has ${alts.length} entries, expected ${live + 1}`);
    for (const a of alts) {
      if (a.hreflang === 'x-default') continue;
      const back = altsOf.get(a.href);
      if (!back) fail(self, `hreflang ${a.hreflang} points at ${a.href}, which is not an indexable page with alternates`);
      else if (!back.some((b) => b.href === self)) fail(self, `hreflang ${a.hreflang} (${a.href}) does not point back`);
      else if (JSON.stringify([...back].sort((x, y) => x.hreflang.localeCompare(y.hreflang))) !== JSON.stringify([...alts].sort((x, y) => x.hreflang.localeCompare(y.hreflang)))) fail(self, `hreflang set differs from ${a.href}`);
    }
  }
  if (multi) {
    for (const [self, lang] of langOf) {
      const path = self.replace(SITE, '');
      if (ENGLISH_ONLY_PATHS.includes(splitPath(path).path)) continue;
      if (!altsOf.has(self)) fail(self, 'a multi-language site: this page declares no hreflang alternates');
      void lang;
    }
  } else if (altsOf.size) fail('hreflang', 'alternates present although only one language is live');
}

// English (UK) repeats the US text wherever the spelling is the same; that is what hreflang en-GB / en-US is for, so a page and its en-GB twin do not count as duplicates
const distinct = (ps: string[]) => [...new Set(ps.map((p) => p.replace(/^\/en-gb(?=\/|$)/, '') || '/'))];
for (const [t, ps] of titles) if (distinct(ps).length > 1) fail(ps.join(', '), `duplicate title "${t}"`);
for (const [d, ps] of descs) if (distinct(ps).length > 1) fail(ps.join(', '), `duplicate description "${d.slice(0, 50)}…"`);

// sitemap <-> files
const sm = readFileSync(join(dist, 'sitemap.xml'), 'utf8');
const urls = [...sm.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1].replace(SITE, '') || '/');
for (const u of urls) {
  const base = u.replace(/^\//, '').replace(/\/$/, '');
  const ok = u === '/' || base === '' ? existsSync(join(dist, 'index.html')) : existsSync(join(dist, base + '.html')) || existsSync(join(dist, base, 'index.html'));
  if (!ok) fail('sitemap', `${u} has no page`);
}
if (urls.length !== indexable - overlayPages) fail('sitemap', `${urls.length} URLs in the sitemap but ${indexable - overlayPages} indexable pages outside the English (UK) overlay`);

// every tool page URL contains "pdf" (a ranking requirement), and every 301 redirect points at a page that exists
{
  const toolPages = urls.filter((u) => /^\/[a-z0-9-]+$/.test(u) && !['/about', '/chat', '/privacy', '/terms', '/roadmap', '/guides', '/pdf-tools', ...require('../src/content/landingSlugs').LANDING_SLUG_LIST.map((x: string) => '/' + x)].includes(u));
  for (const u of toolPages) if (!u.includes('pdf')) fail('sitemap', `tool URL ${u} does not contain "pdf"`);
  if (toolPages.length < 30) fail('sitemap', `only ${toolPages.length} tool URLs found`);
  if (!existsSync(join(dist, '_redirects'))) fail('_redirects', 'missing: old /tool/<id> URLs would 404');
  else {
    const lines = readFileSync(join(dist, '_redirects'), 'utf8').split('\n').filter((l) => l && !l.startsWith('#'));
    for (const l of lines) {
      const [from, to, code] = l.trim().split(/\s+/);
      if (code !== '301') fail('_redirects', `${l}: not a 301`);
      const t = to.replace(/^\//, '');
      if (!existsSync(join(dist, t + '.html'))) fail('_redirects', `${from} -> ${to}: target page is not in dist`);
      if (from.startsWith('/tool/') && from !== '/tool/*' && existsSync(join(dist, from.slice(1) + '.html'))) fail('_redirects', `${from} is redirected but a page still exists there`);
    }
  }
}

{
  const sp = join(dist, 'seo-pages.json');
  if (!existsSync(sp)) fail('seo-pages.json', 'missing: in-app navigation would not update the page title');
  else {
    const map = JSON.parse(readFileSync(sp, 'utf8')) as Record<string, { title: string; description: string }>;
    for (const u of urls) if (!map[u === '/' ? '/' : u.replace(/\/$/, '')]) fail('seo-pages.json', `${u} is not listed`); // /guides/ is keyed as /guides
  }
}

for (const f of ['robots.txt', 'llms.txt', 'llms-full.txt', 'manifest.webmanifest', 'og.png', 'favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png']) {
  if (!existsSync(join(dist, f))) fail('assets', `${f} missing from dist`);
}
if (!/Sitemap: https:\/\/iduckpdf\.com\/sitemap\.xml/.test(readFileSync(join(dist, 'robots.txt'), 'utf8'))) fail('robots.txt', 'no Sitemap line');

{
  // IndexNow: the key file (<32 hex>.txt) must be in dist and contain its own name, or the pings are rejected
  const keyFiles = readdirSync(dist).filter((f) => /^[0-9a-f]{32}\.txt$/.test(f));
  if (keyFiles.length !== 1) fail('indexnow', `expected exactly one key file in dist, found ${keyFiles.length}`);
  else if (readFileSync(join(dist, keyFiles[0]), 'utf8').trim() !== keyFiles[0].replace('.txt', '')) fail('indexnow', 'the key file does not contain its own name');
}

{
  // security headers: the policy must be written into _headers by the build, with the inline scripts allowed by hash
  const hf = join(dist, '_headers');
  const headers = existsSync(hf) ? readFileSync(hf, 'utf8') : '';
  const csp = headers.split(/\r?\n/).find((l) => /Content-Security-Policy:/i.test(l)) || '';
  if (!csp) fail('_headers', 'no Content-Security-Policy: gen-csp.ts did not run');
  else {
    if (/'unsafe-inline'/.test(csp.split(';').find((d) => d.trim().startsWith('script-src')) || '')) fail('_headers', "script-src must not allow 'unsafe-inline'");
    if (!/'sha256-/.test(csp)) fail('_headers', 'the inline scripts are not allowed by hash');
    if (!/object-src 'none'/.test(csp) || !/frame-ancestors/.test(csp)) fail('_headers', 'object-src or frame-ancestors missing from the policy');
  }
}

// English tool and landing pages: the searched phrase must be in <title> and <h1>, and the length limits are hard failures.
{
  const { TOOL_SLUGS } = require('../src/content/toolSlugs');
  const { LANDINGS } = require('../src/content/landing');
  const { LANDING_SLUG_LIST } = require('../src/content/landingSlugs');
  if (JSON.stringify([...LANDING_SLUG_LIST].sort()) !== JSON.stringify(LANDINGS.map((l: any) => l.slug).sort())) fail('landing', 'src/content/landingSlugs.ts does not match src/content/landing.ts');
  const seenT = new Set<string>();
  const seenD = new Set<string>();
  for (const slug of [...Object.values(TOOL_SLUGS), ...LANDINGS.map((l: any) => l.slug)] as string[]) {
    const pg = pages.find((x) => x.path === '/' + slug);
    if (!pg) { fail('/' + slug, 'page missing'); continue; }
    const t = (one(pg.html, /<title[^>]*>([^<]*)<\/title>/) || '').replace(/&amp;/g, '&');
    const d = (one(pg.html, /<meta[^>]*name="description" content="([^"]*)"/) || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
    const h1 = (one(pg.html, /<h1[^>]*>([\s\S]*?)<\/h1>/) || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
    if (t.length > 60) fail('/' + slug, `title is ${t.length} chars (limit 60): ${t}`);
    if (d.length > 155) fail('/' + slug, `description is ${d.length} chars (limit 155)`);
    if (seenT.has(t)) fail('/' + slug, 'duplicate title'); seenT.add(t);
    if (seenD.has(d)) fail('/' + slug, 'duplicate description'); seenD.add(d);
    if (!h1 || /^\p{Extended_Pictographic}/u.test(h1.trim())) fail('/' + slug, `h1 should lead with the searched phrase, not the friendly name: "${h1}"`);
    if (slug !== 'how-it-works' && !/<ol|Step 1|1\. /.test(pg.html)) warn('/' + slug, 'no visible steps in the raw HTML');
  }
}
console.log(`Audited ${pages.length} pages (${indexable} indexable). Sitemap lists ${urls.length}.`);
if (warns.length) console.log(`\n${warns.length} warning(s):\n  - ${warns.join('\n  - ')}`);
if (fails.length) {
  console.log(`\n${fails.length} FAILURE(S):\n  - ${fails.join('\n  - ')}`);
  process.exit(1);
}
console.log('\nAll SEO checks passed.');
