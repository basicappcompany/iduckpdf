import { PDFDocument, PDFFont, StandardFonts, rgb } from 'pdf-lib';
import type { OutFile, PickedFile, ToolDef } from '../engine/types';
import { MM, PAGE_SIZES, ToolError, baseName, loadDoc, needOne, parsePages, pdfOut, safeText, save, wrapText } from '../engine/util';
import { processImage, type ImgMode } from '../engine/imaging';
import { canvasToBytes, openPdfjs, renderPage, textByPage } from '../engine/render';
import { zipFiles } from '../engine/zip';

async function buildImagePdf(
  list: PickedFile[],
  o: { size: string; orient: string; marginMm: number; shrink: boolean; mode: ImgMode },
  progress: (f: number, l?: string) => void,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < list.length; i++) {
    const pr = await processImage(list[i], { maxSide: o.shrink ? 2200 : 0, quality: 0.82, mode: o.mode });
    const img = pr.kind === 'png' ? await doc.embedPng(pr.bytes) : await doc.embedJpg(pr.bytes);
    let pw: number;
    let ph: number;
    let x = 0;
    let y = 0;
    let w = img.width;
    let h = img.height;
    if (o.size === 'fit') {
      const s = Math.min(1, 1000 / Math.max(w, h));
      pw = w = w * s;
      ph = h = h * s;
    } else {
      [pw, ph] = PAGE_SIZES[o.size] || PAGE_SIZES.a4;
      const landscape = o.orient === 'landscape' || (o.orient === 'auto' && img.width > img.height);
      if (landscape) [pw, ph] = [ph, pw];
      const m = o.marginMm * MM;
      const s = Math.min((pw - 2 * m) / w, (ph - 2 * m) / h);
      w *= s;
      h *= s;
      x = (pw - w) / 2;
      y = (ph - h) / 2;
    }
    doc.addPage([pw, ph]).drawImage(img, { x, y, width: w, height: h });
    progress((i + 1) / list.length, `Added ${list[i].name}`);
  }
  return save(doc);
}

const pageSizeOpts = [
  { value: 'fit', label: 'Match each image' },
  { value: 'a4', label: 'A4' },
  { value: 'letter', label: 'Letter' },
];

async function renderTextPdf(
  source: string,
  o: { markdown: boolean; size: string; fontSize: number; marginMm: number; face: string },
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const faces: Record<string, [StandardFonts, StandardFonts]> = {
    sans: [StandardFonts.Helvetica, StandardFonts.HelveticaBold],
    serif: [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold],
    mono: [StandardFonts.Courier, StandardFonts.CourierBold],
  };
  const [rn, bn] = faces[o.face] || faces.sans;
  const reg = await doc.embedFont(rn);
  const bold = await doc.embedFont(bn);
  const mono = await doc.embedFont(StandardFonts.Courier);
  const [pw, ph] = PAGE_SIZES[o.size] || PAGE_SIZES.a4;
  const m = o.marginMm * MM;
  const fs = o.fontSize;
  let page = doc.addPage([pw, ph]);
  let y = ph - m;
  const ensure = (h: number) => {
    if (y - h < m) {
      page = doc.addPage([pw, ph]);
      y = ph - m;
    }
  };
  const block = (text: string, font: PDFFont, size: number, indent = 0, color = rgb(0.1, 0.1, 0.1), before = 0) => {
    y -= before;
    const lines = wrapText(font, safeText(font, text), size, pw - 2 * m - indent);
    for (const ln of lines) {
      ensure(size * 1.4);
      y -= size * 1.15;
      if (ln) page.drawText(ln, { x: m + indent, y, size, font, color });
      y -= size * 0.25;
    }
  };
  const inline = (s: string) =>
    s
      .replace(/!?\[([^\]]*)\]\(([^)]+)\)/g, '$1 ($2)')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/(^|\s)\*([^*\s][^*]*)\*/g, '$1$2')
      .replace(/`([^`]+)`/g, '$1');

  let code = false;
  for (const raw of source.replace(/\r/g, '').split('\n')) {
    if (!o.markdown) {
      if (!raw.trim()) y -= fs * 0.8;
      else block(raw, reg, fs);
      continue;
    }
    const t = raw.trim();
    if (t.startsWith('```')) {
      code = !code;
      continue;
    }
    if (code) {
      block(raw || ' ', mono, fs - 1, 8, rgb(0.2, 0.2, 0.2));
      continue;
    }
    if (!t) {
      y -= fs * 0.8;
      continue;
    }
    const h = raw.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      block(inline(h[2]), bold, fs * [1.8, 1.45, 1.2][h[1].length - 1], 0, rgb(0.05, 0.05, 0.05), fs * 0.7);
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
      ensure(fs);
      y -= fs * 0.5;
      page.drawLine({ start: { x: m, y }, end: { x: pw - m, y }, thickness: 0.7, color: rgb(0.6, 0.6, 0.6) });
      y -= fs * 0.5;
      continue;
    }
    const b = raw.match(/^(\s*)[-*+]\s+(.*)$/);
    if (b) {
      block(`•  ${inline(b[2])}`, reg, fs, 10 + b[1].length * 4);
      continue;
    }
    const n = raw.match(/^(\s*)(\d+)[.)]\s+(.*)$/);
    if (n) {
      block(`${n[2]}.  ${inline(n[3])}`, reg, fs, 10 + n[1].length * 4);
      continue;
    }
    const q = raw.match(/^>\s?(.*)$/);
    if (q) {
      block(inline(q[1]), reg, fs, 14, rgb(0.4, 0.4, 0.4));
      continue;
    }
    block(inline(raw), reg, fs);
  }
  return save(doc);
}

