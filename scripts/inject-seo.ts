/**
 * Post-build step: writes the real <title>, meta, canonical, Open Graph and JSON-LD into every
 * pre-rendered HTML file in dist/, using the same seoForPath() the app uses.
 * Why not <Head>? The static renderer drops it, and this keeps the output host-independent.
 * Usage: tsx scripts/inject-seo.ts   (runs automatically as part of `npm run export:web`)
 */
import { readdirSync, readFileSync, writeFileSync, statSync, rmSync, copyFileSync, existsSync } from 'fs';
import { join, relative, sep } from 'path';
import { seoForPath, headHtml } from '../src/lib/seoData';
import { localeOf } from '../src/i18n/locales';

const dist = join(__dirname, '..', 'dist');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.html') ? [p] : [];
  });
}

let done = 0;
let hidden = 0;
const pages: Record<string, { title: string; description: string }> = {};
const problems: string[] = [];

for (const file of walk(dist)) {
  const rel = relative(dist, file).split(sep).join('/');
  // Template placeholders produced for dynamic routes: not real pages, drop them.
  if (rel.endsWith('[slug].html')) {
    rmSync(file);
    continue;
  }
  const path = rel === 'index.html' ? '/' : '/' + rel.replace(/\.html$/, '').replace(/\/index$/, '');
  const d = seoForPath(path === '/+not-found' ? '/404' : path);
  let html = readFileSync(file, 'utf8');
  if (html.includes('id="seo-title"')) continue; // already injected
  if (!html.includes('</head>')) {
    problems.push(`${rel}: no </head>`);
    continue;
  }
  html = html.replace('</head>', headHtml(d) + '</head>').replace(/<html lang="[^"]*"/, `<html lang="${localeOf(d.lang).hreflang}"`);
  if (!d.noindex) pages[d.path.length > 1 ? d.path.replace(/\/$/, '') : d.path] = { title: d.title, description: d.description };
  writeFileSync(file, html);
  done++;
  if (d.noindex) hidden++;
}

// Title and description of every indexable page, fetched by the app when someone navigates inside it, so the SEO text is not
// bundled into the JavaScript of every page.
writeFileSync(join(dist, 'seo-pages.json'), JSON.stringify(pages));

// Hosts (Cloudflare Pages, Netlify) serve /404.html with a real 404 status for unknown URLs.
if (existsSync(join(dist, '+not-found.html'))) copyFileSync(join(dist, '+not-found.html'), join(dist, '404.html'));

console.log(`[inject-seo] tags written into ${done} pages (${done - hidden} indexable, ${hidden} noindex)`);
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
