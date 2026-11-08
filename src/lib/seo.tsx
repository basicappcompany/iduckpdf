import { useEffect } from 'react';
import { Platform } from 'react-native';
import { seoForPath } from './seoData';

/**
 * Keeps the browser tab title and the head tags in step with the page while people click around.
 * The real tags for crawlers are written into each HTML file at build time (scripts/inject-seo.ts)
 * from the same seoForPath(), so what a crawler sees and what this sets always agree.
 */
export function Seo({ path }: { path: string }) {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const d = seoForPath(path);
    document.title = d.title;
    const set = (id: string, attr: string, value: string) => document.getElementById(id)?.setAttribute(attr, value);
    set('seo-desc', 'content', d.description);
    set('seo-og-title', 'content', d.title);
    set('seo-og-desc', 'content', d.description);
    set('seo-og-url', 'content', location.origin + d.path);
    set('seo-canonical', 'href', location.origin + d.path);
  }, [path]);
  return null;
}
