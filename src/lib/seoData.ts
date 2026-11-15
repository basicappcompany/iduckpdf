/**
 * One pure function decides the title, description, canonical URL, robots rule, language alternates and structured data
 * for every page, in every language. It is used (1) by scripts/inject-seo.ts to write real tags into each pre-rendered
 * HTML file, and (2) by scripts/gen-seo.ts and the audit. No React or DOM in here, so it runs in Node.
 * Paths are the addresses people see: '/merge-pdf' in English, '/es/merge-pdf' in Spanish.
 */
import { SITE } from '../config';
import { READY, byId } from '../tools';
import { HUB_PATH, idForSlug, toolPath } from '../content/toolSlugs';
import { PRIVACY, TERMS } from '../content/legal';
import { homeFaqFor, pageSeoFor } from '../i18n/content';
import { guideFor, guidesFor } from '../i18n/guideContent';
import { toolSeoFor, toolTextFor } from '../i18n/toolContent';
import { translate } from '../i18n/catalog';
import { landingBySlug } from '../content/landing';
import { DEFAULT_LANG, ENGLISH_ONLY_PATHS, isLive, liveLocales, localeOf, localePath, splitPath, type Lang } from '../i18n/locales';
import { RESPONSIVE_CSS } from './responsive';
import { THEME_CSS, THEME_INIT_SCRIPT } from './themeColors';

export type PageSeo = {
  title: string; // full <title>
  description: string;
  path: string; // the address this page is served at, with its language prefix
  lang: Lang;
  canonical: string; // absolute canonical URL
  alternates: { hreflang: string; href: string }[]; // every language version of this page, plus x-default; empty when only one language is live
  noindex: boolean;
  type: 'website' | 'article';
  jsonLd: object[];
};

// the guides index is served at /guides/ (the host redirects /guides to it), and a language home at /es/, so those are their canonical addresses
export function abs(p: string): string {
  if (p.startsWith('http')) return p;
  const { lang, path } = splitPath(p);
  const slash = path === '/guides' || (lang !== DEFAULT_LANG && path === '/');
  return SITE.url + (slash ? localePath(path, lang).replace(/\/?$/, '/') : p);
}

const full = (t: string) => `${t} | ${SITE.name}`;

