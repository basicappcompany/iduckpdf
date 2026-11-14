import type { Landing } from './landingTypes';
import { REVIEWED } from './landingTypes';

/** Compress-to-a-size pages and job-specific pages. Each one runs a real tool with a preset, and each says honestly when it cannot do the job. */
export const SIZE_AND_JOB_PAGES: Landing[] = [
  /* ---------- compress to a size ---------- */
  {
    slug: 'compress-pdf-to-100kb',
    kind: 'size',
    title: 'Compress PDF to 100 KB Online, Free',
    description: 'Shrink a PDF to under 100 KB in your browser. It tries the gentlest setting first and tells you honestly if 100 KB is out of reach. No sign-up.',
    h1: 'Compress PDF to 100 KB',
    answer:
      'To compress a PDF to under 100 KB, add the file and press Shrink now. The tool tries a gentle clean-up first, then turns pages into smaller and smaller pictures until the file fits. A few scanned pages can reach 100 KB; a long document usually cannot.',
    tool: 'compress',
    preset: { target: '100' },
    steps: ['Add your PDF. The target is already set to under 100 KB.', 'Press Shrink now and wait while it tries stronger settings, if it needs to.', 'Check the sizes in the result. If it says 100 KB was out of reach, split the PDF or delete pages and try again.'],
    sections: [
      {
        h: 'Good to know',
        p: [
          '100 KB is a very small budget, the kind of cap forms and exam or job portals set for an ID, a certificate or a signed page. Text-only PDFs of a page or two are often under it already. Scans and photo pages are the hard case.',
          'To hit the number the tool turns pages into low-resolution pictures (down to 48 dpi), so text can no longer be selected, and small print may look soft. Keep your original for anything you need to edit or search.',
          'When it is not reachable: as a rough guide, a picture page at the lowest settings is tens of kilobytes, so 100 KB fits only a handful of scanned pages. For a long file, split it, send only the pages that were asked for, or try the 500 KB or 1 MB versions.',
        ],
      },
    ],
    faq: [
      { q: 'Can every PDF be compressed to 100 KB?', a: 'No. A one-page scan usually can, a 30-page scan cannot. When the target is out of reach you get the smallest result and a note, never a silent failure.' },
      { q: 'Will the text still be selectable?', a: 'Only if the file already fits after the gentle clean-up. If pages had to become pictures, the text is no longer selectable.' },
      { q: 'Is my PDF uploaded?', a: 'No. The compression runs inside your browser tab, so the file stays on your device.' },
      { q: 'What if I need 200 KB instead?', a: 'Use the Compress PDF to 200 KB page, or open the Compress PDF tool and pick any other target.' },
      { q: 'Why is the result a little over 100 KB sometimes?', a: 'The tool stops at the first attempt that fits. If even the strongest attempt is a little over, it returns that smallest file and tells you the exact size.' },
    ],
    related: ['compress', 'split', 'remove-pages'],
    reviewed: REVIEWED,
  },
  {
    slug: 'compress-pdf-to-200kb',
    kind: 'size',
    title: 'Compress PDF to 200 KB Online, Free',
    description: 'Get a PDF under 200 KB for a form or portal upload. Runs in your browser, keeps text when it can, and says plainly when 200 KB is not reachable.',
    h1: 'Compress PDF to 200 KB',
    answer:
      'To compress a PDF to under 200 KB, add it and press Shrink now. iDuckPDF tidies the file first, which keeps text selectable, and only turns pages into pictures if that is not enough. Short documents usually fit; long scans may not.',
    tool: 'compress',
    preset: { target: '200' },
    steps: ['Add your PDF. The target is set to under 200 KB.', 'Press Shrink now. Stronger settings are tried only if the first ones are too big.', 'Download the result and compare the before and after sizes.'],
    sections: [
      {
        h: 'Good to know',
        p: [
          '200 KB is a common cap for application forms that ask for a proof document. It is roomy enough for a few pages of ordinary text and a few lightly compressed scans.',
          'If your PDF is already mostly text, you may find it fits without any change; the tool then returns your original rather than a worse copy.',
          'Pages that had to become pictures lose selectable text. If the portal needs searchable text, upload the text-based original or run OCR on the compressed file afterwards.',
        ],
      },
    ],
    faq: [
      { q: 'Does 200 KB keep my text selectable?', a: 'Often, for short text documents, because the gentle clean-up is tried first. Scans and photo pages have to become pictures to get this small.' },
      { q: 'My file is 6 MB. Will it reach 200 KB?', a: 'It depends on what is in it. Photo-heavy and scanned PDFs shrink a lot; PDFs with many text pages shrink little. The result note tells you what was achieved.' },
      { q: 'Can I compress several PDFs at once?', a: 'One file at a time. Run the page again for each file.' },
      { q: 'Is there a watermark or a limit?', a: 'No watermark and no daily limit set by the site. Very large files are limited only by your device’s memory.' },
    ],
    related: ['compress', 'ocr', 'merge'],
    reviewed: REVIEWED,
  },
  {
    slug: 'compress-pdf-to-300kb',
    kind: 'size',
    title: 'Compress PDF to 300 KB Online, Free',
    description: 'Reduce a PDF to under 300 KB without leaving your browser. Gentle settings first, stronger only if needed, and an honest note if it cannot fit.',
    h1: 'Compress PDF to 300 KB',
    answer:
      'To compress a PDF to under 300 KB, add the file and press Shrink now. The tool starts with the gentlest option and steps up only until the result fits, so you keep as much quality as possible. Very long or photo-heavy PDFs may still be too large.',
    tool: 'compress',
    preset: { target: '300' },
    steps: ['Add your PDF. The target is set to under 300 KB.', 'Press Shrink now.', 'Read the note under the result: it says what was achieved, or what the smallest size was.'],
    sections: [
      {
        h: 'Good to know',
        p: [
          'At 300 KB there is room for a short scanned document at modest resolution. The tool picks the least aggressive setting that fits, rather than always using the strongest one.',
          'Compression is lossy once pages become pictures: fine lines and small print soften. If a stamp or signature must stay crisp, try the 500 KB version instead.',
        ],
      },
    ],
    faq: [
      { q: 'How is this different from the 200 KB page?', a: 'The target is higher, so the tool can usually stop at a gentler setting and keep the pages sharper.' },
      { q: 'Can I get exactly 300 KB?', a: 'No. The result is under the target, not exactly on it, because the tool stops at the first setting that fits.' },
      { q: 'What if it says the target was out of reach?', a: 'The note gives the smallest size reached. Remove pages you do not need, split the file, or choose a bigger target.' },
      { q: 'Does it work on my phone?', a: 'Yes, in a modern phone browser. Large files can be slow on a phone because your device does the work.' },
    ],
    related: ['compress', 'remove-pages', 'extract-pages'],
    reviewed: REVIEWED,
  },
  {
    slug: 'compress-pdf-to-500kb',
    kind: 'size',
    title: 'Compress PDF to 500 KB Online, Free',
    description: 'Get a PDF under 500 KB in your browser. Keeps pages readable by using the gentlest setting that fits, and warns you if the file cannot get that small.',
    h1: 'Compress PDF to 500 KB',
    answer:
      'To compress a PDF to under 500 KB, add it and press Shrink now. Half a megabyte is enough for many scanned pages at readable quality, so the tool usually fits within its middle settings. Text stays selectable only when the gentle clean-up alone is enough.',
    tool: 'compress',
    preset: { target: '500' },
    steps: ['Add your PDF. The target is set to under 500 KB.', 'Press Shrink now and wait for the attempts to finish.', 'Download the file and open it to check the pages look right before you upload it anywhere.'],
    sections: [
      {
        h: 'Good to know',
        p: [
          '500 KB is a frequent limit on job and admission portals. Scans of a few pages typically fit with readable text; a 40-page scan will not.',
          'If you only need some pages, extract them first with Extract pages from PDF, then compress. Fewer pages is the most reliable way to reach a small target.',
        ],
      },
    ],
    faq: [
      { q: 'Is 500 KB enough for a readable scan?', a: 'For a few pages, usually yes. Look at the result at full size before you upload it.' },
      { q: 'Will it lower the page size or only the picture quality?', a: 'Only the picture resolution and quality. Page dimensions stay the same.' },
      { q: 'Can I undo the compression?', a: 'No, so keep your original. The compressed file is a new download.' },
      { q: 'Does it work on password-protected PDFs?', a: 'Unlock the PDF first with the Unlock PDF tool if you know the password, then compress it.' },
    ],
    related: ['compress', 'unlock', 'extract-pages'],
    reviewed: REVIEWED,
  },
  {
    slug: 'compress-pdf-to-1mb',
    kind: 'size',
    title: 'Compress PDF to 1 MB Online, Free',
    description: 'Reduce a PDF to under 1 MB without uploading it. Tries the gentle option first so text stays selectable, and tells you if 1 MB is not reachable.',
    h1: 'Compress PDF to 1 MB',
    answer:
      'To compress a PDF to under 1 MB, add the file and press Shrink now. One megabyte is generous: the gentle clean-up often does it for text documents, and the picture settings handle scans and photos. You see the before and after sizes straight away.',
    tool: 'compress',
    preset: { target: '1024' },
    steps: ['Add your PDF. The target is set to under 1 MB.', 'Press Shrink now.', 'If the result still looks too soft, use the 2 MB page for a sharper copy.'],
    sections: [
      {
        h: 'Good to know',
        p: [
          'Under 1 MB is a comfortable email and upload size. For a PDF with a handful of pages, the tool will often stay on the setting that keeps text selectable.',
          'Presentations exported with large photos and brochures with many images shrink the most. Documents that are already text only barely change, because there is little to remove.',
        ],
      },
    ],
    faq: [
      { q: 'Is 1 MB a good size for email?', a: 'It is well under typical attachment limits, which are usually measured in tens of megabytes, so it sends quickly and opens fast on a phone.' },
      { q: 'Why did my file barely shrink?', a: 'If it is mostly text it is already compact. Savings come from images.' },
      { q: 'Does the compressed file keep bookmarks and links?', a: 'When only the gentle clean-up is used, the structure is kept. When pages become pictures, links and bookmarks are not carried over.' },
      { q: 'What about colour?', a: 'Colour is kept. Use Grayscale PDF if you want a smaller black-and-white copy.' },
    ],
    related: ['compress', 'restyle', 'split'],
    reviewed: REVIEWED,
  },
  {
    slug: 'compress-pdf-to-2mb',
    kind: 'size',
    title: 'Compress PDF to 2 MB Online, Free',
    description: 'Reduce a PDF to under 2 MB in your browser with the least quality loss that works. Gentle settings first. No sign-up, no watermark.',
    h1: 'Compress PDF to 2 MB',
    answer:
      'To compress a PDF to under 2 MB, add it and press Shrink now. The tool keeps the best quality that fits, which for most documents means only a light clean-up or mild picture compression. It reports the exact before and after sizes.',
    tool: 'compress',
    preset: { target: '2048' },
    steps: ['Add your PDF. The target is set to under 2 MB.', 'Press Shrink now.', 'Download the result; the note says whether text is still selectable.'],
    sections: [
      {
        h: 'Good to know',
        p: [
          '2 MB gives the tool room to stay gentle. Many scans of ten or so pages fit using the balanced setting, which keeps them clearly readable.',
          'If the result is still over 2 MB, the PDF probably has very large images or hundreds of pages. Split it into parts with Split PDF and compress each part.',
        ],
      },
    ],
    faq: [
      { q: 'Will 2 MB keep my photos sharp?', a: 'Reasonably, for screen viewing. The tool picks the mildest setting that fits.' },
      { q: 'Can I raise the quality afterwards?', a: 'No. Compressed pictures cannot regain detail, so keep your original.' },
      { q: 'Is there a file size limit for the input?', a: 'The site sets none. Your device’s memory is the limit.' },
      { q: 'Where is the file processed?', a: 'In your browser. It is not uploaded.' },
    ],
    related: ['compress', 'split', 'merge'],
    reviewed: REVIEWED,
  },

  /* ---------- job-specific pages ---------- */
  {
    slug: 'compress-pdf-for-email',
    kind: 'job',
    title: 'Compress a PDF for Email, Free',
    description: 'Make a PDF small enough to attach to an email. Aims for under 2 MB in your browser, keeps text selectable when it can, and never uploads the file.',
    h1: 'Compress PDF for email',
    answer:
      'To compress a PDF for email, add it and press Shrink now. The target here is under 2 MB, which sends quickly and fits almost every mailbox. The tool uses the gentlest setting that works, so text stays selectable whenever possible, and nothing is uploaded.',
    tool: 'compress',
    preset: { target: '2048' },
    steps: ['Add the PDF you want to send.', 'Press Shrink now.', 'Attach the downloaded smaller copy to your email, and keep the original for yourself.'],
    sections: [
      {
        h: 'Good to know',
        p: [
          'Email providers set different attachment limits (Gmail’s is 25 MB, others differ), and a message grows by about a third when attachments are encoded for sending, so aim well under the limit. Under 2 MB is a safe habit.',
          'Several attachments add up. If the total is still too large, shrink each file, or send a link to a shared copy instead.',
          'Do not compress a file you are about to sign or print at high quality; use the original for that.',
        ],
      },
    ],
    faq: [
      { q: 'How small should an email attachment be?', a: 'Under your provider’s limit with room to spare. Under 2 MB per file is a safe target for most mailboxes and phones.' },
      { q: 'Will the person who opens it see a difference?', a: 'On screen, usually not. Printed at large sizes, a heavily compressed scan can look soft.' },
      { q: 'Can I protect the PDF too?', a: 'Yes. After compressing, use Password protect PDF and share the password separately.' },
      { q: 'Is the PDF sent anywhere by iDuckPDF?', a: 'No. It is processed in your browser and you attach the result yourself.' },
    ],
    related: ['compress', 'lock', 'merge'],
    reviewed: REVIEWED,
  },
  {
    slug: 'compress-pdf-for-form-upload',
    kind: 'job',
    title: 'Compress a PDF for a Form Upload, Free',
    description: 'Fit a PDF under a form or portal upload cap such as 200 KB or 500 KB. Runs in your browser, picks the gentlest setting, and warns when it cannot fit.',
    h1: 'Compress PDF for a form upload',
    answer:
      'To compress a PDF for a form upload, add it, choose the size the form asks for (200 KB is preselected), and press Shrink now. The tool finds the gentlest setting that fits and tells you straight away if the form’s limit is too small for your file.',
    tool: 'compress',
    preset: { target: '200' },
    steps: ['Read the form’s limit, for example “PDF up to 200 KB”.', 'Add your PDF and change the target to match that limit or the next size down.', 'Press Shrink now, then upload the downloaded file.'],
    sections: [
      {
        h: 'Good to know',
        p: [
          'Portals usually check the file size, the format and sometimes the number of pages, not the text. Choose the target just below the stated cap: some systems count a kilobyte as 1,000 bytes and some as 1,024.',
          'If the portal asks for one document per upload (ID proof, certificate, photo), Extract pages from PDF gives you only the page you need, which makes small caps far easier to reach.',
          'Open the compressed file before uploading. Check that names, numbers and dates are still readable at full size.',
        ],
      },
    ],
    faq: [
      { q: 'Which target should I pick?', a: 'The largest one that is still under the form’s limit, because bigger targets keep more quality.' },
      { q: 'The form rejected my file even though it is under the limit. Why?', a: 'Some forms also check the page size, the number of pages or the file name. Read the error message and the form’s instructions.' },
      { q: 'Can I compress a photo instead of a PDF?', a: 'This page is for PDFs. To turn a photo into a small PDF, use Photos to PDF first and then compress it here.' },
      { q: 'Is my document uploaded here?', a: 'No. Only the form you upload to later receives it.' },
    ],
    related: ['compress', 'extract-pages', 'images-to-pdf'],
    reviewed: REVIEWED,
  },
  {
    slug: 'combine-pdf-and-jpg',
    kind: 'job',
    title: 'Combine PDF and JPG into One File, Free',
    description: 'Put PDFs and JPG or PNG pictures into a single PDF, in the order you choose. Runs in your browser. No sign-up, no watermark.',
    h1: 'Combine PDF and JPG',
    answer:
      'To combine a PDF and JPG files, add them all, arrange them in the order you want with the arrows, and press the button. You get one PDF in which each picture becomes a page and the PDFs keep their pages. Nothing is uploaded.',
    tool: 'merge-pdf-images',
    steps: ['Add your PDFs and pictures together.', 'Use the arrows to put them in the final order.', 'Press the button and download the combined PDF.'],
    sections: [
      {
        h: 'Good to know',
        p: [
          'Each picture becomes one page. Phone photos are often rotated by the camera; check the result and fix a sideways page afterwards with Rotate PDF.',
          'Large photos make a large PDF. If the combined file is too big to send, run it through Compress PDF.',
          'Pages from PDFs are copied as they are, so text stays sharp and selectable. Pictures are embedded as pictures.',
        ],
      },
    ],
    faq: [
      { q: 'Which picture types work?', a: 'JPG, PNG and WebP pictures, alongside PDFs.' },
      { q: 'Can I mix many files?', a: 'Yes, as many as your device’s memory allows.' },
      { q: 'Will my JPGs lose quality?', a: 'They are placed into the PDF without being recompressed unless you compress the result afterwards.' },
      { q: 'Can I reorder after combining?', a: 'Yes, with Reorder PDF pages.' },
    ],
    related: ['merge-pdf-images', 'images-to-pdf', 'compress'],
    reviewed: REVIEWED,
  },
  {
    slug: 'remove-password-from-bank-statement-pdf',
    kind: 'job',
    title: 'Remove a Password from a Bank Statement PDF',
    description: 'Unlock a password-protected bank statement or e-Aadhaar PDF you own, using the password you know. Done in your browser; the password is never sent.',
    h1: 'Remove the password from a bank statement PDF',
    answer:
      'To remove the password from a bank statement or e-Aadhaar PDF, add the file, type the password you were given, and press Remove password. You get an unlocked copy that opens without it. This only works if you know the password, and only for files you are entitled to open.',
    tool: 'unlock',
    steps: ['Add the protected PDF.', 'Type the password. It is used on your device and never sent anywhere.', 'Press Remove password and download the unlocked copy.'],
    sections: [
      {
        h: 'Lawful use',
        p: ['Use this only for documents that belong to you or that you are allowed to open. This tool does not guess or break passwords: it needs the correct one, and it cannot unlock a file whose password you do not have.'],
      },
      {
        h: 'Good to know',
        p: [
          'Banks usually tell you the password pattern in the email or the statement settings, often built from a date of birth, a customer ID or part of an account number. Look in the message that delivered the file, or ask your bank.',
          'For an e-Aadhaar PDF from UIDAI, the password is the first four letters of the name in capitals followed by the year of birth. Check the instructions on the UIDAI download page if yours does not open.',
          'The unlocked copy has no password, so anyone who gets it can read it. Store it carefully, or protect it again with Password protect PDF using a password you choose.',
        ],
      },
    ],
    faq: [
      { q: 'Can you recover a forgotten password?', a: 'No. The tool needs the correct password and does not try to guess it.' },
      { q: 'Is my password or statement sent to iDuckPDF?', a: 'No. The file is unlocked inside your browser tab and the password is not stored or transmitted.' },
      { q: 'Why does it say the password is wrong?', a: 'Check the case of letters, spaces, and the pattern your bank uses. e-Aadhaar passwords use capital letters for the name part.' },
      { q: 'Does unlocking change my statement’s content?', a: 'No. The pages are copied into a new file without the password.' },
      { q: 'Is this legal?', a: 'Opening your own document with its password is normal. Do not use it on files you have no right to open; laws differ by country.' },
    ],
    related: ['unlock', 'lock', 'compress'],
    reviewed: REVIEWED,
    sources: [{ label: 'UIDAI (Aadhaar issuer)', url: 'https://uidai.gov.in/' }],
  },
  {
    slug: 'sign-pdf-on-phone',
    kind: 'job',
    title: 'Sign a PDF on Your Phone, Free',
    description: 'Sign a PDF on your phone by drawing with a finger, typing a name or uploading a signature image. Runs in your browser. No account, no watermark.',
    h1: 'Sign a PDF on your phone',
    answer:
      'To sign a PDF on your phone, open this page in your phone’s browser, add the file, draw your signature with a finger or type it, then drag it to the right spot on the page and download the signed PDF. There is no app to install and no account.',
    tool: 'sign',
    steps: ['Open the page in Safari or Chrome and add the PDF from your files or downloads.', 'Draw your signature with a finger, or type or upload one.', 'Drag and resize it onto the signature line, then download the signed PDF.'],
    sections: [
      {
        h: 'Good to know',
        p: [
          'This puts an image of your signature on the page, the same as signing a printout and scanning it. It is not a certificate-based digital signature, so for contracts that legally require one, check the requirement first.',
          'Turn your phone sideways for a wider drawing area. Zoom the page so the signature box is large before you place it.',
          'The finished file is saved to your phone’s downloads. The signature stays on your device while you work; it is not uploaded.',
        ],
      },
    ],
    faq: [
      { q: 'Is a drawn signature legally valid?', a: 'It depends on the document and country. Many everyday forms accept a drawn signature; some contracts require a certified digital signature. Ask the receiver if unsure.' },
      { q: 'Can I reuse my signature?', a: 'Draw it again each time; nothing is stored on our servers.' },
      { q: 'Can I sign several pages?', a: 'Yes. Place one signature per page, or run the tool again on the signed file.' },
      { q: 'Can I add the date and my name?', a: 'Yes, use Add text to PDF before or after signing.' },
    ],
    related: ['sign', 'add-text', 'fill'],
    reviewed: REVIEWED,
  },
];
