/**
 * One pure function decides the title, description, canonical URL, robots rule and structured data
 * for every page. It is used (1) by scripts/inject-seo.ts to write real tags into each pre-rendered
 * HTML file, and (2) by the <Seo> component to keep the tab title right while people click around.
 * No React or DOM in here, so it also runs in Node.
 */
import { SITE } from '../config';
import { READY, TOOLS, byId } from '../tools';
import { TOOL_SEO } from '../content/toolSeo';
import { GUIDES, guideBySlug } from '../content/guides';
import { HOME_FAQ } from '../content/homeFaq';
import { HUB_PATH, idForSlug, toolPath } from '../content/toolSlugs';
import { PRIVACY, TERMS } from '../content/legal';
import { RESPONSIVE_CSS } from './responsive';
import { THEME_CSS, THEME_INIT_SCRIPT } from './themeColors';

export type PageSeo = {
  title: string; // full <title>
  description: string;
  path: string;
  noindex: boolean;
  type: 'website' | 'article';
  jsonLd: object[];
};

const abs = (p: string) => (p.startsWith('http') ? p : SITE.url + p);
const full = (t: string) => `${t} | ${SITE.name}`;

const breadcrumbLd = (crumbs: { name: string; path: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: abs(c.path) })),
});

const faqLd = (faq: { q: string; a: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
});

const howToLd = (name: string, description: string, steps: string[], path: string) => ({
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name,
  description,
  url: abs(path),
  step: steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.split(/[.:]/)[0].slice(0, 80), text: s })),
});

const appLd = (name: string, description: string, path: string) => ({
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name,
  description,
  url: abs(path),
  applicationCategory: 'UtilitiesApplication',
  operatingSystem: 'Any (runs in a web browser)',
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
  itemListElement: READY.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, url: abs(toolPath(t.id)) })),
});

const hidden = (title: string, path: string): PageSeo => ({ title: full(title), description: SITE.description, path, noindex: true, type: 'website', jsonLd: [] });

