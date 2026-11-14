/**
 * The URL slugs of the English-only landing pages in landing.ts. Kept in its own tiny file so the link helper in i18n/locales.ts
 * can know them without pulling the page copy into every bundle. scripts/audit-seo.ts checks this list matches landing.ts.
 */
export const LANDING_SLUG_LIST: string[] = [
  'how-it-works',
  'compress-pdf-to-100kb',
  'compress-pdf-to-200kb',
  'compress-pdf-to-300kb',
  'compress-pdf-to-500kb',
  'compress-pdf-to-1mb',
  'compress-pdf-to-2mb',
  'compress-pdf-for-email',
  'compress-pdf-for-form-upload',
  'combine-pdf-and-jpg',
  'remove-password-from-bank-statement-pdf',
  'sign-pdf-on-phone',
  'split-pdf-by-size',
  'jpg-to-pdf-under-size-limit',
  'iduckpdf-vs-ilovepdf',
  'iduckpdf-vs-smallpdf',
  'best-free-pdf-tools-without-upload',
];

/** Landing pages that run or explain a tool, shown as chips on that tool's English page (tool id -> pages). */
export const LANDINGS_FOR_TOOL: Record<string, { slug: string; label: string }[]> = {
  compress: [
    { slug: 'compress-pdf-to-100kb', label: 'Compress to 100 KB' },
    { slug: 'compress-pdf-to-200kb', label: 'Compress to 200 KB' },
    { slug: 'compress-pdf-to-300kb', label: 'Compress to 300 KB' },
    { slug: 'compress-pdf-to-500kb', label: 'Compress to 500 KB' },
    { slug: 'compress-pdf-to-1mb', label: 'Compress to 1 MB' },
    { slug: 'compress-pdf-to-2mb', label: 'Compress to 2 MB' },
    { slug: 'compress-pdf-for-email', label: 'Compress for email' },
    { slug: 'compress-pdf-for-form-upload', label: 'Compress for a form upload' },
  ],
  unlock: [{ slug: 'remove-password-from-bank-statement-pdf', label: 'Bank statement or e-Aadhaar PDF' }],
  split: [{ slug: 'split-pdf-by-size', label: 'Split by file size' }],
  'jpg-to-pdf': [{ slug: 'jpg-to-pdf-under-size-limit', label: 'JPG to PDF under a size limit' }],
  sign: [{ slug: 'sign-pdf-on-phone', label: 'Sign a PDF on your phone' }],
  'merge-pdf-images': [{ slug: 'combine-pdf-and-jpg', label: 'Combine PDF and JPG' }],
  merge: [{ slug: 'combine-pdf-and-jpg', label: 'Combine PDF and JPG' }],
};
