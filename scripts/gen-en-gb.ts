/**
 * Builds the English (UK) catalog (src/i18n/catalogs/en-gb.json): the site's English with British spelling (colour, organise, centre...).
 * The catalog holds only what differs from the US text; everything else falls back to English. `npm run i18n:gb` rewrites the file, and
 * i18n-check fails when the committed file is out of date, so new English copy gets its British spelling too.
 * Usage: tsx scripts/gen-en-gb.ts
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { sourceStrings } from './i18n-check';
import { TOOL_SEO } from '../src/content/toolSeo';
import { GUIDES } from '../src/content/guides';
import { HOME_FAQ } from '../src/content/homeFaq';
import { seoForPath } from '../src/lib/seoData';

const FILE = join(__dirname, '..', 'src', 'i18n', 'catalogs', 'en-gb.json');

// US -> UK. Each rule is a whole word (any case; the first letter's case is kept).
const WORDS: [RegExp, string][] = [
  [/\b(colou?r)(s|ed|ing|ful|less)?\b/gi, 'colour$2'],
  [/\b(gr[ae]y)(scale)?\b/gi, 'grey$2'],
  [/\bcenter(s|ed|ing)?\b/gi, 'centre$1'],
  [/\bbehavior(s)?\b/gi, 'behaviour$1'],
  [/\bfavorite(s)?\b/gi, 'favourite$1'],
  [/\bflavor(s)?\b/gi, 'flavour$1'],
  [/\bhonor(s|ed)?\b/gi, 'honour$1'],
  [/\bneighbor(s)?\b/gi, 'neighbour$1'],
  [/\bdefense\b/gi, 'defence'],
  [/\boffense\b/gi, 'offence'],
  [/\bfulfill(s|ed|ing)?\b/gi, 'fulfil$1'],
  [/\bcancel(ed|ing)\b/gi, 'cancell$1'],
  [/\blabel(ed|ing)\b/gi, 'labell$1'],
  [/\btravel(ed|er|ers|ing)\b/gi, 'travell$1'],
  [/\bmodel(ed|ing)\b/gi, 'modell$1'],
  [/\bjudgment(s)?\b/gi, 'judgement$1'],
  [/\bcatalog(s)?\b/gi, 'catalogue$1'],
  [/\bartifact(s)?\b/gi, 'artefact$1'],
  [/\bgray\b/gi, 'grey'],
];
// -ize / -yze / -ization words, except the ones that are spelled that way in British English too
const KEEP_Z = /^(re)?siz|^priz|^seiz|^capsiz|^baptiz|^bronz|^citiz|^gaz|^maz|^doz|^froz|^glaz|^blaz|^craz|^lazi|^wiz|^quiz|^topaz|^adz|^coz|^razz/i;
const ISE = /\b([a-z]{3,}?)(iz|yz)(e|es|ed|ing|er|ers|ation|ations)\b/gi;

const keepCase = (from: string, to: string) => (from[0] === from[0].toUpperCase() && from[0] !== from[0].toLowerCase() ? to[0].toUpperCase() + to.slice(1) : to);

export function ukify(s: string): string {
  let out = s;
  for (const [re, to] of WORDS) out = out.replace(re, (m, ...g) => keepCase(m, to.replace(/\$(\d)/g, (_, i) => g[Number(i) - 1] ?? '')));
  out = out.replace(ISE, (m, stem: string, z: string, end: string) => (KEEP_Z.test(stem + z) ? m : keepCase(m, stem + (z === 'iz' ? 'is' : 'ys') + end)));
  // "organization" style words that the rule above splits differently ("organiz" + "ation")
  return out;
}

const changed = (a: string, b: string) => a !== b;

export function build() {
  const ui: Record<string, string> = {};
  for (const k of sourceStrings()) {
    const u = ukify(k);
    if (changed(k, u)) ui[k] = u;
  }
  const tools: Record<string, any> = {};
  for (const [id, s] of Object.entries(TOOL_SEO)) {
    const o: Record<string, any> = {};
    for (const k of ['title', 'description', 'answer'] as const) if (changed(s[k], ukify(s[k]))) o[k] = ukify(s[k]);
    for (const k of ['steps', 'uses'] as const) if (s[k].some((x) => changed(x, ukify(x)))) o[k] = s[k].map(ukify);
    if (s.faq.some((f) => changed(f.q + f.a, ukify(f.q) + ukify(f.a)))) o.faq = s.faq.map((f) => ({ q: ukify(f.q), a: ukify(f.a) }));
    if (Object.keys(o).length) tools[id] = o;
  }
  const guides: Record<string, any> = {};
  for (const g of GUIDES) {
    const o: Record<string, any> = {};
    for (const k of ['title', 'seoTitle', 'description', 'intro'] as const) if (changed(g[k], ukify(g[k]))) o[k] = ukify(g[k]);
    if (g.sections.some((s) => changed(s.h + s.p.join(''), ukify(s.h) + s.p.map(ukify).join('')))) o.sections = g.sections.map((s) => ({ h: ukify(s.h), p: s.p.map(ukify) }));
    if (g.faq.some((f) => changed(f.q + f.a, ukify(f.q) + ukify(f.a)))) o.faq = g.faq.map((f) => ({ q: ukify(f.q), a: ukify(f.a) }));
    if (Object.keys(o).length) guides[g.slug] = o;
  }
  const seo: Record<string, { title: string; description: string }> = {};
  for (const p of ['/', '/pdf-tools', '/guides', '/about', '/roadmap', '/chat']) {
    const s = seoForPath(p);
    const title = s.title.replace(/ \| iDuckPDF$/, '');
    if (changed(title + s.description, ukify(title) + ukify(s.description))) seo[p] = { title: ukify(title), description: ukify(s.description) };
  }
  const out: Record<string, any> = { ui, seo, tools, guides };
  if (HOME_FAQ.some((f) => changed(f.q + f.a, ukify(f.q) + ukify(f.a)))) out.homeFaq = HOME_FAQ.map((f) => ({ q: ukify(f.q), a: ukify(f.a) }));
  return out;
}

if (require.main === module) {
  const json = JSON.stringify(build(), null, 1) + '\n';
  if (process.argv.includes('--check')) {
    let have = '';
    try {
      have = readFileSync(FILE, 'utf8');
    } catch {}
    if (have.replace(/\r\n/g, '\n') !== json) {
      console.log('FAIL  en-gb: src/i18n/catalogs/en-gb.json is out of date. Run: npm run i18n:gb');
      process.exit(1);
    }
    console.log('PASS  en-gb: British spelling catalog is up to date');
  } else {
    writeFileSync(FILE, json);
    const c = JSON.parse(json);
    console.log(`wrote en-gb.json: ${Object.keys(c.ui).length} ui strings, ${Object.keys(c.tools).length} tools, ${Object.keys(c.guides).length} guides changed`);
  }
}
