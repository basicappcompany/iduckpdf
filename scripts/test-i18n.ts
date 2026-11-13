/**
 * Tests for the localization layer: path helpers, translation fallback, the per-language SEO tags (canonical, hreflang, og:locale,
 * inLanguage), the English-only legal pages, and the completeness checker. A throw-away Spanish catalog is installed in memory,
 * so nothing here depends on a real translation existing.
 * Run:  npx tsx scripts/test-i18n.ts
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { DEFAULT_LANG, LOCALES, ENGLISH_ONLY_PATHS, isLang, localeOf, localePath, localizeLink, splitPath } from '../src/i18n/locales';
import { setCatalog, translate, type Catalog } from '../src/i18n/catalog';
import { abs, headHtml, seoForPath } from '../src/lib/seoData';
import { problemsFor, sourceStrings } from './i18n-check';
import { ukify } from './gen-en-gb';
import { parsePages } from '../src/engine/util';
import { READY } from '../src/tools';
import { TOOL_SEO } from '../src/content/toolSeo';
import { GUIDES } from '../src/content/guides';
import { HOME_FAQ } from '../src/content/homeFaq';
import { toolPath } from '../src/content/toolSlugs';
import { bestMatch, searchTools } from '../src/tools';
import { intentOf } from '../src/i18n/intent';

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, extra = '') {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra && !ok ? '  (' + extra + ')' : ''}`);
}

/* ---- locales ---- */
check('eleven locales (English US and UK plus nine languages), English first, codes unique', LOCALES.length === 11 && LOCALES[0].code === 'en' && new Set(LOCALES.map((l) => l.code)).size === 11);
check('every locale has a flag with a drawing in Flag.tsx and a short label', LOCALES.every((l) => l.flag.length === 2 && l.short.length >= 2) && LOCALES.every((l) => new RegExp(`\\b${l.flag}:`).test(readFileSync(join(__dirname, '..', 'src', 'ui', 'Flag.tsx'), 'utf8'))));
check('English (UK) is en-GB, an overlay of English', localeOf('en-gb').hreflang === 'en-GB' && localeOf('en-gb').overlay === true && localeOf('en').hreflang === 'en-US' && splitPath('/en-gb/merge-pdf').lang === 'en-gb');
check('the nine target languages are the leaflockpdf list', ['bn', 'de', 'es', 'fr', 'hi', 'id', 'pt-br', 'ru', 'tr'].every(isLang));
check('Brazilian Portuguese is hreflang pt-BR with an og locale', localeOf('pt-br').hreflang === 'pt-BR' && localeOf('pt-br').og === 'pt_BR');
check('a language is live only when its catalog file exists', LOCALES.filter((l) => l.live && l.code !== 'en').every((l) => existsSync(join(__dirname, '..', 'src', 'i18n', 'catalogs', l.code + '.json'))));
// the SEO tests below describe a site where only English is live, whatever the real languages are; the real state is put back at the end
const realLive = LOCALES.map((l) => l.live);
LOCALES.forEach((l) => { if (l.code !== 'en') l.live = false; });

check('splitPath: English path stays English', JSON.stringify(splitPath('/merge-pdf')) === '{"lang":"en","path":"/merge-pdf"}');
check('splitPath: /es/merge-pdf', JSON.stringify(splitPath('/es/merge-pdf')) === '{"lang":"es","path":"/merge-pdf"}');
check('splitPath: language home, with and without slash', splitPath('/es').path === '/' && splitPath('/es/').lang === 'es' && splitPath('/pt-br/guides/').path === '/guides');
check('splitPath: a tool slug that merely starts with a language code is not a language', splitPath('/es-pdf').lang === 'en' && splitPath('/de-something').lang === 'en');
check('splitPath: ignores query and hash', splitPath('/es/pdf-tools?q=a#x').path === '/pdf-tools');
check('localePath', localePath('/merge-pdf', 'es') === '/es/merge-pdf' && localePath('/', 'es') === '/es/' && localePath('/merge-pdf', 'en') === '/merge-pdf' && localePath('/', 'en') === '/');
check('localizeLink prefixes internal paths only', localizeLink('/about', 'de') === '/de/about' && localizeLink('https://x.com/a', 'de') === 'https://x.com/a' && localizeLink('mailto:a@b.c', 'de') === 'mailto:a@b.c' && localizeLink('/de/about', 'de') === '/de/about' && localizeLink('/about', 'en') === '/about');

