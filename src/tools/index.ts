import { CATEGORIES, type CategoryId, type ToolDef, type ToolCtx, type ToolResult } from '../engine/types';
import meta from './meta.generated.json';
import { getCatalog, translate } from '../i18n/catalog';
import { DEFAULT_LANG, localeOf, type Lang } from '../i18n/locales';

export { CATEGORIES };
export type { CategoryId, ToolDef };

/** Light metadata for every tool (no run code). Generated from ./all.ts by scripts/gen-tool-meta.ts. */
export const TOOLS = meta as unknown as ToolDef[];

type Runner = (ctx: ToolCtx) => Promise<ToolResult>;
let enginePromise: Promise<typeof import('./all')> | null = null;

/** Starts downloading the PDF engine and the tool code. Safe to call many times; call it early (idle) to make the first run instant. */
export function preloadEngine(): Promise<typeof import('./all')> {
  if (!enginePromise) {
    enginePromise = import('./all').catch((e) => {
      enginePromise = null; // allow a retry after a network hiccup
      throw e;
    });
  }
  return enginePromise;
}

/** The run() function for a tool, loading the engine on first use. */
export async function loadRunner(id: string): Promise<Runner | undefined> {
  const { ALL_TOOLS } = await preloadEngine();
  return ALL_TOOLS.find((t) => t.id === id)?.run;
}

export const READY = TOOLS.filter((t) => t.status === 'ready');
export const SOON = TOOLS.filter((t) => t.status === 'soon');

export const byId = (id: string) => TOOLS.find((t) => t.id === id);
export const inCategory = (c: CategoryId) => TOOLS.filter((t) => t.category === c);
/** Categories that actually contain tools (the roadmap category is empty once everything announced is built). */
export const VISIBLE_CATEGORIES = CATEGORIES.filter((c) => inCategory(c.id).length > 0);
export const categoryName = (c: CategoryId) => CATEGORIES.find((x) => x.id === c)?.name || '';

const STOP = new Set('pdf pdfs page pages file files two need want the and how can make into with this that you your one some please like would could should have help get from for all just'.split(' '));

/** Score how well free text matches a tool. Used by the helper and the command palette. */
export function scoreTool(t: ToolDef, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const name = t.name.toLowerCase();
  if (name.startsWith(q)) return 100;
  if (name.includes(q)) return 70;
  const words = q.split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !STOP.has(w));
  if (!words.length) return 0;
  let s = 0;
  const nameWords = name.split(/[^a-z0-9]+/);
  const kw = t.keywords.map((k) => k.toLowerCase());
  for (const w of words) {
    if (kw.some((k) => k === w || k.split(' ').includes(w))) s += 4;
    else if (nameWords.some((n) => n.startsWith(w))) s += 3;
    else if (kw.some((k) => k.length > 3 && (k.startsWith(w) || (w.length > 3 && w.startsWith(k))))) s += 2;
    else if ((t.short + ' ' + t.desc).toLowerCase().includes(w)) s += 1;
  }
  return s;
}

/** Lower-case and strip accents, so "última" matches "ultima" and "Zusammenführen" matches "zusammenfuhren". */
export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const SPLIT = /[^\p{L}\p{M}\p{N}]+/u;
const wordsOf = (s: string) => fold(s).split(SPLIT).filter((w) => w.length > 1);

/** What each tool is called and described as in a language, built once from the catalog (the same text the page shows), so people can search and ask in their own language. */
type LangIndex = { name: Map<string, string>; text: Map<string, Set<string>>; common: Set<string> };
const indexes: Partial<Record<Lang, LangIndex>> = {};
function indexFor(lang: Lang): LangIndex | null {
  if (lang === DEFAULT_LANG || localeOf(lang).overlay) return null;
  if (indexes[lang]) return indexes[lang]!;
  if (!getCatalog(lang)) return null; // the catalog script may still be loading: try again next time
  const name = new Map<string, string>();
  const text = new Map<string, Set<string>>();
  const df = new Map<string, number>();
  for (const t of TOOLS) {
    const n = translate(lang, t.name);
    name.set(t.id, fold(n));
    const set = new Set(wordsOf(`${n} ${translate(lang, t.short)} ${translate(lang, t.desc)}`));
    text.set(t.id, set);
    for (const w of set) df.set(w, (df.get(w) ?? 0) + 1);
  }
  // words that appear in the text of many tools ("pdf", "de", "для") say nothing about which tool is meant; this works in any language without a stop-word list
  const common = new Set([...df].filter(([, n]) => n > 7).map(([w]) => w));
  return (indexes[lang] = { name, text, common });
}

function scoreInLang(t: ToolDef, query: string, ix: LangIndex): number {
  const f = fold(query.trim());
  if (!f) return 0;
  const name = ix.name.get(t.id) ?? '';
  if (name.startsWith(f)) return 100;
  if (name.includes(f)) return 70;
  const set = ix.text.get(t.id) ?? new Set<string>();
  const nameWords = name.split(SPLIT).filter(Boolean);
  const stem = (a: string, b: string) => {
    const n = /[ऀ-৿]/.test(a) ? 3 : 4; // Hindi and Bengali words are shorter in letters
    return a.length >= n && b.length >= n && a.slice(0, n) === b.slice(0, n);
  };
  let s = 0;
  for (const w of wordsOf(query).filter((x) => !ix.common.has(x))) {
    if (nameWords.includes(w)) s += 4;
    else if (nameWords.some((n) => n.startsWith(w) || stem(n, w))) s += 3;
    else if (set.has(w)) s += 2;
    else if ([...set].some((x) => stem(x, w) || (w.length >= 5 && x.includes(w)))) s += 1.5; // a shared stem, or the word inside a longer one (kompres / mengompres)
  }
  return s;
}

/** English keywords still count in every language ("rotate", "ocr"), on top of what the tool is called in the visitor's language. */
function scoreFor(t: ToolDef, query: string, lang: Lang): number {
  const en = scoreTool(t, query);
  const ix = indexFor(lang);
  return ix ? Math.max(en, scoreInLang(t, query, ix) + (en < 70 ? en : 0)) : en;
}

export function searchTools(query: string, limit = 50, lang: Lang = DEFAULT_LANG): ToolDef[] {
  return TOOLS.map((t) => ({ t, s: scoreFor(t, query, lang) + (t.status === 'ready' ? 0.5 : 0) }))
    .filter((x) => x.s > (query.trim() ? 0.5 : 0))
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.t);
}

export function bestMatch(text: string, lang: Lang = DEFAULT_LANG): ToolDef | null {
  let best: ToolDef | null = null;
  let top = 0;
  for (const t of TOOLS) {
    const s = scoreFor(t, text, lang);
    if (s > top) {
      top = s;
      best = t;
    }
  }
  return top >= (lang === DEFAULT_LANG ? 2 : 1.5) ? best : null;
}
