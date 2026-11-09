/**
 * Privacy policy and terms, written to match what the site actually does today
 * (no accounts, no cookies, files processed in the browser, Cloudflare Web Analytics for cookie-free page statistics, optional tips via Dodo Payments).
 * If any of that changes (another analytics service, a backend for Office conversions, accounts), update this file in the same change.
 */
import { SITE } from '../config';

export type LegalSection = { h: string; p: string[] };
export type LegalDoc = { title: string; seoTitle: string; description: string; intro: string; sections: LegalSection[] };

export const PRIVACY: LegalDoc = {
  title: 'Privacy policy',
  seoTitle: 'Privacy Policy',
  description: 'How iDuckPDF handles your data: PDFs stay in your browser for most tools, no accounts or cookies, cookie-free page statistics, plus how AI tools and tips work.',
  intro: 'Short version: you do not need an account, most tools never upload your PDF, we do not set cookies or use ad trackers, and the only analytics is cookie-free page statistics. The details are below so you can check.',
  sections: [
    {
      h: 'Who we are',
      p: [`${SITE.name} (${SITE.domain}) is operated by ${SITE.operator}. In this policy, “we” and “us” mean ${SITE.operator}. You can reach us at the contact address shown at the bottom of this page.`],
    },
    {
      h: 'Your PDF files',
      p: [
        'For almost every tool, your PDF is opened and rewritten inside your browser tab by JavaScript running on your own device. The file is not sent to our servers, and closing the tab discards it.',
        'The exceptions are the AI tools, “Summarise with AI” and “Ask your PDF”. They only work if you add your own API key. When you run one, the text of the PDF you chose is sent straight from your browser to the AI provider you picked (OpenAI, Anthropic or Google). That provider handles it under its own terms and privacy policy. We do not receive that text. Each AI tool tells you this before you start.',
        'The other tools, including signing, form filling, passwords, OCR and the Word, Excel, PowerPoint and web page conversions, also run entirely in your browser. For OCR, your browser downloads the recognition engine and the language data from this site the first time you use it, then reads the scan on your device.',
        'Because the work happens on your device, your browser, its extensions and any cloud-synced folders are outside our control. For highly sensitive documents, use a device you trust.',
      ],
    },
    {
      h: 'What is stored in your browser',
      p: [
        'The site keeps a few small settings in your browser’s local storage, on your device only: your light or dark theme choice, the tools you used recently, any feature votes you cast, and, if you add one, your AI provider and API key.',
        'Your API key is never sent to us. It is used only to call the provider you chose, from your browser. You can remove it any time in Settings, or by clearing the site’s data in your browser.',
        'We do not set cookies.',
      ],
    },
    {
      h: 'What our hosting sees',
      p: [
        'The site is delivered by Cloudflare. Like any web host, Cloudflare processes technical request data (such as your IP address, the page requested, and browser type) to deliver pages, keep the service secure and prevent abuse. We do not run advertising or tracking scripts, and we do not combine this data with anything else. See Cloudflare’s privacy policy for how it handles request data.',
        'The pages load all code and the PDF engine from iduckpdf.com itself. The only third-party script is the analytics script described next.',
      ],
    },
    {
      h: 'Analytics',
      p: [
        'We use Cloudflare Web Analytics to count visits and see which pages are popular, where visitors come from (for example a search engine or another website), roughly which country they are in, what browser and device type they use, and how fast pages load. Cloudflare adds a small script from static.cloudflareinsights.com to the pages to do this.',
        'According to Cloudflare, Web Analytics does not use cookies or local storage and does not fingerprint visitors or track them across websites. It only learns that a page was opened. It never sees your PDFs, what is in them, or which files you choose. We use the figures only to understand and improve the site. A content blocker in your browser stops the script, and the site works exactly the same without it.',
      ],
    },
    {
      h: 'Tips and payments',
      p: [
        'If tips are switched on and you choose to leave one, you are sent to a checkout page run by Dodo Payments, who act as the seller of record and process the payment. They collect the payment details and any billing information they need; we never see or store your card details. Dodo Payments’ own privacy policy and terms apply to that transaction. We may receive limited confirmation details about the payment, such as the amount.',
      ],
    },
    {
      h: 'Feedback and feature requests',
      p: [
        'The feedback and feature-request pages open your own email app with a pre-filled message. Nothing is sent until you press send in your mail app. If you email us, we use your message and address only to read and reply to it, and keep it only as long as it is useful.',
      ],
    },
    {
      h: 'Children',
      p: ['iDuckPDF is a general-purpose tool and is not directed at children under 13. We do not knowingly collect personal information from anyone.'],
    },
    {
      h: 'Changes to this policy',
      p: ['If we add anything that changes how data is handled, for example a different analytics service or a server-based conversion tool, we will update this page and the “last updated” date before it goes live, and say clearly which tools are affected.'],
    },
    {
      h: 'Contact',
      p: ['Questions about privacy? Email us at the address shown below. We read everything.'],
    },
  ],
};

