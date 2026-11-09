// Plain-English how-to guides. Each links to the tool that does the job.
export type Guide = {
  slug: string;
  title: string; // H1
  seoTitle: string;
  description: string;
  tool: string; // main tool id
  related: string[];
  intro: string; // answer-first paragraph
  sections: { h: string; p: string[] }[];
  faq: { q: string; a: string }[];
};

export const GUIDES: Guide[] = [
  {
    slug: 'how-to-merge-pdf-files',
    title: 'How to merge PDF files into one',
    seoTitle: 'How to Merge PDF Files into One (Free, No Software)',
    description: 'Step-by-step: combine several PDFs into a single document, in the right order, without installing anything.',
    tool: 'merge',
    related: ['reorder', 'compress', 'page-numbers'],
    intro: 'You can merge PDFs in about thirty seconds: add the files, put them in order, and download one combined PDF. You do not need Acrobat or any installed software.',
    sections: [
      { h: 'Merge PDFs in four steps', p: ['Open the Merge PDFs tool. Drag your files in, or choose them from your device.', 'Use the up and down arrows to arrange them. The final document follows this order from top to bottom.', 'Press Merge now. Download merged.pdf when it finishes.'] },
      { h: 'Check the result before you send it', p: ['Scroll through the merged file once. Look for pages in the wrong order and for pages of different sizes. If sizes differ, the “Change page size” tool can make them uniform.', 'Finished files can be numbered with “Number the pages”, so a reader never loses their place across the joined documents.'] },
      { h: 'If the merged file is too large', p: ['Combining files adds their sizes together. Run the result through “Make it smaller”. Start with the Gentle level, which keeps text selectable, and only move to stronger levels if you need to.'] },
    ],
    faq: [
      { q: 'Does merging lower the quality?', a: 'No. Pages are copied as they are, so text and images are unchanged.' },
      { q: 'Can I merge a password-protected PDF?', a: 'Not directly. Remove the password first with the Remove a password tool (you need to know it), then merge.' },
    ],
  },
  {
    slug: 'how-to-make-a-pdf-smaller',
    title: 'How to make a PDF smaller for email',
    seoTitle: 'How to Make a PDF Smaller (Under Email Size Limits)',
    description: 'Why PDFs get big, what actually shrinks them, and how to hit an email or upload size limit.',
    tool: 'compress',
    related: ['restyle', 'pdf-to-images', 'images-to-pdf'],
    intro: 'To make a PDF smaller, reduce the weight of its images. Files made of text are already compact, but scans and photo-heavy documents can shrink dramatically when their pictures are compressed.',
    sections: [
      { h: 'Why a PDF is big', p: ['Nearly every large PDF is large because of images: scanned pages, photos, or high-resolution graphics. A 40-page text report may be 200 KB. The same report scanned at high quality can be 40 MB.'] },
      { h: 'A sensible order to try', p: ['Start with the Gentle level in “Make it smaller”. It tidies the file structure and keeps text selectable. If the file is still too large, try Balanced, then Strong.', 'Balanced, Strong and Tiny turn each page into a compressed picture. That works well for scans, but the text is no longer selectable, so keep your original.'] },
      { h: 'Typical email limits', p: ['Many mail services cap attachments around 20 to 25 MB, and some upload forms accept far less. Check the limit first, then compress only as much as you need. Smaller than necessary just costs sharpness.'] },
      { h: 'When it will not shrink', p: ['A PDF that is mostly text may barely change. In that case the tool tells you the file is already well packed and returns the smallest version it found, rather than making it bigger.'] },
    ],
    faq: [
      { q: 'Will compressing ruin the quality?', a: 'Gentle mode does not change visible quality. Stronger levels lower picture resolution, which is what saves space.' },
      { q: 'What resolution do the levels use?', a: 'Balanced renders at about 130 dpi, Strong at about 96 dpi, and Tiny at 72 dpi.' },
    ],
  },
  {
    slug: 'how-to-remove-pages-from-a-pdf',
    title: 'How to remove pages from a PDF',
    seoTitle: 'How to Remove Pages from a PDF (Free, Online)',
    description: 'Delete blank, duplicate or sensitive pages from a PDF and keep everything else, in a few clicks.',
    tool: 'remove-pages',
    related: ['extract-pages', 'reorder', 'split'],
    intro: 'To remove pages from a PDF, list the page numbers to delete, such as 2, 5-7, and the tool returns the document without them. Your original stays untouched.',
    sections: [
      { h: 'Delete pages', p: ['Open “Delete pages” and add your PDF. In the box, type the pages to remove. Ranges work (5-7), and so do words like odd, even and last.', 'Press Delete now and download the trimmed file. The notes tell you how many pages remain.'] },
      { h: 'Keep instead of delete', p: ['If you only want a few pages out of many, it is quicker to use “Pull out pages”. Type the pages you want to keep, and everything else is dropped.'] },
      { h: 'Sensitive pages', p: ['Deleting a page removes it from the new file. If you also need to hide specific words on pages you keep, use the redaction tool rather than deleting.'] },
    ],
    faq: [
      { q: 'Can I delete all pages?', a: 'No. A PDF needs at least one page.' },
      { q: 'Does it change the page numbers inside the document?', a: 'Page numbers printed in the content stay as they were. You can add fresh numbers afterwards with “Number the pages”.' },
    ],
  },
  {
    slug: 'how-to-split-a-pdf',
    title: 'How to split a PDF into separate files',
    seoTitle: 'How to Split a PDF into Separate Files',
    description: 'Cut a PDF by page ranges, every N pages, or one file per page, and download everything as a ZIP.',
    tool: 'split',
    related: ['extract-pages', 'merge', 'remove-pages'],
    intro: 'To split a PDF, choose a mode (page ranges, every N pages, or one file per page) and press Split. Each piece becomes its own PDF, ready to download individually or as a ZIP.',
    sections: [
      { h: 'Split by ranges', p: ['Type ranges separated by commas. For example, 1-3, 4, 5- creates three files: pages 1 to 3, page 4 alone, and page 5 to the end.'] },
      { h: 'Split every N pages', p: ['If your PDF is a stack of equal-length documents, such as three-page forms, choose “Every N pages” and enter 3.'] },
      { h: 'One file per page', p: ['Choose “One file per page” to get a separate PDF for every page. This suits scanned stacks and statements that contain one item per page.'] },
    ],
    faq: [
      { q: 'How do I download all the pieces?', a: 'Use “Download all (ZIP)” on the results screen.' },
      { q: 'Is there a limit?', a: 'One split can create up to 400 files.' },
    ],
  },
  {
    slug: 'how-to-add-page-numbers-to-a-pdf',
    title: 'How to add page numbers to a PDF',
    seoTitle: 'How to Add Page Numbers to a PDF (Any Position)',
    description: 'Number PDF pages at the bottom or top, start from any number, and skip the cover page.',
    tool: 'page-numbers',
    related: ['headers-footers', 'merge', 'text-watermark'],
    intro: 'To add page numbers to a PDF, pick a position and a format like “Page {n} of {total}”, then press Add numbers. You can start at any number and number only some pages.',
    sections: [
      { h: 'Add the numbers', p: ['Open “Number the pages” and add your PDF. Choose where the numbers go (bottom centre is the usual choice), the format, the font size and the colour.', 'Press Add numbers and download the result.'] },
      { h: 'Skip the cover page', p: ['Type 2-last in “Only these pages”. The cover stays unnumbered. Set “First number” to 1 if the second page should be page 1, or 2 if it should count the cover.'] },
      { h: 'Add more than numbers', p: ['For a document title, a date or a confidentiality line, use “Headers & footers”. It supports the same placeholders and lets you put text on the left, centre and right.'] },
    ],
    faq: [
      { q: 'Can I use Roman numerals?', a: 'Not yet. Numbers are Arabic digits.' },
      { q: 'Which placeholders exist?', a: '{n} is the page number, {total} is the page count. Headers & footers also offers {date} and {file}.' },
    ],
  },
  {
    slug: 'how-to-redact-a-pdf-properly',
    title: 'How to redact a PDF properly',
    seoTitle: 'How to Redact a PDF Properly (So Text Cannot Be Recovered)',
    description: 'Why drawing a black box is not redaction, and how to hide text in a PDF so it cannot be copied out.',
    tool: 'redact',
    related: ['properties', 'flatten', 'inspect'],
    intro: 'Real redaction removes the hidden text, not just the way it looks. Drawing a black rectangle over words leaves the words in the file, where anyone can still select and copy them. Flattening the page to an image removes them.',
    sections: [
      { h: 'The common mistake', p: ['Many people cover text with a black shape in a PDF editor and share the file. The text is still there underneath. Press Ctrl+A, copy, and paste into a text editor, and the “hidden” words appear.'] },
      { h: 'How the Black out tool works', p: ['You type the words or patterns to hide, one per line. The tool finds each match, covers it with a black box, and saves every page as a picture. With no text layer left, nothing can be copied out of the result.'] },
      { h: 'Always check', p: ['Open the finished file and read every page. Text inside images, or a name split across two lines, may not be matched. Add those words to the list and run it again.'] },
      { h: 'Do not forget the metadata', p: ['Redacting the page does not touch document properties. Run “Clean & edit properties” to remove the author, software and any hidden metadata, and use “Inspect a PDF” to see what is stored.'] },
    ],
    faq: [
      { q: 'Does redaction make the file bigger?', a: 'It can, because pages become images. Run “Make it smaller” afterwards if needed.' },
      { q: 'Can I redact by pattern, such as phone numbers?', a: 'Yes. Turn on patterns and use a regular expression, for example \\d{3}-\\d{4}.' },
    ],
  },
  {
    slug: 'how-to-turn-photos-into-a-pdf',
    title: 'How to turn photos into a PDF',
    seoTitle: 'How to Turn Photos or Images into a PDF',
    description: 'Combine photos, screenshots and scans into one PDF on any device, with the pages in the order you want.',
    tool: 'images-to-pdf',
    related: ['scan-to-pdf', 'compress', 'merge'],
    intro: 'To turn photos into a PDF, add the images, put them in order, and press Make PDF. Each picture becomes one page, and large phone photos are shrunk by default so the file stays a sensible size.',
    sections: [
      { h: 'Make the PDF', p: ['Open “Photos to PDF” and add your pictures. JPG, PNG and WebP all work. Use the arrows to set the order.', 'Choose a page size: “Match each image” gives each page the picture’s own shape, while A4 or Letter centres each picture on a standard page with a margin.'] },
      { h: 'Scanning paper documents', p: ['For photos of paper pages, use “Scan to PDF” instead. It evens out lighting and offers clean grayscale or high-contrast black and white, which keeps text readable and the file small.'] },
      { h: 'Keep the size down', p: ['Leave “Shrink very large photos” on. Phone photos are often 10 MB each; limiting the longest side to 2200 pixels cuts that dramatically with no visible difference on screen.'] },
    ],
    faq: [
      { q: 'Can I mix JPG and PNG?', a: 'Yes. You can combine different image types in one PDF.' },
      { q: 'Can I add more pictures later?', a: 'Run Merge PDFs to combine the new PDF with the earlier one.' },
    ],
  },
  {
    slug: 'how-to-remove-metadata-from-a-pdf',
    title: 'How to remove metadata from a PDF',
    seoTitle: 'How to Remove Metadata from a PDF (Author, Software, Dates)',
    description: 'See what a PDF reveals about you and strip the author, software and hidden metadata before you share it.',
    tool: 'properties',
    related: ['inspect', 'redact', 'flatten'],
    intro: 'PDF metadata is information stored inside the file about who made it, with what software and when. To remove it, turn on “Remove all metadata” in the properties tool and download the cleaned file.',
    sections: [
      { h: 'What a PDF can reveal', p: ['A PDF usually records a title, an author name, the program that created it, and creation and modification dates. Some files also carry hidden XMP metadata with more detail.'] },
      { h: 'See before you clean', p: ['Run “Inspect a PDF” first. It lists the properties and flags anything worth removing, such as an author name or embedded comments.'] },
      { h: 'Strip it', p: ['Open “Clean & edit properties”, keep “Remove all metadata” on, and press Apply. The cleaned file has no title, author, software or dates, and the hidden XMP data is gone.'] },
      { h: 'What it does not remove', p: ['Names and details written in the visible pages are not metadata. Use the redaction tool for those. Comments and form answers can be removed with “Flatten forms”.'] },
    ],
    faq: [
      { q: 'Is metadata removal permanent?', a: 'In the new file, yes. Keep your original if you may need the metadata later.' },
      { q: 'Can I just change the title or author instead?', a: 'Yes. Turn off “Remove all metadata” and type the values you want.' },
    ],
  },
  {
    slug: 'are-online-pdf-tools-safe',
    title: 'Are online PDF tools safe? What to check',
    seoTitle: 'Are Online PDF Tools Safe? What to Check Before You Upload',
    description: 'How to tell whether a PDF tool uploads your files, what questions to ask, and how to check for yourself.',
    tool: 'inspect',
    related: ['properties', 'redact', 'flatten'],
    intro: 'Online PDF tools are safe or unsafe depending on one thing: where your file is processed. Some upload it to a server. Others do the work inside your browser, so the file is never sent. You can check which is which in under a minute.',
    sections: [
      { h: 'Two kinds of tools', p: ['Server-based tools upload your PDF, process it on their machines, and send a result back. Browser-based tools run the code on your own device and only download the page itself.', 'Neither is automatically bad. But if your document is sensitive, you should know which kind you are using.'] },
      { h: 'How to check for yourself', p: ['Open your browser’s developer tools, go to the Network tab, and use the tool. If you see your file being sent in a request, it is being uploaded. If the only traffic is the page loading, the work is happening locally.', 'Tools that work offline once loaded are almost certainly local.'] },
      { h: 'Honest caveats', p: ['“Runs in your browser” does not make a computer safe. Browser extensions, shared computers and cloud-synced folders are outside any website’s control. For highly sensitive files, use a device you trust.', 'Some features legitimately send data elsewhere. For example, AI summaries send text to an AI provider. A trustworthy tool says so before you start.'] },
      { h: 'Clean files before sharing', p: ['Whatever tool you use, strip metadata and remove hidden comments before sending a document outside your organisation. “Inspect a PDF” shows what is inside, and “Clean & edit properties” removes it.'] },
    ],
    faq: [
      { q: 'Does iDuckPDF upload my files?', a: 'Most tools run entirely in your browser tab. The AI tools are the exception: with your own key, the PDF’s text goes to the AI provider you choose, and the tool says so first.' },
      { q: 'What about files with passwords?', a: 'Yes. Add a password and Remove a password both run in your browser, so neither the file nor the password is uploaded. You do need to know a password to remove it.' },
    ],
  },
  {
    slug: 'how-to-password-protect-a-pdf',
    title: 'How to password protect a PDF',
    seoTitle: 'How to Password Protect a PDF (Free, AES-256)',
    description: 'Put a password on a PDF in under a minute, choose whether people can print or copy it, and keep the file private: all in your browser.',
    tool: 'lock',
    related: ['unlock', 'properties', 'redact'],
    intro: 'To password protect a PDF, add it to the Add a password tool, type a password twice and download the protected copy. The file is encrypted with AES-256 inside your browser, so neither the document nor the password is uploaded.',
    sections: [
      { h: 'Protect a PDF in four steps', p: ['Open Add a password and add your PDF. Type the password you want twice.', 'Decide what people may do after they open it: print, copy text and images, or edit and annotate. Printing and copying are allowed by default; editing is not.', 'Press Add password and download the new file. Open it once yourself to confirm that it asks for the password.'] },
      { h: 'Choose a password people cannot guess', p: ['Length matters more than tricks. A phrase of four or five unrelated words is far stronger than a short password with a symbol in it. Do not reuse a password you use elsewhere.', 'Send the password by a different route from the file: the file by email, the password by message or phone.'] },
      { h: 'What the permission boxes really do', p: ['Printing, copying and editing limits are honoured by most PDF viewers, but they are a courtesy. Someone with the file can often get around them. Only the open-password stops people reading the document.'] },
      { h: 'Keep the original and the password', p: ['The tool saves a new file and leaves yours untouched. We cannot recover a forgotten password, because it never leaves your browser. Keep the original somewhere safe, and store the password in a password manager.'] },
    ],
    faq: [
      { q: 'How strong is the encryption?', a: 'AES-256, the strongest standard PDF encryption. The password you choose decides how hard it is to break.' },
      { q: 'Will Adobe Reader and phones open it?', a: 'Yes. Acrobat, Preview, Chrome, Edge, Firefox and current phone viewers open AES-256 PDFs. Very old software may not.' },
      { q: 'Can I remove the password later?', a: 'Yes, with the Remove a password tool, as long as you know the password.' },
    ],
  },
  {
    slug: 'how-to-remove-a-password-from-a-pdf',
    title: 'How to remove a password from a PDF',
    seoTitle: 'How to Remove a Password from a PDF (When You Know It)',
    description: 'Unlock a PDF you have the password for so it opens without one, and lift print or copy restrictions. Free, in your browser, nothing uploaded.',
    tool: 'unlock',
    related: ['lock', 'merge', 'compress'],
    intro: 'To remove a password from a PDF, add it to the Remove a password tool, type the password and download the unlocked copy. This works only when you know the password: the tool does not guess or crack anything.',
    sections: [
      { h: 'Unlock a PDF in three steps', p: ['Open Remove a password and add the protected file.', 'Type the password. If the file opens without one but blocks printing or copying, leave the box empty.', 'Press Remove password and download the copy. It opens in any viewer without asking for anything.'] },
      { h: 'Two kinds of PDF password', p: ['An open-password is asked for when you open the file. A permissions password is set by the author to restrict printing, copying or editing, and the file opens normally. This tool handles both: an open-password needs to be typed in, a permissions-only file needs nothing.'] },
      { h: 'If you have forgotten the password', p: ['There is no honest shortcut. Ask whoever sent you the file, or look for the original version before it was protected. A tool that promises to open any protected file for you is either not telling you everything or is sending your document to a server.'] },
      { h: 'Only unlock what you may use', p: ['Removing a password does not change who owns a document. Unlock files that are yours, or that you have permission to use. The unlocked copy is open to anyone, so store it with care.'] },
    ],
    faq: [
      { q: 'Does this work without the password?', a: 'Only for files that already open without one (restrictions only). It cannot open a file that needs a password you do not have.' },
      { q: 'Is the password sent anywhere?', a: 'No. The file is decrypted inside your browser tab.' },
      { q: 'Does it change the content?', a: 'Pages, text and images are kept as they are. Bookmarks and form fields are not carried over to the unlocked copy.' },
    ],
  },
  {
    slug: 'how-to-sign-a-pdf',
    title: 'How to sign a PDF without printing it',
    seoTitle: 'How to Sign a PDF Online Without Printing (Free)',
    description: 'Draw, type or upload your signature, drag it into place and download the signed PDF. Works on a phone or computer, with nothing uploaded.',
    tool: 'sign',
    related: ['fill', 'image-watermark', 'lock'],
    intro: 'To sign a PDF without printing it, open the Sign a PDF tool, add the document, draw or type your signature, drag it where it belongs and download the signed copy. It takes about a minute, works on phones, and nothing is uploaded.',
    sections: [
      { h: 'Sign a PDF in four steps', p: ['Open Sign a PDF and add your document. Make your signature: draw it with a finger or mouse, type your name in a handwriting style, or upload a photo of your signature on white paper.', 'Use Prev and Next to find the right page. Drag the signature to the signature line and pull the corner handle, or use the size slider, until it fits.', 'Choose whether it goes on this page only, every page (handy for initials), or just the first or last page. Press Sign now and download the result.'] },
      { h: 'Getting a clean signature', p: ['A photo of a signature on plain white paper works best. Turn on “Remove the white background” so only the ink is placed on the document, not a white box around it. A thick felt-tip pen scans better than a thin ballpoint.'] },
      { h: 'Is it a legal signature?', p: ['The tool places a visual electronic signature, which is accepted for many everyday documents. It is not a certificate-based digital signature that proves who signed and detects later changes. If a contract or authority requires one, ask what they accept.'] },
      { h: 'Protect the signed copy', p: ['A signature image can be copied by anyone who has the file. Add a password with Add a password before you share a signed document widely, and keep the unsigned original.'] },
    ],
    faq: [
      { q: 'Does my signature get uploaded?', a: 'No. It is created and placed inside your browser tab.' },
      { q: 'Can I sign on my phone?', a: 'Yes. Draw with your finger and move or resize the signature by touch.' },
      { q: 'Can I add text such as a date next to my signature?', a: 'Yes. Use Write on a PDF on the signed copy to place the date or a name.' },
    ],
  },
  {
    slug: 'how-to-fill-in-a-pdf-form',
    title: 'How to fill in a PDF form online',
    seoTitle: 'How to Fill In a PDF Form Online (Free, Private)',
    description: 'Complete the text boxes, check boxes and drop-downs of a PDF form, save a copy, and make the answers permanent. Nothing leaves your browser.',
    tool: 'fill',
    related: ['sign', 'flatten', 'add-text'],
    intro: 'To fill in a PDF form online, open Fill in a form, add the PDF, type into the fields it lists and download the completed copy. Everything is done in your browser, so your answers are not uploaded.',
    sections: [
      { h: 'Fill in a form in three steps', p: ['Open Fill in a form and add the PDF. The tool reads the form and lists every text box, check box, drop-down and radio button it finds.', 'Complete the fields. Existing answers are already filled in, so you can also correct a form someone started.', 'Press Fill form and download. Tick “Make the answers permanent” if you want to send a copy that cannot be edited.'] },
      { h: 'If no fields appear', p: ['Many “forms” are just pictures of a form, with no interactive fields. The tool will say so. For those, use Write on a PDF to place text exactly where each answer belongs, then Sign a PDF for your signature.'] },
      { h: 'Make the answers permanent', p: ['An unflattened form can still be edited by whoever receives it. Flattening merges your answers into the page and removes the boxes. Keep an unflattened copy for yourself in case you need to change an answer.'] },
      { h: 'Special characters', p: ['Standard form fonts cover English and most European letters. If an answer contains characters the font cannot show, the tool tells you instead of producing a broken file.'] },
    ],
    faq: [
      { q: 'Does it work for any PDF form?', a: 'It works for PDFs with interactive form fields, the most common kind. Pictures of forms need Write on a PDF instead.' },
      { q: 'Are my answers sent anywhere?', a: 'No. Nothing leaves your browser tab.' },
      { q: 'Can I fill several copies of the same form?', a: 'Yes. Fill and download one, then add the original again for the next copy.' },
    ],
  },
];

export const guideBySlug = (slug: string) => GUIDES.find((g) => g.slug === slug);
