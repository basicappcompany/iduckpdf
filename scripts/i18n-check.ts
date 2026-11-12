/**
 * Checks that every language switched on in src/i18n/locales.ts is fully translated, so no visitor and no search engine ever sees
 * a half-translated page. For each live language it requires:
 *   - every UI string found in the source (`tr('...')`, `translate(lang, '...')`) plus every tool and category name,
 *   - the title, description, answer, steps, uses and FAQ of every tool,
 *   - every guide (title, SEO title, description, intro, sections, FAQ) with the same number of sections and questions as English,
 *   - the home page FAQ and the title/description of every fixed page,
 *   - the same {placeholders} in a translation as in its English source, and the word "PDF" kept as "PDF".
 * Usage: tsx scripts/i18n-check.ts   (part of CI via npm run test:engine)
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { LOCALES, DEFAULT_LANG } from '../src/i18n/locales';
import { READY, TOOLS, CATEGORIES } from '../src/tools';
import { SITE } from '../src/config';
import { GENERIC_FAQ } from '../src/content/genericFaq';
import { EXTRA_STRINGS } from '../src/i18n/extra';
import { TOOL_SEO } from '../src/content/toolSeo';
import { GUIDES } from '../src/content/guides';
import { HOME_FAQ } from '../src/content/homeFaq';

const root = join(__dirname, '..');
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));

/** Every English string the interface can show. */
export function sourceStrings(): Set<string> {
  const out = new Set<string>();
  const re = /\b(?:tr|translate)\(\s*(?:\w+\s*,\s*)?(['"])((?:\\.|(?!\1).)*)\1/g;
  for (const f of walk(join(root, 'src')).filter((p) => /\.tsx?$/.test(p) && !p.includes(join('src', 'i18n', 'catalogs')))) {
    const s = readFileSync(f, 'utf8');
    for (const m of s.matchAll(re)) out.add(m[2].replace(/\\(['"\\])/g, '$1'));
  }
  // the engines return fixed English messages (errors, progress labels, notes); the page translates them when it shows them
  const runtime = /(?:ToolError\(\s*|notes: \[\s*|notes\??\.push\(\s*|progress\([^,()]+,\s*)(['"])((?:\\.|(?!\1).)+)\1/g;
  for (const f of walk(join(root, 'src')).filter((p) => /\.tsx?$/.test(p) && (p.includes(join('src', 'engine')) || p.includes(join('src', 'tools'))))) {
    for (const m of readFileSync(f, 'utf8').matchAll(runtime)) if (m[2].length > 2 && !m[2].includes('${')) out.add(m[2].replace(/\\(['"\\])/g, '$1'));
  }
  // everything a tool shows about itself
  const add = (s?: string) => s && out.add(s);
  for (const t of TOOLS) {
    add(t.name);
    add(t.short);
    add(t.desc);
    add(t.warn);
    add(t.reason);
    add(t.runLabel ?? 'Go');
    t.tips?.forEach(add);
    if (!TOOL_SEO[t.id]) t.faq?.forEach((f) => (add(f.q), add(f.a)));
    t.inputs.forEach((i) => (add(i.label), add(i.hint)));
    t.options?.forEach((o) => {
      add(o.label);
      add(o.hint);
      if ('placeholder' in o) add(o.placeholder);
      if (o.type === 'select') o.options.forEach((x) => add(x.label));
    });
  }
  for (const c of CATEGORIES) (add(c.name), add(c.blurb));
  for (const f of GENERIC_FAQ) (add(f.q), add(f.a));
  EXTRA_STRINGS.forEach(add);
  add(SITE.description);
  return out;
}

const FIXED_PAGES = ['/', '/pdf-tools', '/guides', '/about', '/roadmap', '/chat'];
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

export function problemsFor(lang: string, cat: any): string[] {
  const bad: string[] = [];
  const need = (cond: boolean, msg: string) => {
    if (!cond) bad.push(msg);
  };
  const str = (v: any) => typeof v === 'string' && v.trim().length > 0;

  for (const key of sourceStrings()) {
    const v = cat.ui?.[key];
    if (!str(v)) bad.push(`ui: missing "${key}"`);
    else {
      if (placeholders(v) !== placeholders(key)) bad.push(`ui: placeholders differ in "${key}"`);
      if (key !== 'PDF' && /\bPDF\b/.test(key) && !/PDF/.test(v)) bad.push(`ui: "PDF" is not kept in the translation of "${key}"`);
    }
  }
  for (const p of FIXED_PAGES) need(str(cat.seo?.[p]?.title) && str(cat.seo?.[p]?.description), `seo: ${p} needs a title and a description`);
  need(Array.isArray(cat.homeFaq) && cat.homeFaq.length === HOME_FAQ.length && cat.homeFaq.every((f: any) => str(f.q) && str(f.a)), `homeFaq: needs ${HOME_FAQ.length} complete questions`);

  for (const t of READY) {
    const en = TOOL_SEO[t.id];
    const o = cat.tools?.[t.id];
    if (!o) {
      bad.push(`tools: ${t.id} missing`);
      continue;
    }
    for (const k of ['title', 'description', 'answer']) need(str(o[k]), `tools.${t.id}.${k} missing`);
    for (const k of ['steps', 'uses'] as const) need(Array.isArray(o[k]) && o[k].length === en[k].length && o[k].every(str), `tools.${t.id}.${k}: needs ${en[k].length} entries`);
    need(Array.isArray(o.faq) && o.faq.length === en.faq.length && o.faq.every((f: any) => str(f.q) && str(f.a)), `tools.${t.id}.faq: needs ${en.faq.length} complete questions`);
    if (str(o.title) && o.title.length > 59) bad.push(`tools.${t.id}.title is ${o.title.length} characters (limit 59 so the full title stays under 70)`);
    if (str(o.description) && (o.description.length < 60 || o.description.length > 165)) bad.push(`tools.${t.id}.description is ${o.description.length} characters (60 to 165)`);
  }
  for (const g of GUIDES) {
    const o = cat.guides?.[g.slug];
    if (!o) {
      bad.push(`guides: ${g.slug} missing`);
      continue;
    }
    for (const k of ['title', 'seoTitle', 'description', 'intro']) need(str(o[k]), `guides.${g.slug}.${k} missing`);
    need(Array.isArray(o.sections) && o.sections.length === g.sections.length && o.sections.every((s: any, i: number) => str(s.h) && Array.isArray(s.p) && s.p.length === g.sections[i].p.length && s.p.every(str)), `guides.${g.slug}.sections: must mirror the English structure`);
    need(Array.isArray(o.faq) && o.faq.length === g.faq.length && o.faq.every((f: any) => str(f.q) && str(f.a)), `guides.${g.slug}.faq: needs ${g.faq.length} complete questions`);
    if (str(o.seoTitle) && o.seoTitle.length > 59) bad.push(`guides.${g.slug}.seoTitle is ${o.seoTitle.length} characters (limit 59)`);
    if (str(o.description) && (o.description.length < 60 || o.description.length > 165)) bad.push(`guides.${g.slug}.description is ${o.description.length} characters (60 to 165)`);
  }
  return bad.map((b) => `${lang}: ${b}`);
}

if (require.main === module) {
  let failures = 0;
  const live = LOCALES.filter((l) => l.live && l.code !== DEFAULT_LANG);
  for (const l of live) {
    const file = join(root, 'src', 'i18n', 'catalogs', `${l.code}.json`);
    if (!existsSync(file)) {
      console.log(`FAIL  ${l.code}: live but ${file} is missing`);
      failures++;
      continue;
    }
    const bad = problemsFor(l.code, JSON.parse(readFileSync(file, 'utf8')));
    if (bad.length) {
      failures += bad.length;
      console.log(`FAIL  ${l.code}: ${bad.length} problem(s)\n  - ${bad.slice(0, 40).join('\n  - ')}${bad.length > 40 ? `\n  … and ${bad.length - 40} more` : ''}`);
    } else console.log(`PASS  ${l.code}: complete (${Object.keys(JSON.parse(readFileSync(file, 'utf8')).ui).length} UI strings, ${READY.length} tools, ${GUIDES.length} guides)`);
  }
  // a catalog file for a language that is not live is fine (work in progress), but say so
  for (const l of LOCALES) if (!l.live && l.code !== DEFAULT_LANG && existsSync(join(root, 'src', 'i18n', 'catalogs', `${l.code}.json`))) console.log(`note  ${l.code}: catalog exists but the language is not live yet`);
  console.log(live.length ? `\n${failures ? failures + ' problem(s)' : 'All live languages are complete.'}` : 'No language besides English is live yet; nothing to check.');
  if (failures) process.exit(1);
}
