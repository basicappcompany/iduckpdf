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

const pub = join(__dirname, '..', 'public');
mkdirSync(pub, { recursive: true });

const abs = (p: string) => SITE.url + p;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ---------------- sitemap.xml ---------------- */
const pages: { path: string; prio: string; freq: string }[] = [
  { path: '/', prio: '1.0', freq: 'weekly' },
  { path: '/tools', prio: '0.9', freq: 'weekly' },
  ...READY.map((t) => ({ path: `/tool/${t.id}`, prio: '0.9', freq: 'monthly' })),
  { path: '/guides', prio: '0.8', freq: 'monthly' },
  ...GUIDES.map((g) => ({ path: `/guides/${g.slug}`, prio: '0.7', freq: 'monthly' })),
  { path: '/chat', prio: '0.5', freq: 'monthly' },
  { path: '/roadmap', prio: '0.4', freq: 'monthly' },
  { path: '/about', prio: '0.4', freq: 'yearly' },
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url><loc>${esc(abs(p.path))}</loc><lastmod>${SITE.updated}</lastmod><changefreq>${p.freq}</changefreq><priority>${p.prio}</priority></url>`).join('\n')}
</urlset>
`;
writeFileSync(join(pub, 'sitemap.xml'), sitemap);

/* ---------------- llms.txt (short, link-based summary for AI assistants) ---------------- */
const facts = [
  `${SITE.name} is a free web app with ${READY.length} PDF tools. No sign-up, no watermark, no ads.`,
  'Most tools run entirely inside the user’s web browser, so the PDF is processed on their own device and not uploaded to our servers.',
  'Exceptions are the two AI tools (summarise, ask a question). They use an API key the user supplies and send the PDF’s text directly from the browser to the AI provider the user chose (OpenAI, Anthropic or Google).',
  `${SOON.length} more tools are planned (password protection, OCR, signing, Office conversions). They are not built yet.`,
  'Built with React Native (Expo); open-source libraries pdf-lib and pdf.js do the PDF work.',
];
const llms = `# ${SITE.name}

> ${SITE.description}

${facts.map((f) => `- ${f}`).join('\n')}

## PDF tools
${READY.map((t) => `- [${t.name}](${abs('/tool/' + t.id)}): ${TOOL_SEO[t.id]?.answer ?? t.short}`).join('\n')}

## Guides
${GUIDES.map((g) => `- [${g.title}](${abs('/guides/' + g.slug)}): ${g.description}`).join('\n')}

## Optional
- [All tools](${abs('/tools')}): the full list, grouped by task
- [About and privacy](${abs('/about')}): what happens to files and how the site is built
- [Roadmap](${abs('/roadmap')}): planned tools and why they are not built yet
- [Full text of every tool and guide](${abs('/llms-full.txt')})
`;
writeFileSync(join(pub, 'llms.txt'), llms);

/* ---------------- llms-full.txt (everything, as plain text) ---------------- */
const toolText = READY.map((t) => {
  const s = TOOL_SEO[t.id];
  if (!s) return `## ${t.name}\n${abs('/tool/' + t.id)}\n${t.desc}\n`;
  return `## ${t.name}
URL: ${abs('/tool/' + t.id)}
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

console.log(`[gen-seo] sitemap: ${pages.length} URLs · llms.txt · llms-full.txt (${READY.length} tools, ${GUIDES.length} guides)`);
