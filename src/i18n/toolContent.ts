/**
 * Translated tool copy. Names, short texts and descriptions of tools live in the catalog's `ui` map (keyed by the English text, like every
 * other label); the longer SEO block (title, description, answer, steps, uses, FAQ) lives in `tools[id]`, overlaid on the English one.
 */
import { getCatalog, translate } from './catalog';
import type { Lang } from './locales';
import { TOOL_SEO, type ToolSeo } from '../content/toolSeo';
import { byId } from '../tools';

export type ToolText = { name: string; short: string; desc: string };

export function toolTextFor(lang: Lang, id: string): ToolText {
  const t = byId(id);
  return { name: translate(lang, t?.name ?? id), short: translate(lang, t?.short ?? ''), desc: translate(lang, t?.desc ?? '') };
}

export function toolSeoFor(lang: Lang, id: string): ToolSeo | undefined {
  const en = TOOL_SEO[id];
  const o = getCatalog(lang)?.tools?.[id];
  return en && o ? { ...en, ...o } : en;
}
