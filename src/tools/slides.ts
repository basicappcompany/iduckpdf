import { PDFDocument } from 'pdf-lib';
import type { ToolDef } from '../engine/types';
import { Fonts } from '../engine/layout';
import { pptxToPdf } from '../engine/pptx';
import { writeDocx, type DocBlock } from '../engine/docxwrite';
import { buildLines, buildParagraphs, detectTable, pagePieces, splitColumns, type Line } from '../engine/pdftext';
import { openPdfjs } from '../engine/render';
import { ToolError, baseName, needOne, pdfOut, save } from '../engine/util';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Lines to Word blocks: runs of two or more multi-cell lines become tables, everything else flows as paragraphs. */
function blocksFromLines(lines: Line[], tables: boolean): DocBlock[] {
  const out: DocBlock[] = [];
  const bodySize = (() => { const s = lines.map((l) => l.h).sort((a, b) => a - b); return s[Math.floor(s.length / 2)] || 10; })();
  let i = 0;
  const flushParas = (ls: Line[]) => {
    for (const p of buildParagraphs(ls)) {
      const ratio = p.size / bodySize;
      out.push({
        kind: 'p', text: p.text, style: p.heading === 1 ? 'Heading1' : p.heading === 2 ? 'Heading2' : p.heading === 3 ? 'Heading3' : 'Normal',
        bold: p.heading ? undefined : p.bold, italic: p.italic || undefined, size: p.heading || Math.abs(ratio - 1) < 0.12 ? undefined : Math.round(p.size), list: !!p.list,
      });
    }
  };
  let pending: Line[] = [];
  while (i < lines.length) {
    if (tables && lines[i].cells.length >= 2) {
      let j = i;
      while (j < lines.length && lines[j].cells.length >= 2) j++;
      if (j - i >= 2) {
        if (pending.length) { flushParas(pending); pending = []; }
        out.push({ kind: 'table', rows: detectTable(lines.slice(i, j)).rows });
        i = j;
        continue;
      }
    }
    pending.push(lines[i]);
    i++;
  }
  if (pending.length) flushParas(pending);
  return out;
}

