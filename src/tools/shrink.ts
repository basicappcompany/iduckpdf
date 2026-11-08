import { PDFDocument } from 'pdf-lib';
import type { ToolDef } from '../engine/types';
import { baseName, fmtBytes, loadDoc, needOne, parsePages, pdfOut, save } from '../engine/util';
import { canvasToBytes, openPdfjs, renderPage } from '../engine/render';
import { filterCanvas } from '../engine/imaging';

const LEVELS: Record<string, { dpi: number; q: number }> = {
  balanced: { dpi: 130, q: 0.7 },
  strong: { dpi: 96, q: 0.55 },
  tiny: { dpi: 72, q: 0.4 },
};

export const shrinkTools: ToolDef[] = [
  {
    id: 'compress',
    name: 'Make it smaller',
    short: 'Shrink the file size of a PDF.',
    desc: 'Reduce a PDF so it fits an email or an upload limit. Choose a gentle clean-up that keeps text, or a stronger squeeze that flattens pages to pictures.',
    category: 'shrink',
    icon: '🪶',
    keywords: ['compress', 'reduce size', 'smaller', 'optimize', 'email', 'upload limit', 'shrink', 'mb'],
    inputs: [{ key: 'files', label: 'PDF', accept: 'pdf' }],
    options: [
      {
        key: 'level',
        type: 'select',
        label: 'How hard to squeeze',
        default: 'balanced',
        options: [
          { value: 'lossless', label: 'Gentle: keep text selectable' },
          { value: 'balanced', label: 'Balanced: ~130 dpi pictures' },
          { value: 'strong', label: 'Strong: ~96 dpi pictures' },
          { value: 'tiny', label: 'Tiny: 72 dpi pictures' },
        ],
        hint: 'Balanced, Strong and Tiny turn each page into a compressed image, so text can no longer be selected.',
      },
    ],
    runLabel: 'Shrink now',
    tips: ['Start with Gentle. If that is not small enough, move up a level.', 'PDFs that are mostly text rarely get much smaller; scans and photo-heavy files shrink a lot.'],
    faq: [{ q: 'Why did my file barely change?', a: 'Gentle mode only tidies the file structure. If the size is dominated by images, use Balanced or Strong.' }],
    status: 'ready',
    async run({ files, opts, progress }) {
      const f = needOne(files.files);
      const before = f.size;
      let bytes: Uint8Array;
      if (opts.level === 'lossless') {
        const doc = await loadDoc(f, { updateMetadata: false });
        bytes = await save(doc);
        progress(1);
      } else {
        const { dpi, q } = LEVELS[opts.level] || LEVELS.balanced;
        const src = await openPdfjs(await f.bytes());
        const out = await PDFDocument.create();
        const scale = dpi / 72;
        for (let i = 1; i <= src.numPages; i++) {
          const { canvas, viewport } = await renderPage(src, i, scale);
          const jpg = await canvasToBytes(canvas, 'image/jpeg', q);
          const img = await out.embedJpg(jpg);
          const w = viewport.width / scale;
          const h = viewport.height / scale;
          out.addPage([w, h]).drawImage(img, { x: 0, y: 0, width: w, height: h });
          progress(i / src.numPages, `Page ${i} of ${src.numPages}`);
        }
        bytes = await save(out);
      }
      const notes: string[] = [];
      // Turning pages into pictures can make text-heavy PDFs bigger. Never hand that over:
      // fall back to the gentle clean-up (which keeps text) if it is smaller than the original.
      if (opts.level !== 'lossless' && bytes.length >= before) {
        const gentle = await save(await loadDoc(f, { updateMetadata: false }));
        if (gentle.length < bytes.length) {
          bytes = gentle;
          notes.push('Turning the pages into pictures would have made this file bigger (it is mostly text), so only the file structure was tidied and the text stays selectable.');
        }
      }
      const after = bytes.length;
      const pct = Math.round((1 - after / before) * 100);
      notes.unshift(`${fmtBytes(before)} → ${fmtBytes(after)} (${pct >= 0 ? `${pct}% smaller` : `${-pct}% bigger`}).`);
      if (after >= before) notes.push('This PDF is already well packed, so there was nothing left to remove. Keep your original file.');
      return { files: [pdfOut(`${baseName(f.name)}-smaller.pdf`, bytes)], notes };
    },
  },
  {
    id: 'restyle',
    name: 'Grayscale & dark mode',
    short: 'Black & white, inverted, sepia or crisp scan look.',
    desc: 'Recolour a PDF: save ink with grayscale, read at night with an inverted version, or make a faint scan crisp and high-contrast.',
    category: 'shrink',
    icon: '🌗',
    keywords: ['grayscale', 'black and white', 'invert', 'dark mode', 'night', 'sepia', 'ink saving', 'contrast', 'monochrome'],
    inputs: [{ key: 'files', label: 'PDF', accept: 'pdf' }],
    options: [
      {
        key: 'mode',
        type: 'select',
        label: 'Look',
        default: 'gray',
        options: [
          { value: 'gray', label: 'Grayscale' },
          { value: 'invert', label: 'Inverted (dark mode)' },
          { value: 'sepia', label: 'Sepia' },
          { value: 'bw', label: 'High-contrast black & white' },
          { value: 'enhance', label: 'Scan clean-up (stretch contrast)' },
        ],
      },
      { key: 'dpi', type: 'select', label: 'Quality', default: '150', options: [{ value: '110', label: 'Smaller (110 dpi)' }, { value: '150', label: 'Good (150 dpi)' }, { value: '200', label: 'Sharp (200 dpi)' }] },
      { key: 'pages', type: 'text', label: 'Pages (blank = all)' },
    ],
    runLabel: 'Restyle now',
    tips: ['The result is made of page images, so text is no longer selectable.'],
    status: 'ready',
    async run({ files, opts, progress }) {
      const f = needOne(files.files);
      const src = await openPdfjs(await f.bytes());
      const idx = parsePages(opts.pages, src.numPages);
      const out = await PDFDocument.create();
      const scale = Number(opts.dpi) / 72;
      for (let k = 0; k < idx.length; k++) {
        const { canvas, viewport } = await renderPage(src, idx[k] + 1, scale);
        filterCanvas(canvas, opts.mode);
        const png = opts.mode === 'bw';
        const bytes = await canvasToBytes(canvas, png ? 'image/png' : 'image/jpeg', 0.85);
        const img = png ? await out.embedPng(bytes) : await out.embedJpg(bytes);
        const w = viewport.width / scale;
        const h = viewport.height / scale;
        out.addPage([w, h]).drawImage(img, { x: 0, y: 0, width: w, height: h });
        progress((k + 1) / idx.length, `Page ${idx[k] + 1}`);
      }
      return { files: [pdfOut(`${baseName(f.name)}-${opts.mode}.pdf`, await save(out))], notes: [`${idx.length} page${idx.length === 1 ? '' : 's'} restyled.`] };
    },
  },
];