export const TERMS: LegalDoc = {
  title: 'Terms of use',
  seoTitle: 'Terms of Use',
  description: 'The simple terms for using iDuckPDF: free PDF tools provided as-is, your responsibility for your files, acceptable use, and how tips and refunds work.',
  intro: 'These are the plain terms for using iDuckPDF. By using the site you agree to them. If you do not agree, please do not use it.',
  sections: [
    {
      h: 'What the service is',
      p: [`${SITE.name} is a free collection of PDF tools that mostly run in your web browser. There is no account and no paywall. The service is operated by ${SITE.operator}, and “we” and “us” in these terms mean ${SITE.operator}. We may add, change or remove tools at any time.`],
    },
    {
      h: 'Your files and your responsibility',
      p: [
        'You keep all rights to your files. We do not claim any ownership of them and, for most tools, never receive them (see the privacy policy).',
        'You are responsible for having the right to use, edit and share the documents you work on, and for keeping your own backups. Always keep the original file: tools can produce unexpected output, especially on damaged, unusual or very large PDFs.',
        '“Black out text” and the cleanup tools are aids, not guarantees. Check the result yourself before sharing a document that contains sensitive information.',
      ],
    },
    {
      h: 'Acceptable use',
      p: ['Do not use the site to break the law, to infringe someone else’s rights, to attack or overload the service or its hosting, or to try to access anything you are not meant to. Do not use scripts to hammer the donation or other server endpoints.'],
    },
    {
      h: 'AI tools and third-party services',
      p: ['The AI tools use an API key you provide and send text to the provider you choose. Your use of that provider is governed by its terms, and any costs they charge are between you and them. AI output can be wrong or incomplete, so check anything important. We do not control third-party services and are not responsible for them.'],
    },
    {
      h: 'Tips and refunds',
      p: [
        'Tips are optional, voluntary payments that support hosting and development. They do not buy a product, a licence, support or any feature, because everything on the site is free either way. Payments are processed by Dodo Payments as the seller of record, and their terms apply to the transaction.',
        'If you tipped by mistake or in the wrong amount, email us within 14 days of the payment with the details and we will arrange a refund through the payment provider.',
      ],
    },
    {
      h: 'No warranty',
      p: ['The service is provided “as is” and “as available”, without warranties of any kind, to the extent the law allows. We do not promise that it will be uninterrupted, error-free, or that any tool will work for every file.'],
    },
    {
      h: 'Limit of liability',
      p: ['To the extent the law allows, we are not liable for any loss or damage arising from your use of the service, including lost or corrupted files or data, or indirect or consequential loss. Nothing in these terms limits any right you have under law that cannot be limited.'],
    },
    {
      h: 'Open-source components',
      p: [`${SITE.name} is built with open-source libraries, including pdf-lib, @cantoo/pdf-lib, pdf.js, JSZip and Tesseract.js, each under its own licence. The ${SITE.name} name, logo and original content belong to ${SITE.operator}.`],
    },
    {
      h: 'Changes',
      p: ['We may update these terms. The “last updated” date shows the current version, and continuing to use the site after a change means you accept it.'],
    },
    {
      h: 'Contact',
      p: ['Questions about these terms? Email us at the address shown below.'],
    },
  ],
};