export const slideTools: ToolDef[] = [
  {
    id: 'pdf-to-word',
    name: 'PDF to Word',
    short: 'Get an editable .docx from a PDF.',
    desc: 'Convert a PDF into an editable Word document (.docx): text in reading order, headings, lists and simple tables. It runs in your browser, so the PDF is never uploaded. It works on PDFs with a text layer, and the result is a clean starting point rather than a pixel copy.',
    category: 'convert',
    icon: '📝',
    keywords: ['word', 'docx', 'editable', 'convert to word', 'pdf to word', 'pdf to docx', 'edit pdf text'],
    inputs: [{ key: 'files', label: 'PDF with selectable text', accept: 'pdf', hint: 'Scanned PDFs have no text layer: run them through Read scans (OCR) first.' }],
    options: [{ key: 'tables', type: 'toggle', label: 'Turn tables into Word tables', default: true, hint: 'Rows of text lined up in columns become table rows.' }],
    runLabel: 'Convert to Word',
    tips: ['You get the text, headings, lists and simple tables. Pictures, exact fonts, colours and page layout are not carried over.', 'Pages become Word pages in the same order. Two-column pages are read column by column.', 'Check the result against the PDF, especially tables and anything near a page break.'],
    faq: [
      { q: 'Is my PDF uploaded?', a: 'No. The PDF is read and the Word file is built inside your browser tab.' },
      { q: 'Will the Word file look like the PDF?', a: 'It keeps the content and structure, not the exact look. Fonts, colours, pictures and precise layout are not reproduced. It is a clean, editable starting point.' },
      { q: 'Why is my result empty?', a: 'A scanned PDF is a picture of text. Run it through Read scans (OCR) first, then convert the searchable copy.' },
      { q: 'Does it keep pictures?', a: 'No, only text and tables. Add pictures again in Word, or use PDF to pictures to save them.' },
    ],
    status: 'ready',
    async run({ files, opts, progress }) {
      const f = needOne(files.files);
      const view = await openPdfjs(await f.bytes());
      const n: number = view.numPages;
      const blocks: DocBlock[] = [];
      let size = { width: 595.28, height: 841.89 };
      let withText = 0;
      for (let i = 1; i <= n; i++) {
        progress(0.05 + (0.85 * (i - 1)) / n, `Reading page ${i} of ${n}…`);
        const { pieces, width, height } = await pagePieces(await view.getPage(i));
        if (i === 1) size = { width, height };
        if (!pieces.length) continue;
        withText++;
        if (blocks.length) blocks.push({ kind: 'pagebreak' });
        for (const group of splitColumns(pieces, width)) blocks.push(...blocksFromLines(buildLines(group), !!opts.tables));
      }
      if (!withText) throw new ToolError('This PDF has no text layer to read, so it is probably a scan. Run it through Read scans (OCR) first, then convert the result.');
      progress(0.95, 'Building the Word file…');
      const bytes = await writeDocx(blocks, size, baseName(f.name));
      const tables = blocks.filter((b) => b.kind === 'table').length;
      return { files: [{ name: `${baseName(f.name)}.docx`, mime: DOCX_MIME, bytes }], notes: [`${n} page${n === 1 ? '' : 's'} read${tables ? `, ${tables} table${tables === 1 ? '' : 's'} found` : ''}. Pictures and exact layout are not carried over: check the result against the PDF.`] };
    },
  },
  {
    id: 'pptx-to-pdf',
    name: 'PowerPoint to PDF',
    short: 'Slides to PDF.',
    desc: 'Turn a PowerPoint presentation (.pptx) into a PDF with one page per slide, at the slide’s own size: shapes, pictures, tables and text with their sizes, colours and bullets. It runs in your browser, so the file is never uploaded. Charts, SmartArt and effects are not reproduced.',
    category: 'convert',
    icon: '📽️',
    keywords: ['powerpoint', 'pptx', 'slides', 'presentation', 'ppt', 'powerpoint to pdf', 'keynote', 'deck'],
    inputs: [{ key: 'files', label: 'PowerPoint presentation (.pptx)', accept: 'any', hint: 'Older .ppt files: open them in PowerPoint and save as .pptx first.' }],
    runLabel: 'Convert to PDF',
    tips: ['Shapes, pictures (PNG and JPEG), tables and text are drawn where they sit on the slide.', 'Charts, SmartArt, gradients, shadows, animations and speaker notes are not reproduced, and fonts become standard PDF fonts.', 'For an exact copy of a designed deck, use PowerPoint’s own Save as PDF.'],
    faq: [
      { q: 'Is my presentation uploaded?', a: 'No. The .pptx is read and converted inside your browser tab. Nothing is sent to a server.' },
      { q: 'Will it look exactly like PowerPoint?', a: 'Not always. It reproduces the positions, colours, pictures, tables and text, but not charts, SmartArt, effects or custom fonts. Designed decks can look different. For a perfect copy, use PowerPoint’s own Save as PDF.' },
      { q: 'What about hidden slides and notes?', a: 'Hidden slides are left out, as when you print from PowerPoint, and speaker notes are not included.' },
      { q: 'Does it support .ppt, .key and Google Slides?', a: 'Only .pptx. Export Keynote or Google Slides as .pptx first, or open older .ppt files in PowerPoint and save as .pptx.' },
    ],
    status: 'ready',
    async run({ files, progress }) {
      const f = needOne(files.files, 'a PowerPoint presentation');
      progress(0.1, 'Reading the presentation…');
      const doc = await PDFDocument.create();
      const fonts = new Fonts(doc);
      const stats = await pptxToPdf(await f.bytes(), doc, fonts, (i, n) => progress(0.1 + (0.85 * (i - 1)) / n, `Drawing slide ${i} of ${n}…`));
      doc.setTitle(baseName(f.name));
      doc.setProducer('iDuckPDF');
      const notes = [`${stats.slides} slide${stats.slides === 1 ? '' : 's'}${stats.pictures ? `, ${stats.pictures} picture${stats.pictures === 1 ? '' : 's'}` : ''}. Charts, SmartArt, effects and notes are not reproduced.`];
      if (stats.unsupported) notes.push(`${stats.unsupported} chart, diagram or special shape was drawn as a plain box.`);
      if (stats.skippedPictures) notes.push(`${stats.skippedPictures} picture${stats.skippedPictures === 1 ? '' : 's'} in a format that is not supported (such as EMF, GIF or SVG) left out.`);
      if (stats.replaced) notes.push(`${stats.replaced} character${stats.replaced === 1 ? '' : 's'} outside Western European text could not be drawn and became “?”.`);
      return { files: [pdfOut(`${baseName(f.name)}.pdf`, await save(doc))], notes };
    },
  },
];