/* ---- translate ---- */
const spanish = (): Catalog => ({
  ui: { Home: 'Inicio', 'How to use {name}': 'Cómo usar {name}', 'Merge PDFs': 'Unir PDF' },
  seo: { '/': { title: 'iDuckPDF: herramientas PDF gratis en tu navegador', description: 'Une, divide, comprime y edita PDF gratis en tu navegador, sin registrarte y sin marcas de agua. Tus archivos no salen de tu dispositivo.' } },
  tools: { merge: { name: 'Unir PDF', title: 'Unir archivos PDF gratis', description: 'Combina varios PDF en un solo archivo desde tu navegador. Ordénalos con las flechas, sin registro y sin marca de agua en cualquier dispositivo.', answer: 'Añade dos o más archivos, ordénalos y pulsa Unir.', steps: ['Añade tus PDF.', 'Ordénalos.', 'Pulsa Unir.'], uses: ['Unir contratos'], faq: [{ q: '¿Cuántos PDF puedo unir?', a: 'Tantos como permita tu dispositivo.' }] } },
  guides: {},
  homeFaq: [{ q: '¿Es gratis?', a: 'Sí.' }],
});
setCatalog('es', spanish());
const es = localeOf('es');
check('translate: known string, missing string, placeholder, English', translate('es', 'Home') === 'Inicio' && translate('es', 'Unknown text') === 'Unknown text' && translate('es', 'How to use {name}', { name: 'X' }) === 'Cómo usar X' && translate('en', 'Home') === 'Home');

// run-time messages built by the tools ("Rotated 3 pages.") are translated by pattern, with singular and plural forms
setCatalog('es', { ...spanish(), patterns: [['^Rotated (\\d+) pages?\\.$', '{p1:Página girada|Páginas giradas}: $1.'], ['^Page (\\d+) of (\\d+)$', 'Página $1 de $2']] });
check('patterns: plural and singular forms', translate('es', 'Rotated 3 pages.') === 'Páginas giradas: 3.' && translate('es', 'Rotated 1 page.') === 'Página girada: 1.' && translate('es', 'Page 2 of 9') === 'Página 2 de 9');
setCatalog('ru', { ui: {}, seo: {}, tools: {}, guides: {}, patterns: [['^(\\d+) files?$', '$1 {p1:файл|файла|файлов}']] });
check('patterns: Russian uses three plural forms', translate('ru', '1 file') === '1 файл' && translate('ru', '3 files') === '3 файла' && translate('ru', '5 files') === '5 файлов' && translate('ru', '21 files') === '21 файл');
setCatalog('ru', null);
check('en-GB spelling rules', ukify('Gray colors, organize and summarize') === 'Grey colours, organise and summarise' && ukify('Resize the size') === 'Resize the size' && ukify('The center') === 'The centre');
check('page words work in other languages', parsePages('impares', 4).join() === '0,2' && parsePages('нечётные', 4).join() === '0,2' && parsePages('सम', 4).join() === '1,3' && parsePages('pares', 4).join() === '1,3' && parsePages('última', 4).join() === '3' && parsePages('odd', 4).join() === '0,2');
check('patterns: an unknown message stays English', translate('es', 'Something else entirely') === 'Something else entirely');
setCatalog('es', spanish());

