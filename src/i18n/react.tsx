import { useCallback } from 'react';
import { usePathname } from 'expo-router';
import { translate } from './catalog';
import { splitPath, localizeLink, type Lang } from './locales';

/** The language and the unprefixed path of the page being shown, taken from the address. */
export function useLocation(): { lang: Lang; path: string } {
  return splitPath(usePathname());
}

export const useLang = (): Lang => useLocation().lang;

/** `const tr = useT();  tr('Merge PDF')`. English text in, the page's language out. */
export function useT() {
  const lang = useLang();
  return useCallback((text: string, vars?: Record<string, string | number>) => translate(lang, text, vars), [lang]);
}

/** Prefixes an internal path with the page's language: `const href = useHref(); href('/about')`. */
export function useHref() {
  const lang = useLang();
  return useCallback((to: string) => localizeLink(to, lang), [lang]);
}
