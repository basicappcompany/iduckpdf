import { PDFDocument, StandardFonts, TextRenderingMode, beginText, endText, popGraphicsState, pushGraphicsState, setCharacterSqueeze, setFontAndSize, setTextMatrix, setTextRenderingMode, showText } from 'pdf-lib';
import type { PickedFile, ToolDef } from '../engine/types';
import { ToolError, baseName, loadDoc, pdfOut, safeText, save } from '../engine/util';
import { displayedToPage } from '../engine/placement';
import { processImage } from '../engine/imaging';
import { openPdfjs, renderPage } from '../engine/render';
import { OCR_LANGUAGES, createOcrWorker, recognizeWords, type OcrWord } from '../engine/ocr';

const isPdf = (f: PickedFile) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
const isImage = (f: PickedFile) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(f.name);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Writes each recognised word onto the page as invisible text (text render mode 3), sized and squeezed to cover the word's
 * box, so the page looks exactly as scanned but can be searched, selected and copied. `scale` is image pixels per point of
 * the displayed page.
 */
function addTextLayer(doc: PDFDocument, pageIndex: number, font: Awaited<ReturnType<PDFDocument['embedFont']>>, words: OcrWord[], scale: number): number {
  const page = doc.getPage(pageIndex);
  const crop = page.getCropBox();
  const rotation = page.getRotation().angle;
  const fontKey = page.node.newFontDictionary(font.name, font.ref);
  let written = 0;
  for (const w of words) {
    if (w.confidence < 25) continue;
    const text = safeText(font, w.text.trim());
    if (!text || (text.match(/\?/g) || []).length > text.length / 2) continue;
    const hPt = (w.y1 - w.y0) / scale;
    const wPt = (w.x1 - w.x0) / scale;
    if (hPt < 2 || wPt < 1) continue;
    const size = clamp(hPt, 4, 96);
    const natural = font.widthOfTextAtSize(text, size) || 1;
    const squeeze = clamp((wPt / natural) * 100, 10, 400);
    const origin = displayedToPage(crop, rotation, w.x0 / scale, w.y1 / scale - hPt * 0.2); // the baseline sits a little above the box bottom
    const a = (origin.angle * Math.PI) / 180;
    page.pushOperators(
      pushGraphicsState(),
      beginText(),
      setTextRenderingMode(TextRenderingMode.Invisible),
      setFontAndSize(fontKey, size),
      setCharacterSqueeze(squeeze),
      setTextMatrix(Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), origin.x, origin.y),
      showText(font.encodeText(text)),
      endText(),
      popGraphicsState(),
    );
    written++;
  }
  return written;
}

