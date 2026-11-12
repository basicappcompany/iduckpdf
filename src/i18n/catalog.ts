/**
 * Translation catalogs. One JSON file per language (src/i18n/catalogs/<code>.json), so a language is a self-contained file:
 *   ui     English string -> translated string (every label, button and sentence of the app, and every tool option label)
 *   seo    English path -> { title, description } for the fixed pages (title without the " | iDuckPDF" suffix; for "/" the whole title)
 *   homeFaq the questions and answers of the home page
 *   tools  tool id -> translated tool copy (name, short, desc and the SEO block of src/content/toolSeo.ts)
 *   guides guide slug -> translated guide (same shape as src/content/guides.ts)
 *
 * Nothing here imports the catalogs, so English visitors never download a translation. A localized page gets its catalog
 * from /i18n/<code>.js (a script the build puts in the page <head>, which sets window.__I18N before the app starts, so
 * the first paint is already translated). The static renderer and the build scripts read the JSON file directly.
 */
import { DEFAULT_LANG, type Lang } from './locales';

export type Catalog = {
  ui: Record<string, string>;
  seo: Record<string, { title: string; description: string }>;
  tools: Record<string, any>;
  guides: Record<string, any>;
  homeFaq?: { q: string; a: string }[];
  /** [regex over the English message, translated template] for messages the tools build at run time ("Rotated 3 pages."). In the template $1 is a captured group and {p1:one|many} picks by whether group 1 is 1. */
  patterns?: [string, string][];
};

const cache: Partial<Record<Lang, Catalog | null>> = {};

function fromDisk(lang: Lang): Catalog | null {
  try {
    const proc = (globalThis as any).process;
    const fs = proc?.getBuiltinModule?.('fs');
    const path = proc?.getBuiltinModule?.('path');
    if (!fs || !path) return null;
    return JSON.parse(fs.readFileSync(path.join(proc.cwd(), 'src', 'i18n', 'catalogs', `${lang}.json`), 'utf8'));
  } catch {
    return null;
  }
}

export function getCatalog(lang: Lang): Catalog | null {
  if (lang === DEFAULT_LANG) return null;
  if (cache[lang] !== undefined) return cache[lang] ?? null;
  const injected = typeof window !== 'undefined' ? (window as any).__I18N?.[lang] : undefined;
  const c: Catalog | null = injected ?? (typeof window === 'undefined' ? fromDisk(lang) : null);
  if (c) cache[lang] = c; // a miss in the browser is not cached: the script may still be loading
  return c;
}

/** Test hook: install a catalog without a file. */
export function setCatalog(lang: Lang, c: Catalog | null) {
  cache[lang] = c;
  delete compiled[lang];
}

const compiled: Partial<Record<Lang, [RegExp, string][]>> = {};

function viaPattern(lang: Lang, text: string): string | null {
  const c = getCatalog(lang);
  if (!c?.patterns?.length) return null;
  const list = (compiled[lang] ??= c.patterns.map(([re, to]) => [new RegExp(re), to] as [RegExp, string]));
  for (const [re, to] of list) {
    const m = text.match(re);
    if (m) return to.replace(/\{p(\d):([^|}]*)\|([^}]*)\}/g, (_: string, i: string, one: string, many: string) => (m[Number(i)] === '1' ? one : many)).replace(/\$(\d)/g, (_: string, i: string) => m[Number(i)] ?? '');
  }
  return null;
}

/** Translate one English string. Falls back to the English text, so a missing entry never breaks a page. `{name}` placeholders are filled from vars. */
export function translate(lang: Lang, text: string, vars?: Record<string, string | number>): string {
  const out = getCatalog(lang)?.ui[text] ?? viaPattern(lang, text) ?? text;
  return vars ? out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : out;
}
