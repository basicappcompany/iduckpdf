import { LANDING_SLUG_LIST } from '../content/landingSlugs';
/**
 * The languages iDuckPDF is offered in. Pure data and path helpers, no React, so it runs in the app, in the build scripts and in tests.
 * English lives at the root (/merge-pdf); every other language lives under its own prefix (/es/merge-pdf).
 * A language is switched on (`live: true`) only when its catalog in src/i18n/catalogs/<code>.json covers the whole site, so
 * visitors and search engines never see a half-translated page. scripts/i18n-check.ts enforces that.
 */
export type Lang = 'en' | 'en-gb' | 'bn' | 'de' | 'es' | 'fr' | 'hi' | 'id' | 'pt-br' | 'ru' | 'tr';

export type Locale = {
  code: Lang;
  name: string; // English name
  native: string; // the language's own name, shown in the switcher
  hreflang: string; // BCP 47 tag for <link rel="alternate" hreflang> and <html lang>
  og: string; // Open Graph locale
  live: boolean;
  flag: string; // ISO 3166 country code of the flag shown next to the name in the switcher (see ui/Flag.tsx)
  short: string; // the short label on the switcher button
  overlay?: boolean; // a variant of English (en-GB): its catalog holds only the strings that differ, so it is exempt from the completeness check
};

export const DEFAULT_LANG: Lang = 'en';

export const LOCALES: Locale[] = [
  { code: 'en', name: 'English (US)', native: 'English (US)', hreflang: 'en-US', og: 'en_US', live: true, flag: 'us', short: 'EN-US' },
  { code: 'en-gb', name: 'English (UK)', native: 'English (UK)', hreflang: 'en-GB', og: 'en_GB', live: true, flag: 'gb', short: 'EN-GB', overlay: true },
  { code: 'bn', name: 'Bengali', native: 'বাংলা', hreflang: 'bn', og: 'bn_BD', live: true, flag: 'bd', short: 'BN' },
  { code: 'de', name: 'German', native: 'Deutsch', hreflang: 'de', og: 'de_DE', live: true, flag: 'de', short: 'DE' },
  { code: 'es', name: 'Spanish', native: 'Español', hreflang: 'es', og: 'es_ES', live: true, flag: 'es', short: 'ES' },
  { code: 'fr', name: 'French', native: 'Français', hreflang: 'fr', og: 'fr_FR', live: true, flag: 'fr', short: 'FR' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', hreflang: 'hi', og: 'hi_IN', live: true, flag: 'in', short: 'HI' },
  { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia', hreflang: 'id', og: 'id_ID', live: true, flag: 'id', short: 'ID' },
  { code: 'pt-br', name: 'Portuguese (Brazil)', native: 'Português (Brasil)', hreflang: 'pt-BR', og: 'pt_BR', live: true, flag: 'br', short: 'PT-BR' },
  { code: 'ru', name: 'Russian', native: 'Русский', hreflang: 'ru', og: 'ru_RU', live: true, flag: 'ru', short: 'RU' },
  { code: 'tr', name: 'Turkish', native: 'Türkçe', hreflang: 'tr', og: 'tr_TR', live: true, flag: 'tr', short: 'TR' },
];

export const localeOf = (lang: Lang): Locale => LOCALES.find((l) => l.code === lang) ?? LOCALES[0];
export const isLang = (s: string): s is Lang => LOCALES.some((l) => l.code === s);
export const liveLocales = (): Locale[] => LOCALES.filter((l) => l.live);
export const isLive = (lang: Lang) => localeOf(lang).live;

/** Legal pages stay in English. Under /<lang>/ they keep the translated page chrome and point their canonical at the English page. */
export const ENGLISH_ONLY_PATHS = ['/privacy', '/terms', ...LANDING_SLUG_LIST.map((s) => '/' + s)];

/** '/es/merge-pdf' -> { lang: 'es', path: '/merge-pdf' };  '/merge-pdf' -> { lang: 'en', path: '/merge-pdf' };  '/es' -> { lang: 'es', path: '/' } */
export function splitPath(raw: string): { lang: Lang; path: string } {
  const clean = raw.split(/[?#]/)[0];
  const norm = clean.length > 1 ? clean.replace(/\/+$/, '') : clean || '/';
  const m = norm.match(/^\/([^/]+)(\/.*)?$/);
  if (m && m[1] !== DEFAULT_LANG && isLang(m[1])) return { lang: m[1], path: m[2] || '/' };
  return { lang: DEFAULT_LANG, path: norm };
}

/** '/merge-pdf' + 'es' -> '/es/merge-pdf';  '/' + 'es' -> '/es/' (the language home is a folder, so it keeps its slash). English is unchanged. */
export function localePath(path: string, lang: Lang): string {
  if (lang === DEFAULT_LANG) return path || '/';
  if (!path || path === '/') return `/${lang}/`;
  return `/${lang}${path.startsWith('/') ? path : '/' + path}`;
}

/** Internal links only: leaves external URLs, mailto:, #anchors and already-prefixed paths alone. */
export function localizeLink(to: string, lang: Lang): string {
  if (lang === DEFAULT_LANG || !to.startsWith('/') || to.startsWith('//')) return to;
  if (LANDING_SLUG_LIST.includes(to.slice(1).split(/[?#/]/)[0])) return to; // English-only landing pages have no language versions
  if (splitPath(to).lang !== DEFAULT_LANG) return to;
  return localePath(to, lang);
}
