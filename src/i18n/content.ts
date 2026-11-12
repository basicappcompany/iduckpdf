/** Small content helpers shared by the pages and the build. Tool copy is in toolContent.ts and guides in guideContent.ts so the app only loads what a page needs. */
import { getCatalog } from './catalog';
import type { Lang } from './locales';
import { HOME_FAQ } from '../content/homeFaq';

export function homeFaqFor(lang: Lang): { q: string; a: string }[] {
  return getCatalog(lang)?.homeFaq ?? HOME_FAQ;
}

/** Title and description of a fixed page (About, Roadmap...) in a language, falling back to the English text passed in. */
export function pageSeoFor(lang: Lang, path: string, en: { title: string; description: string }): { title: string; description: string } {
  return getCatalog(lang)?.seo?.[path] ?? en;
}

/** A guide's title and description for a card (the lightweight guide index has no body text). */
export function guideCardFor<T extends { slug: string; title: string; description: string }>(lang: Lang, g: T): T {
  const o = getCatalog(lang)?.guides?.[g.slug];
  return o ? { ...g, title: o.title ?? g.title, description: o.description ?? g.description } : g;
}
