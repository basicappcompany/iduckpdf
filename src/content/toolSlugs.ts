/**
 * The public URL of every tool: flat, keyword-first slugs that all contain "pdf" and follow how people actually search
 * ("merge pdf", "compress pdf", "pdf to image"). The tool id stays the internal key (history, hand-offs, SEO copy);
 * only the URL uses the slug. scripts/gen-tool-meta.ts fails the build if a slug is missing, has no "pdf", is duplicated
 * or collides with another route, and gen-seo writes 301 redirects from the old /tool/<id> addresses.
 */
export const TOOL_SLUGS: Record<string, string> = {
  merge: 'merge-pdf',
  weave: 'interleave-pdf',
  split: 'split-pdf',
  'extract-pages': 'extract-pdf-pages',
  'remove-pages': 'remove-pdf-pages',
  reorder: 'reorder-pdf-pages',
  reverse: 'reverse-pdf-pages',
  rotate: 'rotate-pdf',
  'insert-blank': 'add-blank-page-to-pdf',
  resize: 'resize-pdf',
  crop: 'crop-pdf',
  'n-up': 'multiple-pages-per-sheet-pdf',
  repair: 'repair-pdf',
  'page-numbers': 'add-page-numbers-to-pdf',
  'text-watermark': 'add-watermark-to-pdf',
  'image-watermark': 'add-logo-to-pdf',
  'headers-footers': 'add-header-and-footer-to-pdf',
  'add-text': 'add-text-to-pdf',
  'images-to-pdf': 'image-to-pdf',
  'scan-to-pdf': 'scan-to-pdf',
  'text-to-pdf': 'text-to-pdf',
  'pdf-to-images': 'pdf-to-image',
  'word-count': 'pdf-word-counter',
  bates: 'bates-numbering-pdf',
  'pdf-to-markdown': 'pdf-to-markdown',
  'extract-text': 'pdf-to-text',
  compress: 'compress-pdf',
  restyle: 'grayscale-pdf',
  inspect: 'inspect-pdf',
  properties: 'edit-pdf-metadata',
  flatten: 'flatten-pdf',
  redact: 'redact-pdf',
  compare: 'compare-pdf',
  summarize: 'summarize-pdf',
  ask: 'chat-with-pdf',
  lock: 'password-protect-pdf',
  unlock: 'unlock-pdf',
  ocr: 'ocr-pdf',
  sign: 'sign-pdf',
  fill: 'fill-pdf-form',
  'word-to-pdf': 'word-to-pdf',
  'pdf-to-word': 'pdf-to-word',
  'excel-to-pdf': 'excel-to-pdf',
  'pdf-to-excel': 'pdf-to-excel',
  'pptx-to-pdf': 'powerpoint-to-pdf',
  'html-to-pdf': 'html-to-pdf',
  'extract-images': 'extract-images-from-pdf',
  'pdf-to-pptx': 'pdf-to-powerpoint',
  'merge-pdf-images': 'merge-pdf-and-images',
  'jpg-to-pdf': 'jpg-to-pdf',
  'pdf-to-jpg': 'pdf-to-jpg',
  translate: 'translate-pdf',
  flashcards: 'pdf-to-flashcards',
  'ai-extract': 'extract-data-from-pdf',
};

/** The page that lists every tool. It used to live at /tools. */
export const HUB_PATH = '/pdf-tools';

/** Top-level routes that are not tools. A tool slug must never equal one of these. */
export const RESERVED_ROOT_PATHS = ['about', 'chat', 'donate', 'feedback', 'guides', 'pdf-tools', 'privacy', 'request', 'roadmap', 'settings', 'terms', 'tools', 'tool', 'api', 'vendor', 'icons', 'assets', 'sitemap.xml', 'robots.txt', 'llms.txt', 'llms-full.txt'];

const BY_SLUG = Object.fromEntries(Object.entries(TOOL_SLUGS).map(([id, slug]) => [slug, id]));

export const slugFor = (id: string): string => TOOL_SLUGS[id] ?? id;
export const toolPath = (id: string): string => '/' + slugFor(id);
export const idForSlug = (slug: string): string | undefined => BY_SLUG[slug];