export const ocrTools: ToolDef[] = [
  {
    id: 'ocr',
    name: 'Read scans (OCR)',
    short: 'Make scanned pages searchable and copyable.',
    desc: 'Recognise the text in a scanned PDF or in photos of pages. You get a PDF that looks exactly the same but can be searched, selected and copied, and/or the plain text. The reading happens in your browser, so the scan never leaves your device.',
    category: 'convert',
    icon: '👁️',
    keywords: ['ocr', 'scan', 'recognise', 'recognize', 'searchable', 'image to text', 'scanned', 'text from image', 'photo to text', 'make searchable'],
    inputs: [{ key: 'files', label: 'Scanned PDF, or photos of pages', accept: 'any', multiple: true, hint: 'One PDF, or one or more pictures (JPG, PNG, WebP).' }],
    options: [
      { key: 'lang', type: 'select', label: 'Language of the text', default: 'eng', options: OCR_LANGUAGES, hint: 'Pick the language the document is written in. The first run downloads about 3 MB for it.' },
      { key: 'output', type: 'select', label: 'What do you want?', default: 'pdf', options: [{ value: 'pdf', label: 'Searchable PDF' }, { value: 'text', label: 'Text file' }, { value: 'both', label: 'Both' }] },
      { key: 'skipText', type: 'toggle', label: 'Skip pages that already have text', default: true, hint: 'Pages that are already searchable are left as they are. Turn off to read every page.' },
    ],
    runLabel: 'Read the text',
    tips: ['Scan at 200 to 300 dpi, straight and in good light. Blurry or crooked pages read poorly.', 'Check important numbers and names against the original: no OCR is perfect.', 'It can take several seconds per page. Keep the tab open while it works.'],
    faq: [
      { q: 'Is my scan uploaded?', a: 'No. The OCR engine runs inside your browser tab. The first time, your browser downloads the engine and the language data from this site, then everything happens on your device.' },
      { q: 'Which languages work?', a: 'English, Spanish, French, German, Italian, Portuguese and Dutch. Other languages need larger fonts and are not supported yet.' },
      { q: 'Will the PDF look different?', a: 'No. The pages stay exactly as scanned. The recognised text is added underneath as an invisible layer, so you can search and copy it.' },
      { q: 'Why are some words wrong?', a: 'Handwriting, small print, skewed or low-resolution scans are hard to read. Rescan at a higher resolution, or correct the text file by hand.' },
    ],
    status: 'ready',
    async run({ files, opts, progress }) {
      const list = files.files || [];
      const pdfs = list.filter(isPdf);
      const imgs = list.filter((f) => !isPdf(f) && isImage(f));
      if (!pdfs.length && !imgs.length) throw new ToolError('Add a scanned PDF or pictures of pages (JPG, PNG or WebP).');
      if (pdfs.length && imgs.length) throw new ToolError('Choose either one PDF or some pictures, not both together.');
      if (pdfs.length > 1) throw new ToolError('Choose one PDF at a time.');
      const lang = String(opts.lang || 'eng');
      const want = String(opts.output || 'pdf');

      let report: (f: number) => void = () => {};
      progress(0.02, 'Starting the OCR engine…');
      const worker = await createOcrWorker(lang, (f) => report(f));
      const texts: string[] = [];
      let out: PDFDocument;
      let read = 0;
      let skipped = 0;
      let wordCount = 0;
      try {
        if (pdfs.length) {
          const f = pdfs[0];
          const view = await openPdfjs(await f.bytes());
          out = await loadDoc(f);
          const font = await out.embedFont(StandardFonts.Helvetica);
          const n: number = view.numPages;
          for (let i = 1; i <= n; i++) {
            report = (frac) => progress(0.05 + 0.9 * ((i - 1 + frac) / n), `Reading page ${i} of ${n}…`);
            progress(0.05 + 0.9 * ((i - 1) / n), `Reading page ${i} of ${n}…`);
            const page = await view.getPage(i);
            if (opts.skipText) {
              const tc = await page.getTextContent();
              const existing = (tc.items as any[]).map((it) => it.str).join(' ').replace(/\s+/g, ' ').trim();
              if (existing.length >= 20) {
                skipped++;
                texts.push(existing);
                continue;
              }
            }
            const base = page.getViewport({ scale: 1 });
            const scale = clamp(2200 / Math.max(base.width, base.height), 1, 4);
            const r = await renderPage(view, i, scale);
            const { words, text } = await recognizeWords(worker, r.canvas);
            r.canvas.width = 0; // let the browser free the big bitmap
            wordCount += addTextLayer(out, i - 1, font, words, scale);
            texts.push(text.trim());
            read++;
          }
        } else {
          out = await PDFDocument.create();
          const font = await out.embedFont(StandardFonts.Helvetica);
          for (let i = 0; i < imgs.length; i++) {
            report = (frac) => progress(0.05 + 0.9 * ((i + frac) / imgs.length), `Reading picture ${i + 1} of ${imgs.length}…`);
            progress(0.05 + 0.9 * (i / imgs.length), `Reading picture ${i + 1} of ${imgs.length}…`);
            const p = await processImage(imgs[i], { maxSide: 3000, quality: 0.9, mode: 'color' });
            const embedded = p.kind === 'png' ? await out.embedPng(p.bytes) : await out.embedJpg(p.bytes);
            const wPt = p.width * 0.75; // 96 dpi, so a phone photo becomes a sensible page size
            const hPt = p.height * 0.75;
            const pg = out.addPage([wPt, hPt]);
            pg.drawImage(embedded, { x: 0, y: 0, width: wPt, height: hPt });
            const { words, text } = await recognizeWords(worker, new Blob([p.bytes as unknown as BlobPart], { type: p.kind === 'png' ? 'image/png' : 'image/jpeg' }));
            wordCount += addTextLayer(out, i, font, words, 1 / 0.75);
            texts.push(text.trim());
            read++;
          }
        }
      } finally {
        await worker.terminate().catch(() => {});
      }

      progress(0.97, 'Saving…');
      const name = baseName((pdfs[0] || imgs[0]).name);
      const filesOut = [];
      if (want === 'pdf' || want === 'both') filesOut.push(pdfOut(`${name}-searchable.pdf`, await save(out)));
      const joined = texts.length > 1 ? texts.map((t, i) => `--- Page ${i + 1} ---\n${t}`).join('\n\n') : texts[0] || '';
      const notes = [`${read} page${read === 1 ? '' : 's'} read${skipped ? `, ${skipped} already had text and ${skipped === 1 ? 'was' : 'were'} left alone` : ''}.`];
      if (read && !wordCount && want !== 'text') notes.push('No text could be found. The scan may be too faint, blurry or in a different language. Try another language or a clearer scan.');
      progress(1);
      return { files: filesOut, text: want === 'pdf' ? undefined : joined, textName: `${name}.txt`, notes };
    },
  },
];
