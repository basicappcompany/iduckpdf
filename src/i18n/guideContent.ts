/** Translated guides: the English guide overlaid with the catalog's translated fields. Imports the full guide text, so only the guide page and the build use it. */
import { getCatalog } from './catalog';
import type { Lang } from './locales';
import { GUIDES, guideBySlug, type Guide } from '../content/guides';

export function guideFor(lang: Lang, slug: string): Guide | undefined {
  const en = guideBySlug(slug);
  const o = getCatalog(lang)?.guides?.[slug];
  return en && o ? { ...en, ...o } : en;
}

export const guidesFor = (lang: Lang): Guide[] => GUIDES.map((g) => guideFor(lang, g.slug)!);
