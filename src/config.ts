// Site-wide settings. Anything marked TODO is tracked in docs/TODO.md.
export const SITE = {
  name: 'iDuckPDF',
  domain: 'iduckpdf.com',
  operator: 'Basic App Company', // who runs the site; shown on the policy pages, About, footer and in structured data
  url: 'https://iduckpdf.com',
  tagline: 'PDFs, quacked open.',
  title: 'iDuckPDF: Free Online PDF Tools to Merge, Split, Compress and Edit',
  description:
    'Free PDF tools that run in your browser: merge, split, compress, rotate, watermark, number pages, redact and more. No sign-up, no watermark, no ads.',
  // TODO(docs/TODO.md): replace with the real inbox, or with a serverless endpoint.
  feedbackEmail: 'hello@iduckpdf.com',
  updated: '2026-11-09', // bump when content changes; used in sitemap, schema and "last updated" lines
  legalUpdated: '2026-11-09', // bump when the privacy policy or terms change
  ogImage: '/og.png',
};

export const DONATE = {
  // TODO(docs/TODO.md): set once the Dodo Payments account + product exist.
  // The serverless function in /functions/api/donate.ts creates the checkout session.
  endpoint: '/api/donate',
  enabled: false, // flip to true after the Dodo keys are configured on the host
  presets: [3, 5, 10, 25],
  currency: 'USD',
};

export const AI_DEFAULTS: Record<string, { label: string; model: string; keyUrl: string }> = {
  openai: { label: 'OpenAI', model: 'gpt-4o-mini', keyUrl: 'https://platform.openai.com/api-keys' },
  anthropic: { label: 'Anthropic (Claude)', model: 'claude-haiku-5-5', keyUrl: 'https://console.anthropic.com/settings/keys' },
  gemini: { label: 'Google Gemini', model: 'gemini-2.0-flash', keyUrl: 'https://aistudio.google.com/app/apikey' },
};
