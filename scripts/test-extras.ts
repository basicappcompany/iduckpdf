/**
 * Tests for the picture tools (Extract pictures, JPG to PDF, Merge PDFs and pictures) and the PowerPoint writer behind
 * PDF to PowerPoint. They run in Node. The PowerPoint writer is checked by reading its output back with the PowerPoint reader.
 * Run:  npx tsx scripts/test-extras.ts
 */
import JSZip from 'jszip';
import { unzlibSync } from 'fflate';
import { DOMParser as XmlDOMParser } from '@xmldom/xmldom';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { ALL_TOOLS } from '../src/tools/all';
import type { PickedFile, ToolResult } from '../src/engine/types';
import { ToolError } from '../src/engine/util';
import { encodePng, extractImages } from '../src/engine/pdfimages';
import { writePptx } from '../src/engine/pptxwrite';

(globalThis as any).DOMParser = XmlDOMParser;
const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!/polyfill|fetchStandardFontData/.test(String(a[0]))) warn(...a); };
const nodeRequire = eval('require') as NodeRequire;
const pdfjs = nodeRequire('pdfjs-dist/legacy/build/pdf.mjs');
const FONT_DIR = nodeRequire('path').join(process.cwd(), 'node_modules', 'pdfjs-dist', 'standard_fonts') + '/';
(globalThis as any).window = { pdfjsLib: pdfjs };

