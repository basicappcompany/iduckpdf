import { PDFDocument } from 'pdf-lib';
import type { OutFile, ToolDef } from '../engine/types';
import { ToolError, baseName, loadDoc, needOne, parsePages, pdfOut, save } from '../engine/util';
import { addImagePage, embedPicture, isPdfBytes } from '../engine/imagepage';
import { extractImages } from '../engine/pdfimages';
import { writePptx, type SlideDef } from '../engine/pptxwrite';
import { buildLines, pagePieces } from '../engine/pdftext';
import { canvasToBytes, openPdfjs, renderPage } from '../engine/render';
import { zipFiles } from '../engine/zip';

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const sizeOpts = [
  { value: 'fit', label: 'Match each picture' },
  { value: 'a4', label: 'A4' },
  { value: 'letter', label: 'Letter' },
];
const orientOpts = [
  { value: 'auto', label: 'Automatic' },
  { value: 'portrait', label: 'Portrait' },
  { value: 'landscape', label: 'Landscape' },
];

export const extraTools: ToolDef[] = [
  {
    id: 'extract-images',
    name: 'Extract pictures',
    short: 'Save the photos and graphics inside a PDF.',
    desc: 'Pull the embedded pictures out of a PDF as separate files. JPEGs come out exactly as stored, with no quality loss; other pictures are saved as PNG, with transparency kept. It runs in your browser, so the PDF is never uploaded.',
    category: 'convert',
    icon: '🖼️',
    keywords: ['extract images', 'save images', 'get pictures', 'photos from pdf', 'embedded images', 'download images', 'jpg', 'png', 'logo'],
    inputs: [{ key: 'files', label: 'PDF', accept: 'pdf', hint: 'This saves the pictures stored inside the file. To get a picture of each whole page, use PDF to pictures.' }],
    options: [
      { key: 'pages', type: 'text', label: 'Pages (blank = all)', placeholder: 'e.g. 1-3' },
      { key: 'min', type: 'number', label: 'Skip pictures smaller than (pixels)', default: 40, hint: 'Hides tiny icons, bullets and spacers. Use 0 to keep everything.' },
      { key: 'zip', type: 'toggle', label: 'Bundle into one ZIP', default: true },
    ],
    runLabel: 'Extract pictures',
    tips: ['Pictures are saved at the size they are stored in the PDF, which may be larger or smaller than they look on the page.', 'Text and vector drawings (charts, logos made of lines) are not pictures, so they are not extracted. Use PDF to pictures for those.', 'Some formats are left out: JPEG 2000, scanned-fax images and CMYK pixel data. The result tells you how many.'],
    faq: [
      { q: 'Is my PDF uploaded?', a: 'No. The pictures are read and saved inside your browser tab.' },
      { q: 'Do JPEGs lose quality?', a: 'No. A JPEG stored in the PDF is copied out byte for byte, so you get the original file.' },
      { q: 'Why did I get fewer pictures than I can see?', a: 'Charts and logos are often drawn as vector shapes rather than stored as pictures. Also, a page that is a single scan holds one big picture, not the separate things you see in it.' },
    ],
    status: 'ready',
    async run({ files, opts, progress }) {
      const f = needOne(files.files);
      const total = (await loadDoc(f)).getPageCount();
      const idx = parsePages(opts.pages, total);
      progress(0.1, 'Looking for pictures…');
      const res = await extractImages(await f.bytes(), { pages: idx, minSize: Math.max(0, Number(opts.min) || 0) });
      if (!res.images.length) {
        const why = [res.tooSmall && `${res.tooSmall} tiny`, res.unsupported && `${res.unsupported} in an unsupported format`, res.masks && `${res.masks} stencil mask${res.masks === 1 ? '' : 's'}`].filter(Boolean).join(', ');
        throw new ToolError(`No pictures could be extracted${why ? ` (${why} skipped)` : ''}. Text and vector graphics are not pictures: try PDF to pictures to save whole pages.`);
      }
      const perPage: Record<number, number> = {};
      const pad = String(total).length;
      const out: OutFile[] = res.images.map((im) => {
        perPage[im.page] = (perPage[im.page] || 0) + 1;
        return { name: `${baseName(f.name)}-page-${String(im.page).padStart(pad, '0')}-image-${perPage[im.page]}.${im.ext}`, mime: im.mime, bytes: im.bytes };
      });
      progress(0.95, 'Packing…');
      const notes = [`${out.length} picture${out.length === 1 ? '' : 's'} extracted from ${new Set(res.images.map((i) => i.page)).size} page${new Set(res.images.map((i) => i.page)).size === 1 ? '' : 's'}.`];
      if (res.tooSmall) notes.push(`${res.tooSmall} tiny picture${res.tooSmall === 1 ? '' : 's'} skipped. Set the minimum to 0 to keep them.`);
      if (res.unsupported) notes.push(`${res.unsupported} picture${res.unsupported === 1 ? '' : 's'} in a format that cannot be extracted (such as JPEG 2000, scanned-fax or CMYK pixels) left out.`);
      if (opts.zip && out.length > 1) return { files: [await zipFiles(out, `${baseName(f.name)}-images.zip`)], notes };
      return { files: out, notes };
    },
  },
  {
    id: 'pdf-to-pptx',
    name: 'PDF to PowerPoint',
    short: 'Turn each PDF page into a slide.',
    desc: 'Convert a PDF into a PowerPoint presentation (.pptx), one slide per page. Choose exact-look slides (each page as a picture) or editable text (the text placed in boxes you can change). It runs in your browser, so the PDF is never uploaded.',
    category: 'convert',
    icon: '📊',
    keywords: ['powerpoint', 'pptx', 'ppt', 'slides', 'presentation', 'pdf to ppt', 'pdf to powerpoint', 'convert to slides', 'deck'],
    inputs: [{ key: 'files', label: 'PDF', accept: 'pdf', hint: 'For editable text the PDF needs a text layer. Scans: run Read scans (OCR) first, or use the exact-look option.' }],
    options: [
      {
        key: 'mode', type: 'select', label: 'What should the slides contain?', default: 'picture',
        options: [{ value: 'picture', label: 'Exact look (each page as a picture)' }, { value: 'text', label: 'Editable text (text in boxes)' }],
      },
      { key: 'dpi', type: 'select', label: 'Picture sharpness', default: '150', options: [{ value: '110', label: '110 dpi, smaller file' }, { value: '150', label: '150 dpi, good' }, { value: '220', label: '220 dpi, sharp' }], showIf: { key: 'mode', eq: 'picture' } },
      { key: 'pages', type: 'text', label: 'Pages (blank = all)', placeholder: 'e.g. 1-5' },
    ],
    runLabel: 'Convert to PowerPoint',
    tips: ['Exact look keeps fonts, colours and pictures perfectly, but the slide is one picture, so the words cannot be edited.', 'Editable text gives you text boxes in the right places. Pictures, shapes and backgrounds are not carried over in this mode.', 'Slides take the size of the first page. Pages of a different size are fitted inside it.'],
    faq: [
      { q: 'Is my PDF uploaded?', a: 'No. The pages are read and the .pptx is built inside your browser tab.' },
      { q: 'Can I edit the text afterwards?', a: 'Choose Editable text and every line comes out as a text box you can change. The Exact look option makes each slide a single picture, which looks identical to the PDF but cannot be edited.' },
      { q: 'Why is my editable result empty?', a: 'A scanned PDF is a picture of text. Run it through Read scans (OCR) first, or pick Exact look.' },
      { q: 'Will it look like the original?', a: 'Exact look will. Editable text keeps the text and its position, not the pictures, shapes or colours.' },
    ],
    status: 'ready',
    async run({ files, opts, progress }) {
      const f = needOne(files.files);
      const view = await openPdfjs(await f.bytes());
      const idx = parsePages(opts.pages, view.numPages);
      const text = opts.mode === 'text';
      const scale = Math.min(Number(opts.dpi || 150) / 72, 4);
      const slides: SlideDef[] = [];
      let base: { w: number; h: number } | null = null;
      let withText = 0;
      for (let k = 0; k < idx.length; k++) {
        progress(0.05 + (0.85 * k) / idx.length, `Slide ${k + 1} of ${idx.length}…`);
        const page = await view.getPage(idx[k] + 1);
        const vp = page.getViewport({ scale: 1 });
        if (!base) base = { w: vp.width, h: vp.height };
        const fit = Math.min(base.w / vp.width, base.h / vp.height);
        const ox = (base.w - vp.width * fit) / 2;
        const oy = (base.h - vp.height * fit) / 2;
        if (text) {
          const { pieces } = await pagePieces(page);
          const lines = buildLines(pieces);
          if (lines.length) withText++;
          slides.push({
            width: base.w, height: base.h,
            texts: lines.flatMap((l) => l.cells.map((c) => ({ x: ox + c.x0 * fit, y: oy + (l.y - l.h * 0.88) * fit, w: (c.x1 - c.x0 + l.h * 0.6) * fit, h: l.h * 1.25 * fit, text: c.text, size: l.h * fit, bold: l.bold }))),
          });
        } else {
          const fitScale = Math.min(scale, 4200 / Math.max(vp.width, vp.height));
          const { canvas } = await renderPage(view, idx[k] + 1, fitScale);
          const bytes = await canvasToBytes(canvas, 'image/jpeg', 0.88);
          slides.push({ width: base.w, height: base.h, picture: { bytes, ext: 'jpg', x: ox, y: oy, w: vp.width * fit, h: vp.height * fit } });
          canvas.width = canvas.height = 0; // let the browser free the bitmap
        }
      }
      if (text && !withText) throw new ToolError('This PDF has no text layer to read, so it is probably a scan. Run it through Read scans (OCR) first, or choose Exact look.');
      progress(0.95, 'Building the PowerPoint…');
      const bytes = await writePptx(slides, baseName(f.name));
      const notes = [`${slides.length} slide${slides.length === 1 ? '' : 's'} created${text ? ' with editable text. Pictures, shapes and backgrounds are not carried over' : ' with each page as a picture. The text on the slides cannot be edited; choose Editable text for that'}.`];
      return { files: [{ name: `${baseName(f.name)}.pptx`, mime: PPTX_MIME, bytes }], notes };
    },
  },
  {
    id: 'merge-pdf-images',
    name: 'Merge PDFs and pictures',
    short: 'Combine PDFs and photos into one PDF.',
    desc: 'Mix PDFs and pictures (JPG, PNG, WebP) in one list, put them in order, and download a single PDF. Each picture becomes a page; each PDF keeps its pages as they are.',
    category: 'join',
    icon: '🧷',
    keywords: ['merge pdf and image', 'combine pdf and jpg', 'add image to pdf', 'append photo', 'mix files', 'pdf and picture', 'jpg and pdf'],
    inputs: [{ key: 'files', label: 'PDFs and pictures', accept: 'any', multiple: true, min: 2, hint: 'Add PDFs and pictures together. Use the arrows to change the order.' }],
    options: [
      { key: 'size', type: 'select', label: 'Page size for pictures', default: 'a4', options: sizeOpts },
      { key: 'orient', type: 'select', label: 'Orientation', default: 'auto', options: orientOpts, showIf: { key: 'size', ne: 'fit' } },
      { key: 'margin', type: 'number', label: 'Margin (mm)', default: 10, showIf: { key: 'size', ne: 'fit' } },
      { key: 'shrink', type: 'toggle', label: 'Shrink very large photos', default: true, hint: 'Recommended. Caps the longest side at 2200 px.' },
    ],
    runLabel: 'Merge now',
    tips: ['Files are joined top to bottom, exactly as listed.', 'The page size and margin settings apply to pictures only; PDF pages keep their own size.'],
    faq: [
      { q: 'Which pictures work?', a: 'JPG, PNG and WebP, and anything else your browser can open. Other file types are refused with a message.' },
      { q: 'Does it change my PDF pages?', a: 'No. Pages from PDFs are copied across as they are.' },
    ],
    status: 'ready',
    async run({ files, opts, progress }) {
      const list = files.files;
      const out = await PDFDocument.create();
      let pdfs = 0;
      let pics = 0;
      for (let i = 0; i < list.length; i++) {
        const head = await list[i].bytes();
        if (isPdfBytes(head)) {
          const src = await loadDoc(list[i]);
          (await out.copyPages(src, src.getPageIndices())).forEach((p) => out.addPage(p));
          pdfs++;
        } else {
          const img = await embedPicture(out, list[i], { shrink: !!opts.shrink });
          addImagePage(out, img, { size: opts.size, orient: opts.orient || 'auto', marginMm: Math.max(0, Number(opts.margin) || 0) });
          pics++;
        }
        progress((i + 1) / list.length, `Added ${list[i].name}`);
      }
      return { files: [pdfOut('merged.pdf', await save(out))], notes: [`${pdfs} PDF${pdfs === 1 ? '' : 's'} and ${pics} picture${pics === 1 ? '' : 's'} merged into ${out.getPageCount()} pages.`] };
    },
  },
  {
    id: 'jpg-to-pdf',
    name: 'JPG to PDF',
    short: 'Turn JPG photos into one PDF.',
    desc: 'Add one or many JPG photos, put them in order, and get a single PDF with a page for each. A4 pages with a margin by default, or match each photo. PNG and WebP work too.',
    category: 'convert',
    icon: '📷',
    keywords: ['jpg to pdf', 'jpeg to pdf', 'photo to pdf', 'picture to pdf', 'convert jpg', 'camera photos', 'phone photos'],
    inputs: [{ key: 'files', label: 'JPG photos', accept: 'image', multiple: true, min: 1, hint: 'Use the arrows to change the order.' }],
    options: [
      { key: 'size', type: 'select', label: 'Page size', default: 'a4', options: sizeOpts },
      { key: 'orient', type: 'select', label: 'Orientation', default: 'auto', options: orientOpts, showIf: { key: 'size', ne: 'fit' } },
      { key: 'margin', type: 'number', label: 'Margin (mm)', default: 10, showIf: { key: 'size', ne: 'fit' } },
      { key: 'shrink', type: 'toggle', label: 'Shrink very large photos', default: true, hint: 'Recommended. Caps the longest side at 2200 px.' },
    ],
    runLabel: 'Make PDF',
    tips: ['Turn Shrink off to keep your JPGs byte for byte: the file is bigger but the photos are untouched.', 'Photographing paper? Scan to PDF cleans up lighting and contrast.'],
    faq: [
      { q: 'Is my photo uploaded?', a: 'No. The PDF is built in your browser tab.' },
      { q: 'Does it recompress my JPGs?', a: 'Only if Shrink is on and a photo is larger than 2200 px on its longest side. Otherwise the JPG goes into the PDF unchanged.' },
    ],
    status: 'ready',
    async run({ files, opts, progress }) {
      const list = files.files;
      const doc = await PDFDocument.create();
      for (let i = 0; i < list.length; i++) {
        const img = await embedPicture(doc, list[i], { shrink: !!opts.shrink });
        addImagePage(doc, img, { size: opts.size, orient: opts.orient || 'auto', marginMm: Math.max(0, Number(opts.margin) || 0) });
        progress((i + 1) / list.length, `Added ${list[i].name}`);
      }
      return { files: [pdfOut(list.length === 1 ? `${baseName(list[0].name)}.pdf` : 'photos.pdf', await save(doc))], notes: [`${list.length} photo${list.length === 1 ? '' : 's'} → ${list.length} page${list.length === 1 ? '' : 's'}.`] };
    },
  },
  {
    id: 'pdf-to-jpg',
    name: 'PDF to JPG',
    short: 'Save PDF pages as JPG photos.',
    desc: 'Turn the pages of a PDF into JPG images, one per page, in a ZIP or one by one. Pick the sharpness and the file size.',
    category: 'convert',
    icon: '🏞️',
    keywords: ['pdf to jpg', 'pdf to jpeg', 'convert pdf to image', 'pages to photos', 'save page as jpg', 'zip'],
    inputs: [{ key: 'files', label: 'PDF', accept: 'pdf' }],
    options: [
      { key: 'dpi', type: 'select', label: 'Resolution', default: '150', options: [{ value: '72', label: '72 dpi, screen' }, { value: '110', label: '110 dpi' }, { value: '150', label: '150 dpi, good' }, { value: '220', label: '220 dpi' }, { value: '300', label: '300 dpi, print' }] },
      { key: 'quality', type: 'select', label: 'Quality', default: '0.9', options: [{ value: '0.95', label: 'Best (largest files)' }, { value: '0.9', label: 'High' }, { value: '0.8', label: 'Balanced' }, { value: '0.65', label: 'Small files' }] },
      { key: 'pages', type: 'text', label: 'Pages (blank = all)', placeholder: 'e.g. 1-3' },
      { key: 'zip', type: 'toggle', label: 'Bundle into one ZIP', default: true },
    ],
    runLabel: 'Convert to JPG',
    tips: ['Need transparency or razor-sharp text? Use PDF to pictures and pick PNG.', '300 dpi pages are large. Convert fewer pages at a time if your browser struggles.'],
    faq: [
      { q: 'Is my PDF uploaded?', a: 'No. Pages are drawn and saved inside your browser tab.' },
      { q: 'Which settings should I use?', a: '150 dpi and High quality suit screens and sharing. Use 300 dpi for printing.' },
    ],
    status: 'ready',
    async run({ files, opts, progress }) {
      const f = needOne(files.files);
      const doc = await openPdfjs(await f.bytes());
      const idx = parsePages(opts.pages, doc.numPages);
      const scale = Number(opts.dpi) / 72;
      const q = Math.min(1, Math.max(0.3, Number(opts.quality) || 0.9));
      const pad = String(doc.numPages).length;
      const out: OutFile[] = [];
      for (let k = 0; k < idx.length; k++) {
        const { canvas } = await renderPage(doc, idx[k] + 1, scale);
        out.push({ name: `${baseName(f.name)}-page-${String(idx[k] + 1).padStart(pad, '0')}.jpg`, mime: 'image/jpeg', bytes: await canvasToBytes(canvas, 'image/jpeg', q) });
        progress((k + 1) / idx.length, `Page ${idx[k] + 1}`);
      }
      if (opts.zip && out.length > 1) return { files: [await zipFiles(out, `${baseName(f.name)}-jpg.zip`)], notes: [`${out.length} JPG images in one ZIP.`] };
      return { files: out, notes: [`${out.length} JPG image${out.length === 1 ? '' : 's'} created.`] };
    },
  },
];
