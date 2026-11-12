/**
 * English strings that reach tr() through a variable, so the source scan in scripts/i18n-check.ts cannot see them as literals.
 * Every one needs a translation in a live language.
 */
export const EXTRA_STRINGS: string[] = [
  // search palette groups and hints
  'Pages', 'Actions', 'Page', 'Tool', 'Action', 'Coming soon',
  // tool page defaults
  'Go', 'Starting…', 'Working…',
  // signature pad
  'Black', 'Blue', 'Script', 'Casual', 'Classic',
  // chat helper starter chips
  'Combine some PDFs', 'Make a PDF smaller', 'Turn photos into a PDF', 'Hide private info', 'Add page numbers', 'Is my file safe?',
  // page titles used for pages that are not indexed
  'Page not found', 'Tool not found', 'Guide not found', 'iDuckPDF: free PDF tools in your browser',
  // the footer
  'Free PDF tools that run in your browser.',
];