const byId = (id: string) => ALL_TOOLS.find((t) => t.id === id)!;
const pf = (name: string, bytes: Uint8Array, type = 'application/octet-stream'): PickedFile => ({ name, size: bytes.length, type, bytes: async () => bytes });
let pass = 0;
let fail = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, extra = '') {
  if (ok) pass++;
  else { fail++; failures.push(`${name} ${extra}`); }
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`);
}
async function run(id: string, files: Record<string, PickedFile[]>, opts: Record<string, any> = {}): Promise<ToolResult> {
  const tool = byId(id);
  const defaults: Record<string, any> = {};
  (tool.options || []).forEach((o) => (defaults[o.key] = (o as any).default ?? ''));
  return tool.run!({ files, opts: { ...defaults, ...opts }, progress: () => {} });
}
const throws = async (fn: () => Promise<unknown>) => { try { await fn(); return null; } catch (e) { return e; } };

// the smallest valid JPEG (1x1), used for the byte-for-byte check
const JPEG_1x1 = Uint8Array.from(Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64'));

function gradient(w: number, h: number, comps: 3 | 4): Uint8Array {
  const px = new Uint8Array(w * h * comps);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * comps;
    px[i] = (x * 255) / w; px[i + 1] = (y * 255) / h; px[i + 2] = 128;
    if (comps === 4) px[i + 3] = x < w / 2 ? 255 : 80;
  }
  return px;
}

function readPng(b: Uint8Array) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const sig = [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => b[i] === v);
  const w = dv.getUint32(16);
  const h = dv.getUint32(20);
  const colorType = b[25];
  let o = 8;
  const idat: Uint8Array[] = [];
  while (o < b.length) {
    const len = dv.getUint32(o);
    const type = String.fromCharCode(b[o + 4], b[o + 5], b[o + 6], b[o + 7]);
    if (type === 'IDAT') idat.push(b.subarray(o + 8, o + 8 + len));
    o += 12 + len;
  }
  const joined = new Uint8Array(idat.reduce((s, p) => s + p.length, 0));
  let k = 0;
  idat.forEach((p) => { joined.set(p, k); k += p.length; });
  return { sig, w, h, colorType, raw: unzlibSync(joined) };
}

async function pdfPages(bytes: Uint8Array): Promise<{ text: string; width: number; height: number }[]> {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, disableFontFace: true, standardFontDataUrl: FONT_DIR, verbosity: 0 }).promise;
  const out = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    out.push({ text: (tc.items as any[]).map((it) => it.str).join(' ').replace(/\s+/g, ' '), width: vp.width, height: vp.height });
  }
  return out;
}

(async () => {
  // ---- a PDF holding an RGB picture (flate), a picture with transparency, a JPEG and a tiny icon, over two pages ----
  const d = await PDFDocument.create();
  const font = await d.embedFont(StandardFonts.Helvetica);
  const rgb = await d.embedPng(encodePng(gradient(60, 50, 3), 60, 50, 3));
  const alpha = await d.embedPng(encodePng(gradient(40, 40, 4), 40, 40, 4));
  const jpg = await d.embedJpg(JPEG_1x1);
  const icon = await d.embedPng(encodePng(gradient(10, 10, 3), 10, 10, 3));
  const p1 = d.addPage([400, 500]);
  p1.drawText('Hello', { x: 20, y: 460, size: 20, font });
  p1.drawImage(rgb, { x: 20, y: 300, width: 120, height: 100 });
  p1.drawImage(alpha, { x: 200, y: 300, width: 80, height: 80 });
  const p2 = d.addPage([400, 500]);
  p2.drawImage(jpg, { x: 20, y: 300, width: 50, height: 50 });
  p2.drawImage(icon, { x: 100, y: 300, width: 20, height: 20 });
  p2.drawImage(rgb, { x: 200, y: 300, width: 60, height: 50 }); // the same picture again: must not be extracted twice
  const pdf = await d.save();

  // ---- extraction ----
  let res = await extractImages(pdf, { minSize: 0 });
  check('extract: finds each distinct picture once (rgb, alpha, jpeg, icon = 4)', res.images.length === 4, `${res.images.length}`);
  const png = res.images.find((i) => i.ext === 'png' && i.width === 60)!;
  const rp = readPng(png.bytes);
  check('extract: a pixel picture comes out as a valid RGB PNG with its own size', rp.sig && rp.w === 60 && rp.h === 50 && rp.colorType === 2);
  const src = gradient(60, 50, 3);
  let same = true;
  for (let y = 0; y < 50 && same; y++) for (let x = 0; x < 60; x++) {
    const i = (y * 60 + x) * 3;
    const j = y * (60 * 3 + 1) + 1 + x * 3;
    if (rp.raw[j] !== src[i] || rp.raw[j + 1] !== src[i + 1] || rp.raw[j + 2] !== src[i + 2]) { same = false; break; }
  }
  check('extract: PNG pixels equal the original pixels (lossless)', same);
  const al = res.images.find((i) => i.ext === 'png' && i.width === 40)!;
  check('extract: a picture with a soft mask keeps its transparency (RGBA PNG)', !!al && readPng(al.bytes).colorType === 6);
  const jp = res.images.find((i) => i.ext === 'jpg')!;
  check('extract: a JPEG is copied out byte for byte', !!jp && jp.bytes.length === JPEG_1x1.length && jp.bytes.every((v, i) => v === JPEG_1x1[i]));
  check('extract: pictures are tagged with their page', res.images.filter((i) => i.page === 1).length === 2 && res.images.filter((i) => i.page === 2).length === 2);
  res = await extractImages(pdf, { minSize: 40 });
  check('extract: tiny pictures are skipped by default and counted', res.images.length === 2 && res.tooSmall === 2, `${res.images.length} kept, ${res.tooSmall} skipped`);
  res = await extractImages(pdf, { pages: [1], minSize: 0 });
  check('extract: page limit is respected (page 2 holds a JPEG, an icon and the shared picture)', res.images.length === 3 && res.images.every((i) => i.page === 2), String(res.images.length));

  let r = await run('extract-images', { files: [pf('pics.pdf', pdf, 'application/pdf')] }, { min: 0 });
  check('extract-images tool: several pictures come back in one ZIP', r.files!.length === 1 && r.files![0].name === 'pics-images.zip');
  const zip = await JSZip.loadAsync(r.files![0].bytes);
  check('extract-images tool: ZIP entries are named by page and number', !!zip.file('pics-page-1-image-1.png') && !!zip.file('pics-page-2-image-1.jpg'), Object.keys(zip.files).join(', '));
  r = await run('extract-images', { files: [pf('pics.pdf', pdf, 'application/pdf')] }, { min: 0, zip: false, pages: '1' });
  check('extract-images tool: without ZIP, files come out individually', r.files!.length === 2);
  const textOnly = await PDFDocument.create();
  textOnly.addPage([300, 300]).drawText('no pictures here', { x: 20, y: 200, size: 14, font: await textOnly.embedFont(StandardFonts.Helvetica) });
  const textOnlyBytes = await textOnly.save();
  const err = await throws(() => run('extract-images', { files: [pf('t.pdf', textOnlyBytes, 'application/pdf')] }));
  check('extract-images tool: a PDF with no pictures is refused with advice', err instanceof ToolError && /No pictures/.test((err as Error).message));

  // ---- merge PDFs and pictures / JPG to PDF (pictures go in untouched, so no canvas is needed) ----
  const three = await PDFDocument.create();
  for (let i = 0; i < 3; i++) three.addPage([300, 300]);
  const png1 = encodePng(gradient(30, 20, 3), 30, 20, 3);
  r = await run('merge-pdf-images', { files: [pf('a.pdf', await three.save(), 'application/pdf'), pf('b.png', png1, 'image/png'), pf('c.jpg', JPEG_1x1, 'image/jpeg')] }, { shrink: false });
  const merged = await PDFDocument.load(r.files![0].bytes);
  check('merge pdf+pictures: 3 PDF pages + 2 pictures = 5 pages', merged.getPageCount() === 5);
  const pg4 = merged.getPage(3).getSize();
  check('merge pdf+pictures: a picture page is A4 landscape-or-portrait, a PDF page keeps its size', Math.abs(Math.min(pg4.width, pg4.height) - 595.28) < 1 && merged.getPage(0).getSize().width === 300);
  check('merge pdf+pictures: the notes count PDFs and pictures', /1 PDF and 2 pictures/.test((r.notes || []).join(' ')), (r.notes || []).join(' '));
  r = await run('merge-pdf-images', { files: [pf('a.pdf', await three.save(), 'application/pdf'), pf('b.png', png1, 'image/png')] }, { size: 'fit', shrink: false });
  const fit = await PDFDocument.load(r.files![0].bytes);
  check('merge pdf+pictures: "match each picture" makes the page the picture size', fit.getPage(3).getSize().width === 30 && fit.getPage(3).getSize().height === 20);
  const threeBytes = await three.save();
  const bad = await throws(() => run('merge-pdf-images', { files: [pf('a.pdf', threeBytes, 'application/pdf'), pf('x.bin', new Uint8Array([1, 2, 3, 4, 5, 6]))] }, { shrink: false }));
  check('merge pdf+pictures: a file that is neither is refused by name', bad instanceof ToolError && /x\.bin/.test((bad as Error).message), bad instanceof Error ? bad.message : '');
  r = await run('jpg-to-pdf', { files: [pf('1.jpg', JPEG_1x1, 'image/jpeg'), pf('2.jpg', JPEG_1x1, 'image/jpeg')] }, { shrink: false });
  check('jpg-to-pdf: two photos make two pages, default A4', (await PDFDocument.load(r.files![0].bytes)).getPageCount() === 2 && r.files![0].name === 'photos.pdf');
  r = await run('jpg-to-pdf', { files: [pf('holiday.jpg', JPEG_1x1, 'image/jpeg')] }, { shrink: false });
  check('jpg-to-pdf: a single photo keeps its name', r.files![0].name === 'holiday.pdf');

  // ---- PowerPoint writer, checked by reading it back with the PowerPoint to PDF tool ----
  const pic = encodePng(gradient(80, 100, 3), 80, 100, 3);
  const pptx = await writePptx([
    { width: 595, height: 842, picture: { bytes: pic, ext: 'png' } },
    { width: 595, height: 842, texts: [{ x: 50, y: 60, w: 200, h: 30, text: 'Quarterly results', size: 24, bold: true }, { x: 50, y: 120, w: 300, h: 20, text: 'Revenue grew 12% & costs fell', size: 12 }] },
  ], 'Test deck');
  const z = await JSZip.loadAsync(pptx);
  check('pptx writer: has the parts PowerPoint needs', ['[Content_Types].xml', 'ppt/presentation.xml', 'ppt/slideMasters/slideMaster1.xml', 'ppt/slideLayouts/slideLayout1.xml', 'ppt/theme/theme1.xml', 'ppt/slides/slide1.xml', 'ppt/slides/slide2.xml', 'ppt/media/image1.png'].every((n) => !!z.file(n)));
  const ct = await z.file('[Content_Types].xml')!.async('string');
  check('pptx writer: every slide is declared in the content types', ct.includes('/ppt/slides/slide1.xml') && ct.includes('/ppt/slides/slide2.xml') && ct.includes('Extension="png"'));
  const xmlOk = await Promise.all(Object.keys(z.files).filter((n) => /\.(xml|rels)$/.test(n)).map(async (n) => { try { new XmlDOMParser({ onError: () => { throw new Error('bad'); } } as any).parseFromString(await z.file(n)!.async('string'), 'text/xml'); return true; } catch { return false; } }));
  check('pptx writer: every XML part is well formed', xmlOk.every(Boolean));
  const back = await run('pptx-to-pdf', { files: [pf('deck.pptx', pptx)] });
  const pages = await pdfPages(back.files![0].bytes);
  check('pptx round trip: two slides read back as two pages', pages.length === 2);
  check('pptx round trip: the page size matches the PDF page (595 x 842 pt)', Math.abs(pages[0].width - 595) < 1 && Math.abs(pages[0].height - 842) < 1, `${pages[0].width} x ${pages[0].height}`);
  check('pptx round trip: editable text survives, with & escaped correctly', /Quarterly results/.test(pages[1].text) && /Revenue grew 12% & costs fell/.test(pages[1].text), pages[1].text);
  const none = await throws(() => writePptx([]));
  check('pptx writer: no slides is refused', none instanceof Error);

  console.log(`\n${pass} passed, ${fail} failed.`);
  if (fail) {
    console.log('\nFailures:\n - ' + failures.join('\n - '));
    process.exit(1);
  }
})().catch((e) => {
  console.error('TEST CRASH', e);
  process.exit(2);
});
