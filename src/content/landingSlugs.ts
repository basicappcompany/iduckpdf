/**
 * The URL slugs of the English-only landing pages in landing.ts. Kept in its own tiny file so the link helper in i18n/locales.ts
 * can know them without pulling the page copy into every bundle. scripts/audit-seo.ts checks this list matches landing.ts.
 */
export const LANDING_SLUG_LIST: string[] = ['how-it-works'];
