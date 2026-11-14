import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import type { ToolDef } from '../engine/types';
import { MM, ToolError, baseName, colorOf, expandTokens, loadDoc, needOne, parsePages, pdfOut, safeText, save } from '../engine/util';
import { processImage } from '../engine/imaging';

export const colorOptions = [
  { value: 'black', label: 'Black' },
  { value: 'gray', label: 'Gray' },
  { value: 'red', label: 'Red' },
  { value: 'blue', label: 'Blue' },
  { value: 'green', label: 'Green' },
];

export const positions = [
  { value: 'bc', label: 'Bottom centre' },
  { value: 'br', label: 'Bottom right' },
  { value: 'bl', label: 'Bottom left' },
  { value: 'tc', label: 'Top centre' },
  { value: 'tr', label: 'Top right' },
  { value: 'tl', label: 'Top left' },
];

/** x,y for text whose baseline starts at (x,y) given a 2-letter position code. */
export function place(pos: string, pw: number, ph: number, w: number, size: number, m: number): { x: number; y: number } {
  const v = pos[0] === 't' ? ph - m - size : m;
  const h = pos[1] === 'l' ? m : pos[1] === 'r' ? pw - m - w : (pw - w) / 2;
  return { x: h, y: v };
}

export const markupTools: ToolDef[] = [
  {
    id: 'page-numbers',
    name: 'Number the pages',
    short: 'Add page numbers anywhere on the page.',
    desc: 'Stamp “Page 3 of 12” (or any format you like) on every page, or just some of them.',
    category: 'markup',
    icon: '🔢',
    keywords: ['pagination', 'numbering', 'page number', 'footer', 'count pages'],
    inputs: [{ key: 'files', label: 'PDF', accept: 'pdf' }],
    options: [
      { key: 'pos', type: 'select', label: 'Position', default: 'bc', options: positions },
      { key: 'format', type: 'text', label: 'Format', default: 'Page {n} of {total}', hint: 'Use {n} for the number and {total} for the page count.' },
      { key: 'start', type: 'number', label: 'First number', default: 1 },
      { key: 'size', type: 'number', label: 'Font size', default: 10 },
      { key: 'margin', type: 'number', label: 'Distance from edge (mm)', default: 10 },
      { key: 'color', type: 'select', label: 'Colour', default: 'black', options: colorOptions },
      { key: 'pages', type: 'text', label: 'Only these pages (blank = all)', placeholder: 'e.g. 2-last' },
    ],
    runLabel: 'Add numbers',
    tips: ['Skip a cover page by entering 2-last in “Only these pages”, and set “First number” to 1 or 2 as you like.'],
    status: 'ready',
    async run({ files, opts }) {
      const f = needOne(files.files);
      const doc = await loadDoc(f);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const total = doc.getPageCount();
      const idx = parsePages(opts.pages, total);
      const size = Math.max(4, Number(opts.size) || 10);
      const m = Math.max(0, Number(opts.margin) || 0) * MM;
      const start = Math.floor(Number(opts.start) || 1);
      idx.forEach((i, k) => {
        const p = doc.getPage(i);
        const { width, height } = p.getSize();
        const text = safeText(font, expandTokens(String(opts.format || '{n}'), { n: start + k, total, file: baseName(f.name) }));
        const w = font.widthOfTextAtSize(text, size);
        const { x, y } = place(opts.pos, width, height, w, size, m);
        p.drawText(text, { x, y, size, font, color: colorOf(opts.color) });
      });
      return { files: [pdfOut(`${baseName(f.name)}-numbered.pdf`, await save(doc))], notes: [`Numbered ${idx.length} page${idx.length === 1 ? '' : 's'}.`] };
    },
  },
  {
    id: 'text-watermark',
    name: 'Text watermark',
    short: 'Stamp DRAFT, CONFIDENTIAL or anything else.',
    desc: 'Place a big, translucent text stamp across your pages: centred, or tiled over the whole page.',
    category: 'markup',
    icon: '💧',
    keywords: ['watermark', 'stamp', 'draft', 'confidential', 'copy', 'sample'],
    inputs: [{ key: 'files', label: 'PDF', accept: 'pdf' }],
    options: [
      { key: 'text', type: 'text', label: 'Text', default: 'CONFIDENTIAL' },
      { key: 'size', type: 'number', label: 'Size', default: 64 },
      { key: 'angle', type: 'select', label: 'Angle', default: '45', options: [{ value: '45', label: 'Diagonal' }, { value: '0', label: 'Horizontal' }, { value: '90', label: 'Vertical' }] },
      { key: 'opacity', type: 'select', label: 'Opacity', default: '0.25', options: [{ value: '0.1', label: '10%' }, { value: '0.25', label: '25%' }, { value: '0.4', label: '40%' }, { value: '0.6', label: '60%' }] },
      { key: 'color', type: 'select', label: 'Colour', default: 'gray', options: colorOptions },
      { key: 'mode', type: 'select', label: 'Layout', default: 'center', options: [{ value: 'center', label: 'One, centred' }, { value: 'tile', label: 'Tiled' }] },
      { key: 'pages', type: 'text', label: 'Only these pages (blank = all)' },
    ],
    runLabel: 'Stamp now',
    status: 'ready',
    async run({ files, opts }) {
      const f = needOne(files.files);
      const text0 = String(opts.text || '').trim();
      if (!text0) throw new ToolError('Type the watermark text first.');
      const doc = await loadDoc(f);
      const font = await doc.embedFont(StandardFonts.HelveticaBold);
      const text = safeText(font, text0);
      const idx = parsePages(opts.pages, doc.getPageCount());
      const ang = Number(opts.angle);
      const rad = (ang * Math.PI) / 180;
      const opacity = Number(opts.opacity) || 0.25;
      for (const i of idx) {
        const p = doc.getPage(i);
        const { width: pw, height: ph } = p.getSize();
        let size = Math.max(6, Number(opts.size) || 64);
        const maxLen = ang === 0 ? pw * 0.9 : ang === 90 ? ph * 0.9 : Math.min(pw, ph) * 1.15;
        if (opts.mode === 'center' && font.widthOfTextAtSize(text, size) > maxLen) size = (size * maxLen) / font.widthOfTextAtSize(text, size);
        const w = font.widthOfTextAtSize(text, size);
        const h = size * 0.7;
        const draw = (cx: number, cy: number) => {
          // pdf-lib rotates about the text origin, so move the origin to keep the text centred on (cx,cy)
          const x = cx - ((w / 2) * Math.cos(rad) - (h / 2) * Math.sin(rad));
          const y = cy - ((w / 2) * Math.sin(rad) + (h / 2) * Math.cos(rad));
          p.drawText(text, { x, y, size, font, color: colorOf(opts.color), opacity, rotate: degrees(ang) });
        };
        if (opts.mode === 'tile') {
          const sx = Math.max(w, h) + size * 2;
          const sy = size * 4;
          let n = 0;
          for (let y = sy / 2, r = 0; y < ph + sy && n < 400; y += sy, r++) {
            for (let x = (r % 2 ? sx / 2 : 0); x < pw + sx && n < 400; x += sx, n++) draw(x, y);
          }
        } else draw(pw / 2, ph / 2);
      }
      return { files: [pdfOut(`${baseName(f.name)}-watermarked.pdf`, await save(doc))], notes: [`Watermarked ${idx.length} page${idx.length === 1 ? '' : 's'}.`] };
    },
  },
  {
    id: 'image-watermark',
    name: 'Logo or image stamp',
    short: 'Place a logo or signature image on pages.',
    desc: 'Put a PNG or JPG, such as a logo, stamp or scanned signature, on your pages with adjustable size and transparency.',
    category: 'markup',
    icon: '🖼️',
    keywords: ['logo', 'signature', 'stamp', 'image watermark', 'seal', 'overlay'],
    inputs: [
      { key: 'pdf', label: 'PDF', accept: 'pdf' },
      { key: 'img', label: 'Image to place', accept: 'image' },
    ],
    options: [
      { key: 'scale', type: 'number', label: 'Width as % of the page', default: 30 },
      { key: 'opacity', type: 'select', label: 'Opacity', default: '1', options: [{ value: '1', label: '100%' }, { value: '0.6', label: '60%' }, { value: '0.3', label: '30%' }, { value: '0.15', label: '15%' }] },
      { key: 'pos', type: 'select', label: 'Position', default: 'c', options: [{ value: 'c', label: 'Centre' }, ...positions] },
      { key: 'pages', type: 'text', label: 'Only these pages (blank = all)' },
    ],
    runLabel: 'Place now',
    status: 'ready',
    async run({ files, opts }) {
      const f = needOne(files.pdf);
      const imgFile = needOne(files.img, 'an image');
      const doc = await loadDoc(f);
      const pr = await processImage(imgFile, { maxSide: 0, quality: 0.92, mode: 'color' });
      const img = pr.kind === 'png' ? await doc.embedPng(pr.bytes) : await doc.embedJpg(pr.bytes);
      const idx = parsePages(opts.pages, doc.getPageCount());
      const pct = Math.min(100, Math.max(2, Number(opts.scale) || 30)) / 100;
      for (const i of idx) {
        const p = doc.getPage(i);
        const { width: pw, height: ph } = p.getSize();
        const w = pw * pct;
        const h = (img.height / img.width) * w;
        const m = 20;
        let x = (pw - w) / 2;
        let y = (ph - h) / 2;
        if (opts.pos !== 'c') {
          x = opts.pos[1] === 'l' ? m : opts.pos[1] === 'r' ? pw - m - w : x;
          y = opts.pos[0] === 't' ? ph - m - h : m;
        }
        p.drawImage(img, { x, y, width: w, height: h, opacity: Number(opts.opacity) || 1 });
      }
      return { files: [pdfOut(`${baseName(f.name)}-stamped.pdf`, await save(doc))], notes: [`Placed the image on ${idx.length} page${idx.length === 1 ? '' : 's'}.`] };
    },
  },
  {
    id: 'headers-footers',
    name: 'Headers & footers',
    short: 'Repeat text at the top and bottom of pages.',
    desc: 'Add left, centre and right text to the header and footer of every page. Use {n}, {total}, {date} and {file} as placeholders.',
    category: 'markup',
    icon: '🏷️',
    keywords: ['header', 'footer', 'running title', 'date', 'file name', 'confidential footer'],
    inputs: [{ key: 'files', label: 'PDF', accept: 'pdf' }],
    options: [
      { key: 'hl', type: 'text', label: 'Header, left' },
      { key: 'hc', type: 'text', label: 'Header, centre' },
      { key: 'hr', type: 'text', label: 'Header, right' },
      { key: 'fl', type: 'text', label: 'Footer, left', default: '{file}' },
      { key: 'fc', type: 'text', label: 'Footer, centre', default: '' },
      { key: 'fr', type: 'text', label: 'Footer, right', default: '{n} / {total}' },
      { key: 'size', type: 'number', label: 'Font size', default: 9 },
      { key: 'margin', type: 'number', label: 'Distance from edge (mm)', default: 10 },
      { key: 'color', type: 'select', label: 'Colour', default: 'gray', options: colorOptions },
      { key: 'pages', type: 'text', label: 'Only these pages (blank = all)' },
    ],
    runLabel: 'Apply now',
    status: 'ready',
    async run({ files, opts }) {
      const f = needOne(files.files);
      const doc = await loadDoc(f);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const total = doc.getPageCount();
      const idx = parsePages(opts.pages, total);
      const size = Math.max(4, Number(opts.size) || 9);
      const m = Math.max(0, Number(opts.margin) || 0) * MM;
      const slots: [string, string][] = [['hl', 'tl'], ['hc', 'tc'], ['hr', 'tr'], ['fl', 'bl'], ['fc', 'bc'], ['fr', 'br']];
      let drawn = 0;
      idx.forEach((i) => {
        const p = doc.getPage(i);
        const { width, height } = p.getSize();
        for (const [key, pos] of slots) {
          const raw = String(opts[key] || '');
          if (!raw) continue;
          const text = safeText(font, expandTokens(raw, { n: i + 1, total, file: baseName(f.name) }));
          const w = font.widthOfTextAtSize(text, size);
          const { x, y } = place(pos, width, height, w, size, m);
          p.drawText(text, { x, y, size, font, color: colorOf(opts.color) });
          drawn++;
        }
      });
      if (!drawn) throw new ToolError('Fill in at least one header or footer box.');
      return { files: [pdfOut(`${baseName(f.name)}-headed.pdf`, await save(doc))], notes: [`Applied to ${idx.length} page${idx.length === 1 ? '' : 's'}.`] };
    },
  },
  {
    id: 'add-text',
    name: 'Write on a PDF',
    short: 'Place a line of text anywhere on a page.',
    desc: 'Type a note, a date or a name and put it exactly where you want it, using percentages from the top-left corner.',
    category: 'markup',
    icon: '✍️',
    keywords: ['annotate', 'type on pdf', 'fill in', 'text box', 'note', 'edit text', 'sign'],
    inputs: [{ key: 'files', label: 'PDF', accept: 'pdf' }],
    options: [
      { key: 'text', type: 'textarea', label: 'Text' },
      { key: 'x', type: 'number', label: 'Distance from left (%)', default: 10 },
      { key: 'y', type: 'number', label: 'Distance from top (%)', default: 10 },
      { key: 'size', type: 'number', label: 'Font size', default: 14 },
      { key: 'color', type: 'select', label: 'Colour', default: 'black', options: colorOptions },
      { key: 'pages', type: 'text', label: 'Pages', default: '1', hint: 'Use “all” for every page.' },
    ],
    runLabel: 'Write it',
    tips: ['This adds new text on top. It does not edit text that is already in the PDF.'],
    status: 'ready',
    async run({ files, opts }) {
      const f = needOne(files.files);
      const raw = String(opts.text || '');
      if (!raw.trim()) throw new ToolError('Type the text you want to place.');
      const doc = await loadDoc(f);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const idx = parsePages(opts.pages, doc.getPageCount());
      const size = Math.max(4, Number(opts.size) || 14);
      const lines = safeText(font, raw).split('\n');
      for (const i of idx) {
        const p = doc.getPage(i);
        const { width, height } = p.getSize();
        const x = (Math.min(100, Math.max(0, Number(opts.x) || 0)) / 100) * width;
        let y = height - (Math.min(100, Math.max(0, Number(opts.y) || 0)) / 100) * height - size;
        for (const ln of lines) {
          p.drawText(ln, { x, y, size, font, color: colorOf(opts.color) });
          y -= size * 1.25;
        }
      }
      return { files: [pdfOut(`${baseName(f.name)}-annotated.pdf`, await save(doc))], notes: [`Wrote on ${idx.length} page${idx.length === 1 ? '' : 's'}.`] };
    },
  },
];

// rgb is re-exported so tool files can share it without another import
export { rgb };