export function seoForPath(raw: string): PageSeo {
  const { lang, path } = splitPath(raw);
  const lp = localePath(path, lang); // this page's address in its language
  const L = (p: string) => abs(localePath(p, lang)); // another page of the site, in this page's language
  const tr = (s: string) => translate(lang, s);

  const breadcrumbLd = (crumbs: { name: string; path: string }[]) => ({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: L(c.path) })),
  });
  const faqLd = (faq: { q: string; a: string }[]) => ({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: localeOf(lang).hreflang,
    mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  });
  const howToLd = (name: string, description: string, steps: string[]) => ({
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name,
    description,
    url: L(path),
    inLanguage: localeOf(lang).hreflang,
    step: steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.split(/[.:。।]/)[0].slice(0, 80), text: s })),
  });
  const appLd = (name: string, description: string) => ({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name,
    description,
    url: L(path),
    inLanguage: localeOf(lang).hreflang,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    provider: { '@type': 'Organization', name: SITE.name, url: SITE.url },
    dateModified: SITE.updated,
  });
  const itemList = (name: string) => ({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    itemListElement: READY.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: toolTextFor(lang, t.id).name, url: L(toolPath(t.id)) })),
  });
  const home = { name: tr('Home'), path: '/' };
  const hub = { name: tr('All PDF tools'), path: HUB_PATH };

  const page = (p: { title: string; description: string; noindex?: boolean; type?: 'website' | 'article'; jsonLd?: object[] }): PageSeo => ({
    title: p.title,
    description: p.description,
    path: lp,
    lang,
    canonical: abs(lp),
    alternates: [],
    noindex: !!p.noindex,
    type: p.type ?? 'website',
    jsonLd: p.jsonLd ?? [],
  });
  const hidden = (title: string) => page({ title: full(tr(title)), description: tr(SITE.description), noindex: true });

  if (lang !== DEFAULT_LANG && !isLive(lang)) return hidden('Page not found'); // a language that is not switched on has no pages

  let seo: PageSeo;
  const toolId = idForSlug(path.slice(1));
  const gm = path.match(/^\/guides\/([^/]+)$/);

  if (path === '/') {
    const p = pageSeoFor(lang, '/', { title: SITE.title, description: SITE.description });
    seo = page({ title: p.title, description: p.description, jsonLd: [itemList(`iDuckPDF ${tr('tools')}`), faqLd(homeFaqFor(lang))] });
  } else if (path === HUB_PATH) {
    const p = pageSeoFor(lang, path, {
      title: 'All PDF Tools',
      description: 'Every free iDuckPDF tool in one place: merge, split, compress, rotate, watermark, redact, convert and more. Search by name or by what you want to do.',
    });
    seo = page({ title: full(p.title), description: p.description, jsonLd: [itemList(hub.name), breadcrumbLd([home, { name: hub.name, path }])] });
  } else if (toolId) {
    const tool = byId(toolId);
    const t = toolSeoFor(lang, toolId);
    if (!tool || !t || tool.status !== 'ready') seo = hidden(tool ? `${tool.name} (coming soon)` : 'Tool not found'); // roadmap pages stay out of the index
    else {
      const name = toolTextFor(lang, toolId).name;
      seo = page({
        title: full(t.title),
        description: t.description,
        jsonLd: [appLd(name, t.description), howToLd(translate(lang, 'How to use {name}', { name }), t.answer, t.steps), faqLd(t.faq), breadcrumbLd([home, hub, { name, path }])],
      });
    }
  } else if (path === '/guides') {
    const p = pageSeoFor(lang, path, {
      title: 'PDF How-To Guides',
      description: 'Plain-English guides: merge, split, compress and redact PDFs, add page numbers, remove metadata, and check whether an online PDF tool is safe.',
    });
    seo = page({
      title: full(p.title),
      description: p.description,
      jsonLd: [
        breadcrumbLd([home, { name: tr('Guides'), path }]),
        {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: p.title,
          url: L(path),
          inLanguage: localeOf(lang).hreflang,
          hasPart: guidesFor(lang).map((g) => ({ '@type': 'Article', headline: g.title, url: L(`/guides/${g.slug}`) })),
        },
      ],
    });
  } else if (gm) {
    const g = guideFor(lang, gm[1]);
    if (!g) seo = hidden('Guide not found');
    else {
      seo = page({
        title: full(g.seoTitle),
        description: g.description,
        type: 'article',
        jsonLd: [
          breadcrumbLd([home, { name: tr('Guides'), path: '/guides' }, { name: g.title, path }]),
          {
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: g.seoTitle,
            description: g.description,
            url: L(path),
            mainEntityOfPage: L(path),
            dateModified: SITE.updated,
            datePublished: SITE.updated,
            inLanguage: localeOf(lang).hreflang,
            author: { '@type': 'Organization', name: SITE.name, url: SITE.url },
            publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url },
          },
          faqLd(g.faq),
        ],
      });
    }
  } else if (path === '/about') {
    const p = pageSeoFor(lang, path, { title: 'About iDuckPDF', description: 'What iDuckPDF is, what happens to your files, what it costs and how it is built. Free PDF tools that run in your browser.' });
    seo = page({ title: full(p.title), description: p.description, jsonLd: [{ '@context': 'https://schema.org', '@type': 'AboutPage', name: p.title, url: L(path), inLanguage: localeOf(lang).hreflang }, breadcrumbLd([home, { name: tr('About'), path }])] });
  } else if (path === '/privacy' || path === '/terms') {
    const doc = path === '/privacy' ? PRIVACY : TERMS;
    seo = page({ title: full(doc.seoTitle), description: doc.description, jsonLd: [{ '@context': 'https://schema.org', '@type': 'WebPage', name: doc.title, url: L(path), dateModified: SITE.legalUpdated }, breadcrumbLd([home, { name: doc.title, path }])] });
  } else if (path === '/roadmap') {
    const p = pageSeoFor(lang, path, { title: 'Roadmap: What’s Next for iDuckPDF', description: 'Every PDF tool announced for iDuckPDF is built. See what was added recently, what is on the ideas list, and suggest the next tool.' });
    seo = page({ title: full(p.title), description: p.description, jsonLd: [breadcrumbLd([home, { name: tr('Roadmap'), path }])] });
  } else if (path === '/chat') {
    const p = pageSeoFor(lang, path, { title: 'Ask the PDF Helper: Find the Right Tool', description: 'Describe your PDF job in plain words and the iDuckPDF helper points you to the right free tool.' });
    seo = page({ title: full(p.title), description: p.description, jsonLd: [breadcrumbLd([home, { name: tr('Ask the helper'), path }])] });
  } else if (lang === DEFAULT_LANG && landingBySlug(path.slice(1))) {
    const l = landingBySlug(path.slice(1))!;
    const lt = l.tool ? byId(l.tool) : undefined;
    seo = page({
      title: full(l.title),
      description: l.description,
      type: l.kind === 'compare' || l.kind === 'info' ? 'article' : 'website',
      jsonLd: [
        ...(l.kind === 'compare' || l.kind === 'info'
          ? [{ '@context': 'https://schema.org', '@type': 'Article', headline: l.h1, description: l.description, url: L(path), inLanguage: 'en', datePublished: l.reviewed, dateModified: l.reviewed, author: { '@type': 'Organization', name: SITE.operator, url: SITE.url }, publisher: { '@id': `${SITE.url}/#org` } }]
          : [{ '@context': 'https://schema.org', '@type': 'WebPage', name: l.h1, description: l.description, url: L(path), inLanguage: 'en', dateModified: l.reviewed }]),
        ...(lt ? [appLd(l.h1, l.description)] : []),
        ...(l.steps?.length ? [howToLd(l.h1, l.answer, l.steps)] : []),
        faqLd(l.faq),
        breadcrumbLd([home, ...(l.kind === 'size' || l.kind === 'job' ? [hub] : []), { name: l.h1, path }]),
      ],
    });
  } else if (path === '/settings') seo = hidden('Settings');
  else if (path === '/feedback') seo = hidden('Send feedback');
  else if (path === '/request') seo = hidden('Request a feature');
  else if (path === '/donate') seo = hidden('Support iDuckPDF');
  else seo = hidden('Page not found');

  if (seo.noindex) return seo;

  // Legal pages are English only: under /es/ they keep the translated page chrome, are kept out of the index and point at the English original.
  if (lang !== DEFAULT_LANG && ENGLISH_ONLY_PATHS.includes(path)) return { ...seo, noindex: true, canonical: abs(path), alternates: [] };

  // every language version of this page, plus x-default pointing at English; only when there is more than one language to point at
  const live = liveLocales();
  if (live.length > 1 && !ENGLISH_ONLY_PATHS.includes(path)) {
    seo.alternates = [...live.map((l) => ({ hreflang: l.hreflang, href: abs(localePath(path, l.code)) })), { hreflang: 'x-default', href: abs(path) }];
  }
  return seo;
}

