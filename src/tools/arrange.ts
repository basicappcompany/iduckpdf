import { PDFDocument, degrees, rgb } from 'pdf-lib';
import type { ToolDef } from '../engine/types';
import { INCH, MM, PAGE_SIZES, ToolError, baseName, loadDoc, needOne, parsePages, pdfOut, save } from '../engine/util';

const sizeOptions = [
  { value: 'a4', label: 'A4' },
  { value: 'letter', label: 'Letter' },
  { value: 'a3', label: 'A3' },
  { value: 'a5', label: 'A5' },
  { value: 'legal', label: 'Legal' },
];

export const arrangeTools: ToolDef[] = [
  {
    id: 'reorder',
    name: 'Reorder pages',
    short: 'Type the new page order.',
    desc: 'Write the pages in the order you want, e.g. 3, 1, 2-5. Repeat a number to duplicate a page. Leave one out to drop it.',
    category: 'arrange',
    icon: '🔀',
    keywords: ['organize', 'rearrange', 'sort', 'move', 'order', 'duplicate page'],
    inputs: [{ key: 'files', label: 'PDF', accept: 'pdf' }],
    options: [{ key: 'order', type: 'text', label: 'New order', placeholder: 'e.g. 3, 1, 2, 4-6', hint: 'Pages you do not list are left out.' }],
    runLabel: 'Reorder now',
    status: 'ready',
    async run({ files, opts }) {
      const f = needOne(files.files);
      const src = await loadDoc(f);
      const idx = parsePages(opts.order, src.getPageCount(), { blank: 'error', unique: false });
      const out = await PDFDocument.create();
      (await out.copyPages(src, idx)).forEach((p) => out.addPage(p));
      return { files: [pdfOut(`${baseName(f.name)}-reordered.pdf`, await save(out))], notes: [`New file has ${idx.length} pages.`] };
    },
  },
  {
    id: 'reverse',
    name: 'Flip page order',
    short: 'Last page first.',
    desc: 'Reverse the whole document so the last page becomes the first.',
    category: 'arrange',
    icon: '↩️',
    keywords: ['reverse', 'backwards', 'flip', 'last to first'],
    inputs: [{ key: 'files', label: 'PDF', accept: 'pdf' }],
    runLabel: 'Flip now',
    status: 'ready',
    async run({ files }) {
      const f = needOne(files.files);
      const src = await loadDoc(f);
      const out = await PDFDocument.create();
      (await out.copyPages(src, src.getPageIndices().reverse())).forEach((p) => out.addPage(p));
      return { files: [pdfOut(`${baseName(f.name)}-reversed.pdf`, await save(out))] };
    },
  },
  {
    id: 'rotate',
    name: 'Rotate pages',
    short: 'Turn pages 90°, 180° or 270°.',
    desc: 'Fix sideways or upside-down scans. Rotate every page, or only the ones you name.',
    category: 'arrange',
    icon: '🔄',
    keywords: ['turn', 'sideways', 'landscape', 'portrait', 'upside down', 'flip'],
    inputs: [{ key: 'files', label: 'PDF', accept: 'pdf' }],
    options: [
      {
        key: 'angle',
        type: 'select',
        label: 'Rotate',
        default: '90',
        options: [
          { value: '90', label: '90° clockwise' },
          { value: '180', label: '180°' },
          { value: '270', label: '90° counter-clockwise' },
        ],
      },
      { key: 'pages', type: 'text', label: 'Pages (blank = all)', placeholder: 'e.g. 2, 4-6, odd' },
    ],
    runLabel: 'Rotate now',
    status: 'ready',
    async run({ files, opts }) {
      const f = needOne(files.files);
      const doc = await loadDoc(f);
      const idx = parsePages(opts.pages, doc.getPageCount());
      for (const i of idx) {
        const p = doc.getPage(i);
        p.setRotation(degrees((p.getRotation().angle + Number(opts.angle) + 360) % 360));
      }
      return { files: [pdfOut(`${baseName(f.name)}-rotated.pdf`, await save(doc))], notes: [`Rotated ${idx.length} page${idx.length === 1 ? '' : 's'}.`] };
    },
  },
  {
    id: 'insert-blank',
    name: 'Add blank pages',
    short: 'Slip empty pages in where you need them.',
    desc: 'Insert one or more blank pages before or after the pages you choose, handy for double-sided printing or notes.',
    category: 'arrange',
    icon: '📄',
    keywords: ['empty', 'spacer', 'insert', 'blank', 'notes page', 'duplex'],
    inputs: [{ key: 'files', label: 'PDF', accept: 'pdf' }],
    options: [
      { key: 'pages', type: 'text', label: 'Insert next to pages', placeholder: 'e.g. 1, 5, last (blank = every page)' },
      { key: 'where', type: 'select', label: 'Position', default: 'after', options: [{ value: 'after', label: 'After the page' }, { value: 'before', label: 'Before the page' }] },
      { key: 'count', type: 'number', label: 'Blank pages each time', default: 1 },
      { key: 'size', type: 'select', label: 'Blank page size', default: 'same', options: [{ value: 'same', label: 'Same as neighbour' }, ...sizeOptions] },
    ],
    runLabel: 'Insert now',
    status: 'ready',
    async run({ files, opts }) {
      const f = needOne(files.files);
      const doc = await loadDoc(f);
      const count = Math.min(20, Math.max(1, Math.floor(Number(opts.count) || 1)));
      const idx = parsePages(opts.pages, doc.getPageCount()).sort((a, b) => b - a);
      const sizes = idx.map((i) => doc.getPage(i).getSize());
      idx.forEach((i, k) => {
        const sz = opts.size === 'same' ? [sizes[k].width, sizes[k].height] : PAGE_SIZES[opts.size];
        for (let c = 0; c < count; c++) doc.insertPage(opts.where === 'before' ? i : i + 1, [sz[0], sz[1]]);
      });
      return { files: [pdfOut(`${baseName(f.name)}-with-blanks.pdf`, await save(doc))], notes: [`Added ${idx.length * count} blank page${idx.length * count === 1 ? '' : 's'}.`] };
    },
  },
  {
    id: 'resize',
    name: 'Change page size',
    short: 'Fit every page onto A4, Letter and friends.',
    desc: 'Scale pages to a standard paper size. Content is shrunk or enlarged to fit and centred, never stretched.',
    category: 'arrange',
    icon: '📏',
    keywords: ['a4', 'letter', 'paper size', 'scale', 'fit', 'legal', 'a3', 'a5'],
    inputs: [{ key: 'files', label: 'PDF', accept: 'pdf' }],
    options: [{ key: 'size', type: 'select', label: 'New page size', default: 'a4', options: sizeOptions }],
    runLabel: 'Resize now',
    tips: ['Landscape pages stay landscape.'],
    status: 'ready',
    async run({ files, opts, progress }) {
      const f = needOne(files.files);
      const src = await loadDoc(f);
      const out = await PDFDocument.create();
      const emb = await out.embedPdf(src, src.getPageIndices());
      emb.forEach((e, i) => {
        const sp = src.getPage(i);
        const { width, height } = sp.getSize();
        let [tw, th] = PAGE_SIZES[opts.size] || PAGE_SIZES.a4;
        if (width > height) [tw, th] = [th, tw];
        const s = Math.min(tw / width, th / height);
        const page = out.addPage([tw, th]);
        page.drawPage(e, { x: (tw - width * s) / 2, y: (th - height * s) / 2, xScale: s, yScale: s });
        page.setRotation(sp.getRotation());
        progress((i + 1) / emb.length);
      });
      return { files: [pdfOut(`${baseName(f.name)}-${opts.size}.pdf`, await save(out))] };
    },
  },
  {
    id: 'crop',
    name: 'Trim margins',
    short: 'Crop white space off the edges.',
    desc: 'Cut a fixed amount off the top, right, bottom and left of the pages you choose.',
    category: 'arrange',
    icon: '📐',
    keywords: ['crop', 'cut', 'margin', 'trim', 'borders', 'white space'],
    inputs: [{ key: 'files', label: 'PDF', accept: 'pdf' }],
    options: [
      { key: 'unit', type: 'select', label: 'Unit', default: 'mm', options: [{ value: 'mm', label: 'Millimetres' }, { value: 'in', label: 'Inches' }, { value: 'pt', label: 'Points' }] },
      { key: 'top', type: 'number', label: 'Top', default: 10 },
      { key: 'right', type: 'number', label: 'Right', default: 10 },
      { key: 'bottom', type: 'number', label: 'Bottom', default: 10 },
      { key: 'left', type: 'number', label: 'Left', default: 10 },
      { key: 'pages', type: 'text', label: 'Pages (blank = all)' },
    ],
    runLabel: 'Trim now',
    status: 'ready',
    async run({ files, opts }) {
      const f = needOne(files.files);
      const doc = await loadDoc(f);
      const k = opts.unit === 'in' ? INCH : opts.unit === 'pt' ? 1 : MM;
      const [t, r, b, l] = [opts.top, opts.right, opts.bottom, opts.left].map((v) => Math.max(0, Number(v) || 0) * k);
      const idx = parsePages(opts.pages, doc.getPageCount());
      for (const i of idx) {
        const p = doc.getPage(i);
        const mb = p.getMediaBox();
        const w = mb.width - l - r;
        const h = mb.height - t - b;
        if (w < 20 || h < 20) throw new ToolError(`Page ${i + 1} would be almost empty. Use smaller margins.`);
        p.setCropBox(mb.x + l, mb.y + b, w, h);
        p.setMediaBox(mb.x + l, mb.y + b, w, h);
      }
      return { files: [pdfOut(`${baseName(f.name)}-cropped.pdf`, await save(doc))], notes: [`Trimmed ${idx.length} page${idx.length === 1 ? '' : 's'}.`] };
    },
  },
  {
    id: 'n-up',
    name: 'Print several per sheet',
    short: '2, 4, 6 or 9 pages on one sheet.',
    desc: 'Shrink pages and tile them onto bigger sheets, great for handouts, proofs and saving paper.',
    category: 'arrange',
    icon: '🧱',
    keywords: ['handout', 'n-up', '2 up', '4 up', 'multiple per page', 'thumbnails', 'save paper', 'booklet'],
    inputs: [{ key: 'files', label: 'PDF', accept: 'pdf' }],
    options: [
      { key: 'per', type: 'select', label: 'Pages per sheet', default: '4', options: [{ value: '2', label: '2' }, { value: '4', label: '4' }, { value: '6', label: '6' }, { value: '9', label: '9' }] },
      { key: 'sheet', type: 'select', label: 'Sheet size', default: 'a4', options: sizeOptions.slice(0, 2) },
      { key: 'margin', type: 'number', label: 'Outer margin (mm)', default: 8 },
      { key: 'gap', type: 'number', label: 'Gap between pages (mm)', default: 4 },
      { key: 'border', type: 'toggle', label: 'Draw a thin border around each page', default: true },
    ],
    runLabel: 'Build sheets',
    status: 'ready',
    async run({ files, opts, progress }) {
      const f = needOne(files.files);
      const src = await loadDoc(f);
      const per = Number(opts.per);
      const [cols, rows] = ({ 2: [2, 1], 4: [2, 2], 6: [3, 2], 9: [3, 3] } as Record<number, [number, number]>)[per] || [2, 2];
      let [sw, sh] = PAGE_SIZES[opts.sheet] || PAGE_SIZES.a4;
      if (cols > rows) [sw, sh] = [sh, sw];
      const m = Math.max(0, Number(opts.margin) || 0) * MM;
      const g = Math.max(0, Number(opts.gap) || 0) * MM;
      const cw = (sw - 2 * m - g * (cols - 1)) / cols;
      const ch = (sh - 2 * m - g * (rows - 1)) / rows;
      if (cw < 30 || ch < 30) throw new ToolError('The margins leave no room for pages. Use smaller margins.');
      const out = await PDFDocument.create();
      const emb = await out.embedPdf(src, src.getPageIndices());
      let sheet: ReturnType<typeof out.addPage> | null = null;
      emb.forEach((e, i) => {
        const slot = i % per;
        if (slot === 0) sheet = out.addPage([sw, sh]);
        const { width, height } = src.getPage(i).getSize();
        const s = Math.min(cw / width, ch / height);
        const col = slot % cols;
        const row = Math.floor(slot / cols);
        const x = m + col * (cw + g) + (cw - width * s) / 2;
        const y = sh - m - (row + 1) * ch - row * g + (ch - height * s) / 2;
        sheet!.drawPage(e, { x, y, xScale: s, yScale: s });
        if (opts.border) sheet!.drawRectangle({ x, y, width: width * s, height: height * s, borderWidth: 0.5, borderColor: rgb(0.6, 0.6, 0.6) });
        progress((i + 1) / emb.length);
      });
      return { files: [pdfOut(`${baseName(f.name)}-${per}-up.pdf`, await save(out))], notes: [`${emb.length} pages on ${out.getPageCount()} sheets.`] };
    },
  },
  {
    id: 'repair',
    name: 'Repair a PDF',
    short: 'Rebuild a damaged file.',
    desc: 'Tries to open a broken PDF, rescue every page it can read, and write them into a clean new file.',
    category: 'arrange',
    icon: '🩹',
    keywords: ['fix', 'broken', 'corrupt', 'damaged', 'recover', 'cannot open', 'error'],
    inputs: [{ key: 'files', label: 'Damaged PDF', accept: 'pdf' }],
    runLabel: 'Repair now',
    tips: ['If a page is truly destroyed, it cannot be brought back.'],
    status: 'ready',
    async run({ files }) {
      const f = needOne(files.files);
      const bytes = await f.bytes();
      let src: PDFDocument;
      try {
        src = await PDFDocument.load(bytes, { ignoreEncryption: true, throwOnInvalidObject: false, updateMetadata: false });
      } catch {
        throw new ToolError('This file is too damaged to read anything from.');
      }
      const out = await PDFDocument.create();
      let saved = 0;
      let lost = 0;
      for (const i of src.getPageIndices()) {
        try {
          const [p] = await out.copyPages(src, [i]);
          out.addPage(p);
          saved++;
        } catch {
          lost++;
        }
      }
      if (!saved) throw new ToolError('No readable pages were found in this file.');
      return {
        files: [pdfOut(`${baseName(f.name)}-repaired.pdf`, await save(out))],
        notes: [`Rescued ${saved} page${saved === 1 ? '' : 's'}.`, ...(lost ? [`${lost} page${lost === 1 ? '' : 's'} could not be recovered.`] : [])],
      };
    },
  },
];
