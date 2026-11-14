import type { Landing } from './landingTypes';
import { REVIEWED } from './landingTypes';

/**
 * Comparison pages. Facts here come from the other products' own public pages, checked on CHECKED, with the page linked as the source.
 * If a claim could not be confirmed on those pages, the table says so instead of guessing. Re-check before changing the date.
 */
const CHECKED = '2026-11-14';
const NOT_STATED = 'Not covered on the pages we checked';

export const COMPARE_PAGES: Landing[] = [
  {
    slug: 'iduckpdf-vs-ilovepdf',
    kind: 'compare',
    title: 'iDuckPDF vs iLovePDF: Free PDF Tools Compared',
    description: 'A fair comparison of iDuckPDF and iLovePDF: where files are processed, sign-up, free limits and ads, with sources and the date we checked.',
    h1: 'iDuckPDF vs iLovePDF',
    answer:
      'The main difference is where the work happens. iDuckPDF processes almost every file inside your browser, so it is not uploaded, and it has no sign-up, ads or watermark. iLovePDF processes files on its servers and keeps them for up to two hours. iLovePDF offers more formats and apps.',
    sections: [
      {
        h: 'What this comparison is',
        p: [
          'We make iDuckPDF, so read this with that in mind. Every statement about iLovePDF below comes from its own public pages, linked under Sources, and was checked on ' + CHECKED + '. Where we could not confirm something, the table says so rather than guessing. Products change; check their pages before you decide.',
        ],
      },
      {
        h: 'Where iLovePDF is the better choice',
        p: [
          'iLovePDF lists tools iDuckPDF does not have, including PDF to PDF/A and PDF to Markdown, plus desktop apps for Mac and Windows, mobile apps, workflows and a developer API. If you need those, or you convert complex Word documents where exact layout matters, a server-based converter can do better than a browser tab.',
          'iDuckPDF’s Word, Excel and PowerPoint conversions run in the browser with a simplified layout, and its OCR covers seven Latin-script languages. It has no team features, workflows or apps yet.',
        ],
      },
      {
        h: 'Where iDuckPDF is the better choice',
        p: ['If you do not want to upload a PDF at all, for example a contract, a bank statement or an ID, a tool that runs in your browser means the file never leaves your device. iDuckPDF also asks for no account and sets no document limit.'],
      },
    ],
    table: {
      caption: 'Side by side (checked ' + CHECKED + ')',
      head: ['', 'iDuckPDF', 'iLovePDF'],
      rows: [
        ['Where files are processed', 'In your browser. Only the 5 AI tools send text, to the AI provider you choose with your own key.', 'On iLovePDF’s servers. Its FAQ says files are kept for a maximum of 2 hours, then removed.'],
        ['Account', 'None needed.', 'Login and sign-up are offered; the free plan processes “a limited number of documents”.'],
        ['Free limits', 'None set by the site. Your device’s memory is the limit.', 'Limited document processing on the Free plan; per-tool file-size caps are listed on its pricing page and are higher on paid plans.'],
        ['Ads', 'None.', 'Its pricing page lists an ad-free service as a Premium feature.'],
        ['Watermark', 'None.', NOT_STATED],
        ['Price', 'Free; optional tips.', 'Free plan plus paid Premium plans.'],
        ['Apps', 'Website only for now.', 'Desktop (Mac, Windows) and mobile (iOS, Android) apps are advertised on its site.'],
      ],
      note: '“Not covered on the pages we checked” means we could not confirm it from the pages linked below, not that it is false.',
    },
    faq: [
      { q: 'Is iDuckPDF a copy of iLovePDF?', a: 'No. It is a separate product built on open-source PDF libraries that run in the browser. The two cover many of the same everyday tasks.' },
      { q: 'Is iLovePDF safe?', a: 'It states that files are encrypted in transit and deleted after at most two hours. Whether that is enough depends on how sensitive your file is. With iDuckPDF the file is never uploaded, which avoids the question for most tools.' },
      { q: 'Which is better for scanned documents?', a: 'Both offer OCR. iDuckPDF’s OCR runs in your browser and supports seven Latin-script languages; for other scripts a server-based tool may be better.' },
      { q: 'Can I use both?', a: 'Yes. Use iDuckPDF for private files and quick jobs, and a server-based converter when you need a feature we do not have.' },
    ],
    related: ['merge', 'compress', 'word-to-pdf'],
    reviewed: CHECKED,
    sources: [
      { label: 'iLovePDF pricing', url: 'https://www.ilovepdf.com/pricing' },
      { label: 'iLovePDF FAQ (file handling)', url: 'https://www.ilovepdf.com/help/faq' },
      { label: 'iLovePDF home page (tool list)', url: 'https://www.ilovepdf.com/' },
    ],
  },
  {
    slug: 'iduckpdf-vs-smallpdf',
    kind: 'compare',
    title: 'iDuckPDF vs Smallpdf: Free PDF Tools Compared',
    description: 'A fair comparison of iDuckPDF and Smallpdf: where files are processed, sign-up, free limits and tracking, with sources and the date we checked.',
    h1: 'iDuckPDF vs Smallpdf',
    answer:
      'iDuckPDF runs almost every tool in your browser with no upload, no account and no limit set by the site. Smallpdf processes files on its servers, limits document downloads on its free plan, and sells Pro for unlimited use. Smallpdf offers more advanced editing and apps.',
    sections: [
      {
        h: 'What this comparison is',
        p: ['We make iDuckPDF, so read this with that in mind. Statements about Smallpdf come from its own public pages, linked under Sources, and were checked on ' + CHECKED + '. Where we could not confirm something, the table says so.'],
      },
      {
        h: 'Where Smallpdf is the better choice',
        p: [
          'Smallpdf advertises a mobile app, AI features, text editing and OCR on its Pro plan, a Sign.com e-signature service, and team accounts with centralised billing. If you work in a team that needs shared accounts, or you want its editor, a paid server-based service is built for that.',
          'iDuckPDF does not edit existing text in a PDF, and has no accounts, team features or apps yet.',
        ],
      },
      {
        h: 'Where iDuckPDF is the better choice',
        p: ['For private documents you would rather not upload, and for quick jobs with no sign-up or download cap, a tool that runs on your own device is simpler. All 54 iDuckPDF tools are free.'],
      },
    ],
    table: {
      caption: 'Side by side (checked ' + CHECKED + ')',
      head: ['', 'iDuckPDF', 'Smallpdf'],
      rows: [
        ['Where files are processed', 'In your browser. Only the 5 AI tools send text, to the AI provider you choose with your own key.', 'On Smallpdf’s servers. Its privacy policy says data may be stored temporarily during processing on Cloudflare-managed servers in the US or Europe and on Hetzner servers in the EU.'],
        ['How long files are kept', 'Never received by us.', 'Its privacy policy says files are deleted within one hour for users on a user account, unless you save them to your storage.'],
        ['Account', 'None needed.', 'A free account is offered; its Free plan has “limited document downloads”.'],
        ['Free limits', 'None set by the site.', 'Limited downloads and limited access on Free; its Pro plan lists unlimited use of its 30+ tools.'],
        ['Ads and tracking', 'No ads. Cookie-free page statistics only.', 'Its privacy policy describes advertising and analytics cookies and pixels used when you consent.'],
        ['Watermark', 'None.', NOT_STATED],
        ['Price', 'Free; optional tips.', 'Free plan plus paid Pro and Team plans.'],
      ],
      note: '“Not covered on the pages we checked” means we could not confirm it from the pages linked below, not that it is false.',
    },
    faq: [
      { q: 'Does Smallpdf keep my files?', a: 'Its privacy policy says it deletes files within one hour for users on an account unless you save them to its storage. Read the policy for the full detail.' },
      { q: 'Is iDuckPDF really free?', a: 'Yes. There is no paywall, daily limit or watermark. Optional tips help cover hosting.' },
      { q: 'Which has more tools?', a: 'Smallpdf advertises 30+ tools; iDuckPDF has 54. Counting tools is not the same as quality, and Smallpdf has features, such as text editing, that iDuckPDF lacks.' },
      { q: 'Can iDuckPDF replace Smallpdf?', a: 'For merge, split, compress, sign, convert, OCR and similar jobs, often yes. For team accounts, text editing or apps, not yet.' },
    ],
    related: ['compress', 'sign', 'pdf-to-word'],
    reviewed: CHECKED,
    sources: [
      { label: 'Smallpdf pricing', url: 'https://smallpdf.com/pricing' },
      { label: 'Smallpdf privacy policy', url: 'https://smallpdf.com/privacy' },
    ],
  },
  {
    slug: 'best-free-pdf-tools-without-upload',
    kind: 'compare',
    title: 'Best Free PDF Tools Without Upload',
    description: 'Ways to merge, split, compress and sign PDFs without uploading them: a browser tool, desktop apps and self-hosted options, and how to verify any of them.',
    h1: 'Best free PDF tools without upload',
    answer:
      'To work on a PDF without uploading it, use a tool that runs on your own device: a browser tool like iDuckPDF, a desktop app such as PDFsam Basic or PDF Arranger, or a self-hosted server like Stirling-PDF. Then check the Network tab in your browser to confirm that nothing is sent.',
    sections: [
      {
        h: 'Why it matters',
        p: ['Contracts, bank statements, medical papers and ID scans are the files people hesitate to upload to a stranger’s server. Not uploading removes the question of how long a copy is kept and who can reach it.'],
      },
      {
        h: 'How to check any tool yourself',
        p: [
          'Open the tool, press F12 to open your browser’s developer tools, choose the Network tab, then process a file. If the tool really works locally you will see no request carrying your file. A tool that uploads shows a large POST request the size of your PDF.',
          'Also read what the tool says about its AI features: converting or summarising with AI usually means text leaves your device.',
        ],
      },
      {
        h: 'The honest caveats',
        p: [
          'Desktop apps need installing and updating. Self-hosting needs a server you run and secure. A browser tool depends on your device’s memory, and the exact layout of complex Office conversions can differ from server-based converters.',
          'We make iDuckPDF, so we have listed it first because it is the one we know best. The alternatives below are well-known open-source projects; their own pages are linked.',
        ],
      },
    ],
    table: {
      caption: 'Options that keep your file on your own machine (checked ' + CHECKED + ')',
      head: ['', 'How it runs', 'Cost', 'Good for'],
      rows: [
        ['iDuckPDF', 'In your browser tab; nothing to install. The 5 AI tools send text to the AI provider you choose.', 'Free', 'Everyday tools: merge, split, compress, sign, OCR and Office conversions'],
        ['PDFsam Basic', 'Desktop app. Its site calls it free and open source.', 'Free', 'Splitting and merging PDF files'],
        ['PDF Arranger', 'Desktop app (Python and GTK). Its project page describes merging, splitting, rotating, cropping and rearranging pages.', 'Free', 'Reorganising pages, mainly on Linux'],
        ['Stirling-PDF', 'Open-source platform you can run on your own computer or server, so files stay with you.', 'Free to self-host', 'Teams that want a full tool set on their own infrastructure'],
      ],
      note: 'Sources are the projects’ own pages, linked below.',
    },
    faq: [
      { q: 'Does “runs in your browser” mean offline?', a: 'Not exactly. The page and its scripts are downloaded from the website, then the work happens on your device. You can confirm in the Network tab that no file is uploaded.' },
      { q: 'Are online PDF tools safe?', a: 'It depends on the tool. Server-based tools upload your file and say how long they keep it. Tools that run locally avoid the upload. Read the privacy statement either way.' },
      { q: 'What about password-protected PDFs?', a: 'Open them locally with the password you know, then remove or keep the protection. iDuckPDF’s Unlock PDF tool never sends the password anywhere.' },
      { q: 'Which is the easiest option?', a: 'A browser tool, because there is nothing to install.' },
    ],
    related: ['merge', 'split', 'lock'],
    reviewed: CHECKED,
    sources: [
      { label: 'PDFsam', url: 'https://pdfsam.org/' },
      { label: 'PDF Arranger on GitHub', url: 'https://github.com/pdfarranger/pdfarranger' },
      { label: 'Stirling-PDF on GitHub', url: 'https://github.com/Stirling-Tools/Stirling-PDF' },
    ],
  },
];