/* ---- SEO with only English live ---- */
const en0 = seoForPath('/merge-pdf');
check('English only: no alternates, canonical unchanged, lang en', en0.alternates.length === 0 && en0.canonical === 'https://iduckpdf.com/merge-pdf' && en0.lang === 'en' && en0.title === 'Merge PDF: Combine PDF Files Online, Free | iDuckPDF');
check('English only: guides index canonical keeps its slash', seoForPath('/guides').canonical === 'https://iduckpdf.com/guides/');
check('a language that is not live has no pages (noindex)', seoForPath('/de/merge-pdf').noindex === true && seoForPath('/es/merge-pdf').noindex === true);
check('English head has no hreflang and no catalog script', !/hreflang|\/i18n\//.test(headHtml(en0)) && headHtml(en0).includes('og:locale" content="en_US"'));

/* ---- SEO with Spanish switched on ---- */
es.live = true;
const eS = seoForPath('/es/merge-pdf');
check('es tool page: self-referencing canonical, indexable, lang es', eS.canonical === 'https://iduckpdf.com/es/merge-pdf' && !eS.noindex && eS.lang === 'es');
check('es tool page: translated title and description from the catalog', eS.title === 'Unir archivos PDF gratis | iDuckPDF' && eS.description.startsWith('Combina varios PDF'));
check('es tool page: hreflang en-US, es and x-default', JSON.stringify(eS.alternates) === JSON.stringify([{ hreflang: 'en-US', href: 'https://iduckpdf.com/merge-pdf' }, { hreflang: 'es', href: 'https://iduckpdf.com/es/merge-pdf' }, { hreflang: 'x-default', href: 'https://iduckpdf.com/merge-pdf' }]));
check('the English page lists the same cluster and is its own x-default', JSON.stringify(seoForPath('/merge-pdf').alternates) === JSON.stringify(eS.alternates));
const ld = JSON.stringify(eS.jsonLd);
check('es structured data: language, localized URLs, translated how-to', ld.includes('"inLanguage":"es"') && ld.includes('https://iduckpdf.com/es/merge-pdf') && ld.includes('Cómo usar Unir PDF') && !ld.includes('"url":"https://iduckpdf.com/merge-pdf"'));
check('es breadcrumbs link to the Spanish pages and use translated names', ld.includes('"name":"Inicio"') && ld.includes('https://iduckpdf.com/es/'));
const h = headHtml(eS);
check('es head: catalog script before the app, og:locale es_ES, alternate og locale, hreflang links', h.indexOf('/i18n/es.js') > -1 && h.includes('og:locale" content="es_ES"') && h.includes('og:locale:alternate" content="en_US"') && h.includes('<link rel="alternate" hreflang="x-default"'));
check('es home: folder canonical /es/ and a translated title', seoForPath('/es').canonical === 'https://iduckpdf.com/es/' && seoForPath('/es/').title.startsWith('iDuckPDF: herramientas'));
check('es home: FAQ comes from the catalog', JSON.stringify(seoForPath('/es/').jsonLd).includes('¿Es gratis?'));
check('es guides index keeps the slash under the prefix', seoForPath('/es/guides').canonical === 'https://iduckpdf.com/es/guides/' && abs('/es/guides') === 'https://iduckpdf.com/es/guides/');
check('legal pages stay English: noindex under /es, canonical on the English page, no alternates', ENGLISH_ONLY_PATHS.filter((p) => p === '/privacy' || p === '/terms').every((p) => { const s = seoForPath('/es' + p); return s.noindex && s.canonical === 'https://iduckpdf.com' + p && s.alternates.length === 0; }));
check('the English legal page has no alternates and stays indexable', ENGLISH_ONLY_PATHS.every((p) => { const s = seoForPath(p); return !s.noindex && s.alternates.length === 0; }));
check('utility pages stay noindex in every language', ['/es/settings', '/es/donate', '/es/feedback', '/es/request'].every((p) => seoForPath(p).noindex));
check('a tool that has no translation falls back to the English text', seoForPath('/es/split-pdf').title === seoForPath('/split-pdf').title);

/* ---- the completeness checker ---- */
check('the checker finds UI strings in the source', sourceStrings().has('Search…') && sourceStrings().has('This page is also available in your language.') && sourceStrings().has('Merge PDF'));
const bad = problemsFor('es', spanish());
check('an incomplete catalog is rejected, with reasons', bad.length > 50 && bad.some((b) => b.includes('tools: split missing')) && bad.some((b) => b.includes('guides:')));
const complete: Catalog = {
  ui: Object.fromEntries([...sourceStrings()].map((k) => [k, k])),
  seo: Object.fromEntries(['/', '/pdf-tools', '/guides', '/about', '/roadmap', '/chat'].map((p) => [p, { title: 'x', description: 'x' }])),
  homeFaq: HOME_FAQ.map((f) => ({ ...f })),
  tools: Object.fromEntries(READY.map((t) => [t.id, { name: t.name, short: t.short, desc: t.desc, ...TOOL_SEO[t.id] }])),
  guides: Object.fromEntries(GUIDES.map((g) => [g.slug, { ...g }])),
  chat: Object.fromEntries(['greet', 'privacy', 'bug', 'feature', 'support', 'settings'].map((k) => [k, ['x']])),
};
const none = problemsFor('es', complete);
check('a catalog that covers everything passes', none.length === 0, none.slice(0, 3).join(' | '));
const brokenPdf = { ...complete, ui: { ...complete.ui, 'Merge PDF': 'Unir' } };
check('the checker insists that the word PDF is kept', problemsFor('es', brokenPdf).some((b) => b.includes('"PDF" is not kept')));
const wrongSteps = { ...complete, tools: { ...complete.tools, merge: { ...complete.tools.merge, steps: ['only one'] } } };
check('the checker insists that steps mirror the English structure', problemsFor('es', wrongSteps).some((b) => b.includes('tools.merge.steps')));
const wrongPlaceholder = { ...complete, ui: { ...complete.ui, 'How to use {name}': 'Cómo usar' } };
check('the checker insists on the same placeholders', problemsFor('es', wrongPlaceholder).some((b) => b.includes('placeholders differ')));
check('the checker insists on helper chat words', problemsFor('es', { ...complete, chat: undefined }).some((b) => b.includes('chat.greet')));

/* ---- search and the helper in other languages (real catalogs from disk) ---- */
const top = (q: string, lang: any) => searchTools(q, 3, lang)[0]?.id;
check('search finds a tool by its German, French, Turkish and Hindi name', top('zusammenführen', 'de') === 'merge' && top('fusionner', 'fr') === 'merge' && top('birleştir', 'tr') === 'merge' && top('मर्ज', 'hi') === 'merge');
check('search ignores accents and endings', top('zusammenfuhren', 'de') === 'merge' && bestMatch('ich möchte PDFs zusammenführen', 'de')?.id === 'merge');
check('English words still work in other languages', top('rotate', 'de') === 'rotate' && top('rotate', 'ru') === 'rotate');
check('the helper picks the right tool from a sentence in Russian, Indonesian and French', bestMatch('как сжать PDF', 'ru')?.id === 'compress' && bestMatch('perkecil PDF ini', 'id')?.id === 'compress' && bestMatch('je veux diviser un PDF', 'fr')?.id === 'split');
check('English search is unchanged', top('merge', 'en') === 'merge' && bestMatch('shrink this for email')?.id === 'compress');
check('the helper understands intents in other languages', intentOf('Hallo!', 'de') === 'greet' && intentOf('Hilfe bitte', 'de') !== 'greet' && intentOf('Sind meine Daten sicher?', 'de') === 'privacy' && intentOf('это не работает', 'ru') === 'bug' && intentOf('मेरी कुंजी कहाँ है', 'hi') === 'settings');

es.live = false;
setCatalog('es', null);
check('switching a language off again restores the English-only output', seoForPath('/merge-pdf').alternates.length === 0 && toolPath('merge') === '/merge-pdf' && DEFAULT_LANG === 'en');
LOCALES.forEach((l, i) => (l.live = realLive[i]));
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
process.exit(0);
