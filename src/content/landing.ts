/**
 * English-only landing pages that sit beside the tool pages at the site root: "How iDuckPDF works", the comparison pages,
 * the compress-to-a-size pages and the job-specific pages. Each is one entry here; `src/app/[slug].tsx` renders it with
 * `src/ui/LandingView.tsx`, `src/lib/seoData.ts` gives it a title, canonical URL and JSON-LD, and `scripts/gen-seo.ts` lists it
 * in the sitemap and llms.txt. They are not translated, so they get no language versions (see gen-i18n and ENGLISH_ONLY_PATHS).
 */
import type { Landing } from './landingTypes';
import { REVIEWED } from './landingTypes';
import { SIZE_AND_JOB_PAGES } from './landingSize';
import { COMPARE_PAGES } from './landingCompare';

export type { Landing, LandingFaq, LandingTable } from './landingTypes';
export { REVIEWED };

export const LANDINGS: Landing[] = [
  ...SIZE_AND_JOB_PAGES,
  ...COMPARE_PAGES,
  {
    slug: 'how-it-works',
    kind: 'info',
    title: 'How iDuckPDF Works: What Runs in Your Browser',
    description: 'Which engines iDuckPDF uses, what runs in your browser, and exactly what leaves your device and when. Plain answers, no marketing.',
    h1: 'How iDuckPDF works',
    answer:
      'iDuckPDF runs almost every tool inside your browser tab. Your PDF is read and rewritten by JavaScript and WebAssembly on your own device, so it is not uploaded to our servers. The exceptions are the five AI tools, which send text to the AI provider you choose, using your own key.',
    sections: [
      {
        h: 'What runs in your browser',
        p: [
          'Merging, splitting, rotating, compressing, signing, filling forms, redacting, adding page numbers, OCR, password protection and the Word, Excel, PowerPoint and web page conversions all run on your device. When you press the button, your browser reads the file from memory, does the work and hands you the result to download. Close the tab and it is gone.',
          'The page itself, its scripts and the OCR language files are downloaded from iduckpdf.com when you open it. Nothing that does the PDF work is loaded from another website.',
        ],
      },
      {
        h: 'The engines inside',
        p: [
          'pdf-lib (and its fork @cantoo/pdf-lib, which adds AES-256 passwords) builds and edits PDF files. pdf.js, from Mozilla, reads pages, draws them to images and extracts text. Tesseract.js, compiled to WebAssembly, does OCR. JSZip and fflate make ZIP files. The Word, Excel and PowerPoint readers and writers, and the layout engine behind the conversions, are our own code.',
          'The Office conversions use a simplified layout, so a complex document can look different after converting. That is a real limit of doing the work in a browser tab, and each tool page says so.',
        ],
      },
      {
        h: 'What leaves your device, and when',
        p: [
          'The AI tools (Summarize, Chat with PDF, Translate, Flashcards and Extract data) send the text of the PDF you choose to OpenAI, Anthropic or Google, whichever you picked in Settings, over an encrypted connection and straight from your browser. They use the API key you paste in; the key is stored in your browser only and is sent only to that provider. Each AI tool page says this before you start.',
          'The feedback and feature-request forms send your message and the email address you type to our inbox through Cloudflare. The site is delivered by Cloudflare, which sees ordinary request data such as your IP address. We use Cloudflare Web Analytics, which does not use cookies, to count page visits. If tips are switched on, payment happens on Dodo Payments, not on this site.',
          'No other tool sends your file or its text anywhere.',
        ],
      },
      {
        h: 'Good to know',
        p: [
          'Browser memory is the real limit. Very large files can be slow or fail on a phone. Your browser, its extensions and any cloud-synced download folder are outside our control, so for highly sensitive files use a device you trust.',
          'You can check all of this yourself: open your browser’s developer tools, watch the Network tab while you merge two PDFs, and see that no file is sent.',
        ],
      },
    ],
    faq: [
      { q: 'Does iDuckPDF upload my PDF?', a: 'No, not for any tool except the AI ones. Everything else runs in your browser tab. The AI tools send the PDF’s text to the AI provider you picked, using your own API key.' },
      { q: 'Which PDF library does iDuckPDF use?', a: 'pdf-lib builds and edits files, pdf.js reads and renders them, and Tesseract.js does OCR. All are open source and run in your browser.' },
      { q: 'Is there a file size limit?', a: 'The site sets none. Your device’s memory is the limit, so very large files can be slow or fail, especially on a phone.' },
      { q: 'Does iDuckPDF keep a copy of my files?', a: 'No. We never receive them, so there is nothing to keep, delete or hand over.' },
      { q: 'Who runs iDuckPDF?', a: 'Basic App Company. You can reach the team at hello@iduckpdf.com.' },
    ],
    related: ['merge', 'compress', 'redact'],
    reviewed: REVIEWED,
  },
];

export const LANDING_SLUGS = LANDINGS.map((l) => l.slug);
export const landingBySlug = (slug: string) => LANDINGS.find((l) => l.slug === slug);