export const convertTools: ToolDef[] = [
  {
    id: 'images-to-pdf',
    name: 'Photos to PDF',
    short: 'Turn JPG, PNG or WebP images into a PDF.',
    desc: 'Drop in your pictures, order them, and get one PDF. Big phone photos are shrunk by default so the file stays a sensible size.',
    category: 'convert',
    icon: '🖼️',
    keywords: ['jpg', 'jpeg', 'png', 'webp', 'image to pdf', 'picture', 'photo', 'camera roll'],
    inputs: [{ key: 'files', label: 'Images', accept: 'image', multiple: true, min: 1, hint: 'Use the arrows to change the order.' }],
    options: [
      { key: 'size', type: 'select', label: 'Page size', default: 'fit', options: pageSizeOpts },
      { key: 'orient', type: 'select', label: 'Orientation', default: 'auto', options: [{ value: 'auto', label: 'Automatic' }, { value: 'portrait', label: 'Portrait' }, { value: 'landscape', label: 'Landscape' }], showIf: (o) => o.size !== 'fit' },
      { key: 'margin', type: 'number', label: 'Margin (mm)', default: 10, showIf: (o) => o.size !== 'fit' },
      { key: 'shrink', type: 'toggle', label: 'Shrink very large photos', default: true, hint: 'Recommended. Caps the longest side at 2200 px.' },
    ],
    runLabel: 'Make PDF',
    status: 'ready',
    async run({ files, opts, progress }) {
      const bytes = await buildImagePdf(files.files, { size: opts.size, orient: opts.orient || 'auto', marginMm: Math.max(0, Number(opts.margin) || 0), shrink: !!opts.shrink, mode: 'color' }, progress);
      return { files: [pdfOut('images.pdf', bytes)], notes: [`${files.files.length} image${files.files.length === 1 ? '' : 's'} → ${files.files.length} page${files.files.length === 1 ? '' : 's'}.`] };
    },
  },
  {
    id: 'scan-to-pdf',
    name: 'Scan to PDF',
    short: 'Camera or photos in, clean document out.',
    desc: 'Take pictures of paper documents (or choose existing photos) and turn them into a tidy PDF with the shadows evened out.',
    category: 'convert',
    icon: '📱',
    keywords: ['scanner', 'camera', 'document scan', 'receipt', 'black and white', 'enhance'],
    inputs: [{ key: 'files', label: 'Photos of your pages', accept: 'image', multiple: true, min: 1, camera: true, hint: 'On a phone this opens the camera.' }],
    options: [
      { key: 'mode', type: 'select', label: 'Look', default: 'enhance', options: [{ value: 'enhance', label: 'Clean grayscale (best for text)' }, { value: 'bw', label: 'High-contrast black & white' }, { value: 'gray', label: 'Plain grayscale' }, { value: 'color', label: 'Keep colour' }] },
      { key: 'size', type: 'select', label: 'Page size', default: 'a4', options: pageSizeOpts },
    ],
    runLabel: 'Make PDF',
    status: 'ready',
    async run({ files, opts, progress }) {
      const bytes = await buildImagePdf(files.files, { size: opts.size, orient: 'auto', marginMm: 5, shrink: true, mode: opts.mode as ImgMode }, progress);
      return { files: [pdfOut('scan.pdf', bytes)] };
    },
  },
  {
    id: 'text-to-pdf',
    name: 'Text or Markdown to PDF',
    short: 'Write or paste text, get a neat PDF.',
    desc: 'Paste plain text or Markdown (headings, lists, quotes, code blocks, rules) and turn it into a clean, printable PDF.',
    category: 'convert',
    icon: '📝',
    keywords: ['markdown', 'md', 'text', 'txt', 'write', 'notes to pdf', 'readme'],
    inputs: [],
    options: [
      { key: 'source', type: 'textarea', label: 'Your text', placeholder: '# Title\n\nSome **text**…' },
      { key: 'format', type: 'select', label: 'Format', default: 'markdown', options: [{ value: 'markdown', label: 'Markdown' }, { value: 'plain', label: 'Plain text' }] },
      { key: 'face', type: 'select', label: 'Font', default: 'sans', options: [{ value: 'sans', label: 'Sans-serif' }, { value: 'serif', label: 'Serif' }, { value: 'mono', label: 'Monospace' }] },
      { key: 'size', type: 'select', label: 'Page size', default: 'a4', options: [{ value: 'a4', label: 'A4' }, { value: 'letter', label: 'Letter' }] },
      { key: 'fontSize', type: 'number', label: 'Font size', default: 11 },
      { key: 'margin', type: 'number', label: 'Margin (mm)', default: 20 },
    ],
    runLabel: 'Make PDF',
    tips: ['Characters outside Latin-1 (like emoji or non-Latin scripts) show up as “?”.'],
    status: 'ready',
    async run({ opts }) {
      const src = String(opts.source || '');
      if (!src.trim()) throw new ToolError('Type or paste some text first.');
      const bytes = await renderTextPdf(src, { markdown: opts.format === 'markdown', size: opts.size, fontSize: Math.max(6, Number(opts.fontSize) || 11), marginMm: Math.max(5, Number(opts.margin) || 20), face: opts.face });
      return { files: [pdfOut('document.pdf', bytes)] };
    },
  },
  {
    id: 'pdf-to-images',
    name: 'PDF to pictures',
    short: 'Save every page as a JPG or PNG.',
    desc: 'Render pages to high-quality images, in a ZIP or one by one. Pick the resolution that suits your use.',
    category: 'convert',
    icon: '📸',
    keywords: ['jpg', 'png', 'image', 'screenshot', 'export pages', 'pdf to jpg', 'pdf to png', 'zip'],
    inputs: [{ key: 'files', label: 'PDF', accept: 'pdf' }],
    options: [
      { key: 'fmt', type: 'select', label: 'Format', default: 'jpg', options: [{ value: 'jpg', label: 'JPG (smaller)' }, { value: 'png', label: 'PNG (sharper)' }] },
      { key: 'dpi', type: 'select', label: 'Resolution', default: '150', options: [{ value: '72', label: '72 dpi, screen' }, { value: '110', label: '110 dpi' }, { value: '150', label: '150 dpi, good' }, { value: '220', label: '220 dpi' }, { value: '300', label: '300 dpi, print' }] },
      { key: 'pages', type: 'text', label: 'Pages (blank = all)', placeholder: 'e.g. 1-3' },
      { key: 'zip', type: 'toggle', label: 'Bundle into one ZIP', default: true },
    ],
    runLabel: 'Convert now',
    tips: ['300 dpi pages can be large. Convert fewer pages at a time if your browser struggles.'],
    status: 'ready',
    async run({ files, opts, progress }) {
      const f = needOne(files.files);
      const doc = await openPdfjs(await f.bytes());
      const idx = parsePages(opts.pages, doc.numPages);
      const scale = Number(opts.dpi) / 72;
      const mime = opts.fmt === 'png' ? 'image/png' : 'image/jpeg';
      const pad = String(doc.numPages).length;
      const out: OutFile[] = [];
      for (let k = 0; k < idx.length; k++) {
        const { canvas } = await renderPage(doc, idx[k] + 1, scale);
        const bytes = await canvasToBytes(canvas, mime, 0.9);
        out.push({ name: `${baseName(f.name)}-page-${String(idx[k] + 1).padStart(pad, '0')}.${opts.fmt}`, mime, bytes });
        progress((k + 1) / idx.length, `Page ${idx[k] + 1}`);
      }
      if (opts.zip && out.length > 1) return { files: [await zipFiles(out, `${baseName(f.name)}-pages.zip`)], notes: [`${out.length} images in one ZIP.`] };
      return { files: out, notes: [`${out.length} image${out.length === 1 ? '' : 's'} created.`] };
    },
  },
  {
    id: 'extract-text',
    name: 'Copy text out',
    short: 'Pull the text from a PDF.',
    desc: 'Extract the selectable text from a PDF so you can copy it or save it as a .txt file.',
    category: 'convert',
    icon: '🔤',
    keywords: ['text', 'copy text', 'txt', 'read', 'ocr', 'extract words'],
    inputs: [{ key: 'files', label: 'PDF', accept: 'pdf' }],
    options: [
      { key: 'pages', type: 'text', label: 'Pages (blank = all)' },
      { key: 'marks', type: 'toggle', label: 'Mark where each page starts', default: true },
    ],
    runLabel: 'Extract now',
    tips: ['A scanned PDF is really a picture, so it has no text to copy. OCR for scans is on the roadmap.'],
    status: 'ready',
    async run({ files, opts, progress }) {
      const f = needOne(files.files);
      const pages = await textByPage(await f.bytes(), (i, n) => progress(i / n));
      const idx = parsePages(opts.pages, pages.length);
      const text = idx.map((i) => (opts.marks ? `--- Page ${i + 1} ---\n` : '') + pages[i]).join('\n\n').trim();
      if (!text.replace(/--- Page \d+ ---/g, '').trim()) {
        return { notes: ['No selectable text was found. This PDF is probably a scan.'] };
      }
      return { text, textName: `${baseName(f.name)}.txt`, notes: [`${text.length.toLocaleString()} characters from ${idx.length} page${idx.length === 1 ? '' : 's'}.`] };
    },
  },
];

export { loadDoc };
