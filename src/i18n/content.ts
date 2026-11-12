/**
 * Translated versions of the structured content (tool copy and guides). Each helper returns the English object when a language has
 * no entry, and otherwise the English object overlaid with the translated fields, so a translator only has to supply what changes.
 */
import { getCatalog, translate } from './catalog';
import type { Lang } from './locales';
import { TOOL_SEO, type ToolSeo } from '../content/toolSeo';
import { GUIDES, guideBySlug, type Guide } from '../content/guides';
import { HOME_FAQ } from '../content/homeFaq';
import { byId } from '../tools';

export type ToolText = { name: string; short: string; desc: string };

export function toolTextFor(lang: Lang, id: string): ToolText {
  const t = byId(id);
  const o = getCatalog(lang)?.tools?.[id];
  return { name: o?.name ?? t?.name ?? id, short: o?.short ?? t?.short ?? '', desc: o?.desc ?? t?.desc ?? '' };
}

export function toolSeoFor(lang: Lang, id: string): ToolSeo | undefined {
  const en = TOOL_SEO[id];
  const o = getCatalog(lang)?.tools?.[id];
  return en && o ? { ...en, ...o } : en;
}

export function guideFor(lang: Lang, slug: string): Guide | undefined {
  const en = guideBySlug(slug);
  const o = getCatalog(lang)?.guides?.[slug];
  return en && o ? { ...en, ...o } : en;
}

export const guidesFor = (lang: Lang): Guide[] => GUIDES.map((g) => guideFor(lang, g.slug)!);

export function homeFaqFor(lang: Lang): { q: string; a: string }[] {
  return getCatalog(lang)?.homeFaq ?? HOME_FAQ;
}

/** Title and description of a fixed page (About, Roadmap...) in a language, falling back to the English text passed in. */
export function pageSeoFor(lang: Lang, path: string, en: { title: string; description: string }): { title: string; description: string } {
  return getCatalog(lang)?.seo?.[path] ?? en;
}

export { translate };
