import { PDFDocument } from 'pdf-lib';
import type { PageSpec } from '../engine/layout';
import type { ToolDef } from '../engine/types';
import { Fonts, renderBlocks } from '../engine/layout';
import { htmlToBlocks } from '../engine/html';
import { docxToBlocks } from '../engine/docx';
import { MM, PAGE_SIZES, ToolError, baseName, needOne, pdfOut, save } from '../engine/util';

const sizeOptions = [
  { value: 'a4', label: 'A4' },
  { value: 'letter', label: 'US Letter' },
  { value: 'a5', label: 'A5' },
  { value: 'legal', label: 'US Legal' },
];

const pageFor = (size: string, margin = 20 * MM): PageSpec => {
  const [width, height] = PAGE_SIZES[size] || PAGE_SIZES.a4;
  return { width, height, margin: { top: margin, right: margin, bottom: margin, left: margin } };
};

function finish(doc: PDFDocument, title: string) {
  doc.setTitle(title);
  doc.setProducer('iDuckPDF');
  doc.setCreator('iDuckPDF');
}

export const officeTools: ToolDef[] = [
  {
    id: 'word-to-pdf',
    name: 'Word to PDF',
    short: 'Convert .docx documents to PDF.',
    desc: 'Turn a Word document (.docx) into a PDF: text, headings, lists, tables and pictures, with the document’s own page size and margins. It runs in your browser, so the document is never uploaded. The layout is simplified, so check the result.',
    category: 'convert',
    icon: '📄',
    keywords: ['word', 'docx', 'doc', 'microsoft', 'word to pdf', 'convert word', 'document to pdf', 'office'],
    inputs: [{ key: 'files', label: 'Word document (.docx)', accept: 'any', hint: 'Older .doc files: open them in Word and save as .docx first.' }],
    options: [{ key: 'size', type: 'select', label: 'Page size', default: 'doc', options: [{ value: 'doc', label: 'As in the document' }, ...sizeOptions] }],
    runLabel: 'Convert to PDF',
    tips: ['Text, headings, lists, tables, pictures and hyperlinks are kept.', 'Headers, footers, text boxes, shapes and charts are not reproduced, and fonts become standard PDF fonts, so line breaks can differ from Word.', 'For a pixel-perfect copy of a complex layout, use Word’s own Save as PDF.'],
    faq: [
      { q: 'Is my document uploaded?', a: 'No. The .docx is read and converted inside your browser tab. Nothing is sent to a server.' },
      { q: 'Will it look exactly like Word?', a: 'Not always. It keeps the content and structure, but uses standard PDF fonts and its own line layout, and it does not reproduce headers, footers, text boxes, shapes or charts. Complex or designed documents can look different.' },
      { q: 'What about non-English text?', a: 'Western European languages work. Other scripts (Greek, Cyrillic, Arabic, Hindi, Chinese, Japanese) cannot be drawn with the standard fonts and appear as question marks.' },
      { q: 'Does it support .doc files?', a: 'No, only .docx. Open an older .doc in Word and save it as .docx first.' },
    ],
    status: 'ready',
    async run({ files, opts, progress }) {
      const f = needOne(files.files, 'a Word document');
      progress(0.1, 'Reading the document…');
      const r = await docxToBlocks(await f.bytes());
      const doc = await PDFDocument.create();
      const fonts = new Fonts(doc);
      const spec = opts.size && opts.size !== 'doc' ? pageFor(String(opts.size)) : r.page;
      progress(0.4, 'Laying out the pages…');
      const pages = await renderBlocks(doc, fonts, r.blocks, spec);
      finish(doc, baseName(f.name));
      const bytes = await save(doc);
      const notes = [`${pages} page${pages === 1 ? '' : 's'}. The layout is simplified: headers, footers, text boxes and shapes are not reproduced.`];
      if (fonts.replaced) notes.push(`${fonts.replaced} character${fonts.replaced === 1 ? '' : 's'} outside Western European text could not be drawn and became “?”.`);
      if (r.skippedImages) notes.push(`${r.skippedImages} picture${r.skippedImages === 1 ? ' was' : 's were'} in a format that is not supported and left out.`);
      return { files: [pdfOut(`${baseName(f.name)}.pdf`, bytes)], notes };
    },
  },
  {
    id: 'html-to-pdf',
    name: 'Web page to PDF',
    short: 'Turn a saved web page or pasted HTML into a PDF.',
    desc: 'Convert an HTML file or pasted HTML into a PDF: headings, paragraphs, lists, tables, links and embedded pictures. It runs in your browser, so nothing is uploaded. A web page cannot be fetched by address from here, so save the page first (Ctrl+S) or paste its HTML.',
    category: 'convert',
    icon: '🌐',
    keywords: ['html', 'web page', 'webpage', 'website', 'print', 'save page as pdf', 'html to pdf', 'article'],
    inputs: [{ key: 'files', label: 'Saved web page (.html), optional', accept: 'any', min: 0, hint: 'In your browser press Ctrl+S and choose “Webpage, HTML only”, then add that file. Or paste HTML below.' }],
    options: [
      { key: 'html', type: 'textarea', label: 'Or paste HTML', placeholder: '<h1>Hello</h1><p>Paste the page’s HTML here.</p>' },
      { key: 'size', type: 'select', label: 'Page size', default: 'a4', options: sizeOptions },
      { key: 'text', type: 'select', label: 'Text size', default: '11', options: [{ value: '10', label: 'Small' }, { value: '11', label: 'Normal' }, { value: '13', label: 'Large' }] },
    ],
    runLabel: 'Convert to PDF',
    tips: ['The page’s style sheets and scripts are ignored: you get the content and structure, not the website’s design.', 'Pictures are included only when they are embedded in the HTML file itself (data: pictures). Linked pictures are left out.', 'For an exact copy of a page, use your browser’s Print, then Save as PDF.'],
    faq: [
      { q: 'Can I enter a web address?', a: 'No. A browser tab cannot read other websites for privacy and security reasons. Save the page (Ctrl+S) or paste its HTML.' },
      { q: 'Why does it not look like the website?', a: 'Style sheets and scripts are ignored. You get the text, headings, lists, tables and links in a clean layout, which suits articles and documentation.' },
      { q: 'Are pictures included?', a: 'Only pictures embedded in the HTML as data. Pictures linked from other files or sites are left out.' },
      { q: 'Is my HTML uploaded?', a: 'No. It is converted inside your browser tab.' },
    ],
    status: 'ready',
    async run({ files, opts, progress }) {
      const f = files.files?.[0];
      let html = String(opts.html || '').trim();
      if (f) html = new TextDecoder('utf-8').decode(await f.bytes());
      if (!html.trim()) throw new ToolError('Add a saved web page (.html) or paste some HTML first.');
      progress(0.2, 'Reading the page…');
      const size = Number(opts.text) || 11;
      const r = htmlToBlocks(html, size);
      if (!r.blocks.length) throw new ToolError('No readable content was found in that HTML.');
      const doc = await PDFDocument.create();
      const fonts = new Fonts(doc);
      progress(0.5, 'Laying out the pages…');
      const pages = await renderBlocks(doc, fonts, r.blocks, pageFor(String(opts.size || 'a4')));
      const name = f ? baseName(f.name) : 'page';
      finish(doc, name);
      const notes = [`${pages} page${pages === 1 ? '' : 's'}. Style sheets and scripts are ignored.`];
      if (fonts.replaced) notes.push(`${fonts.replaced} character${fonts.replaced === 1 ? '' : 's'} outside Western European text could not be drawn and became “?”.`);
      if (r.skippedImages) notes.push(`${r.skippedImages} linked picture${r.skippedImages === 1 ? '' : 's'} left out (only pictures embedded in the HTML are included).`);
      return { files: [pdfOut(`${name}.pdf`, await save(doc))], notes };
    },
  },
];
