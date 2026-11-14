// Putting a picture on a PDF page: shared by Photos to PDF, JPG to PDF and Merge PDFs and pictures.
import type { PDFDocument, PDFImage } from 'pdf-lib';
import type { PickedFile } from './types';
import { MM, PAGE_SIZES, ToolError } from './base';
import { processImage, type ImgMode } from './imaging';

export const isPdfBytes = (b: Uint8Array) => b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46; // %PDF

/** Embed a picture. Untouched JPEG/PNG files with no shrinking go in as they are (no canvas, so this also runs in Node); the rest go through the canvas. */
export async function embedPicture(doc: PDFDocument, file: PickedFile, o: { shrink: boolean; mode?: ImgMode; maxSide?: number; quality?: number }): Promise<PDFImage> {
  const mode = o.mode || 'color';
  const raw = await file.bytes();
  const kind = raw[0] === 0xff && raw[1] === 0xd8 ? 'jpg' : raw[0] === 0x89 && raw[1] === 0x50 ? 'png' : null;
  try {
    if (kind && !o.shrink && !o.maxSide && mode === 'color') return kind === 'png' ? await doc.embedPng(raw) : await doc.embedJpg(raw);
    const pr = await processImage(file, { maxSide: o.maxSide ?? (o.shrink ? 2200 : 0), quality: o.quality ?? 0.82, mode });
    return pr.kind === 'png' ? await doc.embedPng(pr.bytes) : await doc.embedJpg(pr.bytes);
  } catch (e) {
    if (e instanceof ToolError) throw e;
    throw new ToolError(`“${file.name}” could not be read as a picture. It may be damaged or in an unsupported format.`);
  }
}

/** Add one page holding the picture. size 'fit' makes the page match the picture. */
export function addImagePage(doc: PDFDocument, img: PDFImage, o: { size: string; orient: string; marginMm: number }): void {
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
}
