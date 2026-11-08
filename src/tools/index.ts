import { CATEGORIES, type CategoryId, type ToolDef, type ToolCtx, type ToolResult } from '../engine/types';
import meta from './meta.generated.json';

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

export function searchTools(query: string, limit = 50): ToolDef[] {
  return TOOLS.map((t) => ({ t, s: scoreTool(t, query) + (t.status === 'ready' ? 0.5 : 0) }))
    .filter((x) => x.s > (query.trim() ? 0.5 : 0))
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.t);
}

export function bestMatch(text: string): ToolDef | null {
  let best: ToolDef | null = null;
  let top = 0;
  for (const t of TOOLS) {
    const s = scoreTool(t, text);
    if (s > top) {
      top = s;
      best = t;
    }
  }
  return top >= 2 ? best : null;
}
