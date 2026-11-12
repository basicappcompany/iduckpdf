import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useLang } from '../i18n/react';
import { localePath } from '../i18n/locales';

/**
 * Keeps the browser tab title and the head tags in step with the page while people click around.
 * The real tags for crawlers (and for the first page a visitor opens) are written into each HTML file at build time
 * (scripts/inject-seo.ts) from seoForPath(), so what a crawler sees and what this sets always agree.
 *
 * Because the first page is already correct, nothing is fetched for it. When someone navigates to another page inside the app,
 * the title and description come from /seo-pages.json, a small file the build writes next to the pages, so none of the SEO text
 * is part of the JavaScript bundle.
 */
let firstPage = true;
let pages: Promise<Record<string, { title: string; description: string }>> | null = null;
type PageMap = Record<string, { title: string; description: string }>;
const loadPages = (): Promise<PageMap> => (pages ??= fetch('/seo-pages.json').then((r): Promise<PageMap> => (r.ok ? r.json() : Promise.resolve({}))).catch((): PageMap => ({})));

export function Seo({ path: englishPath }: { path: string }) {
  const lang = useLang();
  const path = localePath(englishPath, lang); // pages pass their English path; the address that matters is the localized one
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (firstPage) {
      firstPage = false;
      return;
    }
    let cancelled = false;
    loadPages().then((all) => {
      const d = all[path.length > 1 ? path.replace(/\/$/, '') : path];
      if (cancelled || !d) return;
      document.title = d.title;
      const set = (id: string, attr: string, value: string) => document.getElementById(id)?.setAttribute(attr, value);
      set('seo-desc', 'content', d.description);
      set('seo-og-title', 'content', d.title);
      set('seo-og-desc', 'content', d.description);
      set('seo-og-url', 'content', location.origin + path);
      set('seo-canonical', 'href', location.origin + path);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);
  return null;
}
