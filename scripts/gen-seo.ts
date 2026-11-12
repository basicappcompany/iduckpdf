/**
 * Generates public/sitemap.xml, public/llms.txt and public/llms-full.txt from the tool + guide registries,
 * so they can never drift from what is actually on the site. Runs automatically before `npm run export:web`.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { READY, SOON } from '../src/tools';
import { TOOL_SEO } from '../src/content/toolSeo';
import { GUIDES } from '../src/content/guides';
import { SITE } from '../src/config';
import { HUB_PATH, toolPath } from '../src/content/toolSlugs';
import { TOOLS } from '../src/tools';

const pub = join(__dirname, '..', 'public');
mkdirSync(pub, { recursive: true });

import { abs } from '../src/lib/seoData'; // the host serves the guides index at /guides/ and a language home at /es/
import { DEFAULT_LANG, ENGLISH_ONLY_PATHS, liveLocales, localePath } from '../src/i18n/locales';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ---------------- sitemap.xml ---------------- */
const pages: { path: string; prio: string; freq: string }[] = [
  { path: '/', prio: '1.0', freq: 'weekly' },
  { path: HUB_PATH, prio: '0.9', freq: 'weekly' },
  ...READY.map((t) => ({ path: toolPath(t.id), prio: '0.9', freq: 'monthly' })),
  { path: '/guides', prio: '0.8', freq: 'monthly' },
  ...GUIDES.map((g) => ({ path: `/guides/${g.slug}`, prio: '0.7', freq: 'monthly' })),
  { path: '/chat', prio: '0.5', freq: 'monthly' },
  { path: '/roadmap', prio: '0.4', freq: 'monthly' },
  { path: '/about', prio: '0.4', freq: 'yearly' },
  { path: '/privacy', prio: '0.3', freq: 'yearly' },
  { path: '/terms', prio: '0.3', freq: 'yearly' },
];
// One <url> per language version of each page. Each carries xhtml:link alternates for every version plus x-default (English), the
// same set the page itself declares in its <head>, so search engines get the language cluster from either place.
const live = liveLocales();
const entries = pages.flatMap((p) => {
  const multi = live.length > 1 && !ENGLISH_ONLY_PATHS.includes(p.path);
  const versions = multi ? live : live.filter((l) => l.code === DEFAULT_LANG);
  const alt = multi ? [...live.map((l) => ({ hreflang: l.hreflang, href: abs(localePath(p.path, l.code)) })), { hreflang: 'x-default', href: abs(p.path) }] : [];
  return versions.map((l) => {
    const links = alt.map((a) => `<xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${esc(a.href)}"/>`).join('');
    return `  <url><loc>${esc(abs(localePath(p.path, l.code)))}</loc><lastmod>${SITE.updated}</lastmod><changefreq>${p.freq}</changefreq><priority>${p.prio}</priority>${links}</url>`;
  });
});
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join('\n')}
</urlset>
`;
writeFileSync(join(pub, 'sitemap.xml'), sitemap);

/* ---------------- llms.txt (short, link-based summary for AI assistants) ---------------- */
const facts = [
  `${SITE.name} is a free web app with ${READY.length} PDF tools. No sign-up, no watermark, no ads.`,
  'Most tools run entirely inside the user’s web browser, so the PDF is processed on their own device and not uploaded to our servers.',
  'Exceptions are the two AI tools (summarise, ask a question). They use an API key the user supplies and send the PDF’s text directly from the browser to the AI provider the user chose (OpenAI, Anthropic or Google).',
  SOON.length
    ? `${SOON.length} more tools are planned and not built yet.`
    : 'Every tool announced so far is built, including password protection, OCR, signing, form filling, and Word, Excel, PowerPoint and web page conversions. The Office conversions run in the browser with a simplified layout, so complex documents can look different.',
  'Built with React Native (Expo); open-source libraries pdf-lib, pdf.js, JSZip and Tesseract.js do the PDF work.',
];
const llms = `# ${SITE.name}

> ${SITE.description}

${facts.map((f) => `- ${f}`).join('\n')}

## PDF tools
${READY.map((t) => `- [${t.name}](${abs(toolPath(t.id))}): ${TOOL_SEO[t.id]?.answer ?? t.short}`).join('\n')}

## Guides
${GUIDES.map((g) => `- [${g.title}](${abs('/guides/' + g.slug)}): ${g.description}`).join('\n')}

${live.length > 1 ? `## Languages\nThe whole site is also available in:\n${live.filter((l) => l.code !== DEFAULT_LANG).map((l) => `- [${l.name} (${l.native})](${abs(localePath('/', l.code))})`).join('\n')}\n\n` : ''}## Optional
- [All PDF tools](${abs(HUB_PATH)}): the full list, grouped by task
- [About and privacy](${abs('/about')}): what happens to files and how the site is built
- [Privacy policy](${abs('/privacy')}): what is and is not collected
- [Terms of use](${abs('/terms')}): the plain terms for using the site
- [Roadmap](${abs('/roadmap')}): recently added tools and what is next
- [Full text of every tool and guide](${abs('/llms-full.txt')})
`;
writeFileSync(join(pub, 'llms.txt'), llms);

/* ---------------- llms-full.txt (everything, as plain text) ---------------- */
const toolText = READY.map((t) => {
  const s = TOOL_SEO[t.id];
  if (!s) return `## ${t.name}\n${abs(toolPath(t.id))}\n${t.desc}\n`;
  return `## ${t.name}
URL: ${abs(toolPath(t.id))}
${s.answer}

How to use it:
${s.steps.map((x, i) => `${i + 1}. ${x}`).join('\n')}

Common uses:
${s.uses.map((x) => `- ${x}`).join('\n')}

FAQ:
${s.faq.map((f) => `Q: ${f.q}\nA: ${f.a}`).join('\n\n')}
`;
}).join('\n');
const guideText = GUIDES.map(
  (g) => `## ${g.title}
URL: ${abs('/guides/' + g.slug)}
${g.intro}

${g.sections.map((s) => `### ${s.h}\n${s.p.join('\n\n')}`).join('\n\n')}

FAQ:
${g.faq.map((f) => `Q: ${f.q}\nA: ${f.a}`).join('\n\n')}
`,
).join('\n');
writeFileSync(join(pub, 'llms-full.txt'), `# ${SITE.name}: full content\n\n${SITE.description}\n\nLast updated: ${SITE.updated}\n\n# Tools\n\n${toolText}\n# Guides\n\n${guideText}`);

console.log(`[gen-seo] sitemap: ${entries.length} URLs (${live.length} language${live.length === 1 ? '' : 's'}) · llms.txt · llms-full.txt (${READY.length} tools, ${GUIDES.length} guides)`);

/* ---------------- _redirects: old addresses keep working (301) ---------------- */
// Cloudflare Pages reads public/_redirects. Every old /tool/<id> goes to the new keyword URL, and /tools to the new hub.
const redirects = [
  '# Generated by scripts/gen-seo.ts from src/content/toolSlugs.ts. Do not edit by hand.',
  `/tools ${HUB_PATH} 301`,
  ...TOOLS.map((t) => `/tool/${t.id} ${toolPath(t.id)} 301`),
  `/tool/* ${HUB_PATH} 301`,
];
writeFileSync(join(pub, '_redirects'), redirects.join('\n') + '\n');