/** Every path that should be pre-rendered. */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const orgLd = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': `${SITE.url}/#org`, name: SITE.name, url: SITE.url, logo: `${SITE.url}/icons/icon-512.png`, description: SITE.description, parentOrganization: { '@id': `${SITE.url}/#operator` }, email: SITE.feedbackEmail },
    { '@type': 'Organization', '@id': `${SITE.url}/#operator`, name: SITE.operator, email: SITE.feedbackEmail, sameAs: ['https://iduckimg.com/', 'https://iduckcalculator.com/', 'https://iduckconvert.com/'] },
    {
      '@type': 'WebSite',
      '@id': `${SITE.url}/#website`,
      url: SITE.url,
      name: SITE.name,
      description: SITE.description,
      inLanguage: liveLocales().length > 1 ? liveLocales().map((l) => l.hreflang) : 'en',
      publisher: { '@id': `${SITE.url}/#org` },
      potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${SITE.url}${HUB_PATH}?q={search_term_string}` }, 'query-input': 'required name=search_term_string' },
    },
  ],
};

/** Tags every page gets: icons, manifest, theme colour, site-wide structured data, no white flash in dark mode. */
function siteHeadHtml(): string {
  return [
    '<meta name="theme-color" content="#ffd23f" media="(prefers-color-scheme: light)">',
    '<meta name="theme-color" content="#121212" media="(prefers-color-scheme: dark)">',
    '<meta name="color-scheme" content="light dark">',
    `<meta name="application-name" content="${SITE.name}">`,
    `<meta name="apple-mobile-web-app-title" content="${SITE.name}">`,
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
    '<link rel="icon" href="/icons/favicon-32.png" sizes="32x32" type="image/png">',
    '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">',
    '<link rel="manifest" href="/manifest.webmanifest">',
    '<link rel="sitemap" type="application/xml" href="/sitemap.xml">',
    '<link rel="alternate" type="text/plain" href="/llms.txt" title="LLM-readable site summary">',
    `<script type="application/ld+json">${JSON.stringify(orgLd)}</script>`,
    `<script>${THEME_INIT_SCRIPT}</script>`,
    `<style>${THEME_CSS}${RESPONSIVE_CSS}</style>`,
  ].join('');
}

/** The tags to place inside <head> for a page. Ids let the client update them while navigating. */
export function headHtml(d: PageSeo): string {
  const url = d.canonical;
  const img = abs(SITE.ogImage);
  const loc = localeOf(d.lang);
  const tags = [
    // a localized page loads its translations before the app starts, so the first paint is already in its language
    ...(d.lang !== DEFAULT_LANG ? [`<script charset="utf-8" src="/i18n/${d.lang}.js"></script>`] : []),
    `<title id="seo-title">${esc(d.title)}</title>`,
    `<meta id="seo-desc" name="description" content="${esc(d.description)}">`,
    `<link id="seo-canonical" rel="canonical" href="${esc(url)}">`,
    ...d.alternates.map((a) => `<link rel="alternate" hreflang="${a.hreflang}" href="${esc(a.href)}">`),
    `<meta name="robots" content="${d.noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large,max-snippet:-1'}">`,
    `<meta property="og:site_name" content="${SITE.name}">`,
    `<meta property="og:type" content="${d.type}">`,
    `<meta id="seo-og-title" property="og:title" content="${esc(d.title)}">`,
    `<meta id="seo-og-desc" property="og:description" content="${esc(d.description)}">`,
    `<meta id="seo-og-url" property="og:url" content="${esc(url)}">`,
    `<meta property="og:image" content="${img}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${esc(translate(d.lang, 'iDuckPDF: free PDF tools in your browser'))}">`,
    `<meta property="og:locale" content="${loc.og}">`,
    ...(d.alternates.length ? liveLocales().filter((l) => l.code !== d.lang).map((l) => `<meta property="og:locale:alternate" content="${l.og}">`) : []),
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(d.title)}">`,
    `<meta name="twitter:description" content="${esc(d.description)}">`,
    `<meta name="twitter:image" content="${img}">`,
    ...d.jsonLd.map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`),
  ];
  return siteHeadHtml() + tags.join('');
}