export function seoForPath(raw: string): PageSeo {
  const path = raw.length > 1 ? raw.replace(/\/$/, '') : raw;

  if (path === '/') {
    return { title: SITE.title, description: SITE.description, path, noindex: false, type: 'website', jsonLd: [itemList('iDuckPDF tools'), faqLd(HOME_FAQ)] };
  }
  if (path === HUB_PATH) {
    return {
      title: full('All PDF Tools'),
      description: 'Every free iDuckPDF tool in one place: merge, split, compress, rotate, watermark, redact, convert and more. Search by name or by what you want to do.',
      path,
      noindex: false,
      type: 'website',
      jsonLd: [itemList('All PDF tools'), breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'All PDF tools', path }])],
    };
  }

  const toolId = idForSlug(path.slice(1));
  if (toolId) {
    const tool = byId(toolId);
    const seo = tool && TOOL_SEO[tool.id];
    if (!tool || !seo || tool.status !== 'ready') return hidden(tool ? `${tool.name} (coming soon)` : 'Tool not found', path); // roadmap pages stay out of the index
    return {
      title: full(seo.title),
      description: seo.description,
      path,
      noindex: false,
      type: 'website',
      jsonLd: [
        appLd(tool.name, seo.description, path),
        howToLd(`How to use ${tool.name}`, seo.answer, seo.steps, path),
        faqLd(seo.faq),
        breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'All PDF tools', path: HUB_PATH }, { name: tool.name, path }]),
      ],
    };
  }

  if (path === '/guides') {
    return {
      title: full('PDF How-To Guides'),
      description: 'Plain-English guides: merge, split, compress and redact PDFs, add page numbers, remove metadata, and check whether an online PDF tool is safe.',
      path,
      noindex: false,
      type: 'website',
      jsonLd: [
        breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Guides', path }]),
        {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'PDF how-to guides',
          url: abs(path),
          hasPart: GUIDES.map((g) => ({ '@type': 'Article', headline: g.title, url: abs(`/guides/${g.slug}`) })),
        },
      ],
    };
  }
  const gm = path.match(/^\/guides\/([^/]+)$/);
  if (gm) {
    const g = guideBySlug(gm[1]);
    if (!g) return hidden('Guide not found', path);
    return {
      title: full(g.seoTitle),
      description: g.description,
      path,
      noindex: false,
      type: 'article',
      jsonLd: [
        breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Guides', path: '/guides' }, { name: g.title, path }]),
        {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: g.seoTitle,
          description: g.description,
          url: abs(path),
          mainEntityOfPage: abs(path),
          dateModified: SITE.updated,
          datePublished: SITE.updated,
          inLanguage: 'en',
          author: { '@type': 'Organization', name: SITE.name, url: SITE.url },
          publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url },
        },
        faqLd(g.faq),
      ],
    };
  }

  if (path === '/about') {
    return {
      title: full('About iDuckPDF'),
      description: 'What iDuckPDF is, what happens to your files, what it costs and how it is built. Free PDF tools that run in your browser.',
      path,
      noindex: false,
      type: 'website',
      jsonLd: [{ '@context': 'https://schema.org', '@type': 'AboutPage', name: 'About iDuckPDF', url: abs(path) }, breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'About', path }])],
    };
  }
  if (path === '/privacy' || path === '/terms') {
    const doc = path === '/privacy' ? PRIVACY : TERMS;
    return {
      title: full(doc.seoTitle),
      description: doc.description,
      path,
      noindex: false,
      type: 'website',
      jsonLd: [{ '@context': 'https://schema.org', '@type': 'WebPage', name: doc.title, url: abs(path), dateModified: SITE.legalUpdated }, breadcrumbLd([{ name: 'Home', path: '/' }, { name: doc.title, path }])],
    };
  }
  if (path === '/roadmap') {
    return { title: full('Roadmap: Upcoming PDF Tools'), description: 'What iDuckPDF can do today and which tools are planned next, such as password protection, OCR and Office conversions.', path, noindex: false, type: 'website', jsonLd: [breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Roadmap', path }])] };
  }
  if (path === '/chat') {
    return { title: full('Ask the PDF Helper: Find the Right Tool'), description: 'Describe your PDF job in plain words and the iDuckPDF helper points you to the right free tool.', path, noindex: false, type: 'website', jsonLd: [breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Ask the helper', path }])] };
  }
  if (path === '/settings') return hidden('Settings', path);
  if (path === '/feedback') return hidden('Send feedback', path);
  if (path === '/request') return hidden('Request a feature', path);
  if (path === '/donate') return hidden('Support iDuckPDF', path);
  return hidden('Page not found', path);
}

/** Every path that should be pre-rendered. */
export const ALL_TOOL_IDS = TOOLS.map((t) => t.id);

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const orgLd = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': `${SITE.url}/#org`, name: SITE.name, url: SITE.url, logo: `${SITE.url}/icons/icon-512.png`, description: SITE.description, parentOrganization: { '@type': 'Organization', name: SITE.operator }, email: SITE.feedbackEmail },
    {
      '@type': 'WebSite',
      '@id': `${SITE.url}/#website`,
      url: SITE.url,
      name: SITE.name,
      description: SITE.description,
      inLanguage: 'en',
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
  const url = abs(d.path);
  const img = abs(SITE.ogImage);
  const tags = [
    `<title id="seo-title">${esc(d.title)}</title>`,
    `<meta id="seo-desc" name="description" content="${esc(d.description)}">`,
    `<link id="seo-canonical" rel="canonical" href="${esc(url)}">`,
    `<meta name="robots" content="${d.noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large,max-snippet:-1'}">`,
    `<meta property="og:site_name" content="${SITE.name}">`,
    `<meta property="og:type" content="${d.type}">`,
    `<meta id="seo-og-title" property="og:title" content="${esc(d.title)}">`,
    `<meta id="seo-og-desc" property="og:description" content="${esc(d.description)}">`,
    `<meta id="seo-og-url" property="og:url" content="${esc(url)}">`,
    `<meta property="og:image" content="${img}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="iDuckPDF: free PDF tools in your browser">`,
    `<meta property="og:locale" content="en_US">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(d.title)}">`,
    `<meta name="twitter:description" content="${esc(d.description)}">`,
    `<meta name="twitter:image" content="${img}">`,
    ...d.jsonLd.map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`),
  ];
  return siteHeadHtml() + tags.join('');
}
