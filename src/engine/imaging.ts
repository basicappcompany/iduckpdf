// Canvas-based image helpers (browser). Used by Images→PDF, Scan→PDF, Compress and the restyle tools.
import type { PickedFile } from './types';
import { ToolError } from './util';

export type ImgMode = 'color' | 'gray' | 'bw' | 'enhance';
export type Processed = { bytes: Uint8Array; kind: 'jpg' | 'png'; width: number; height: number };

function sniff(bytes: Uint8Array): 'jpg' | 'png' | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e) return 'png';
  return null;
}

async function bitmapOf(file: PickedFile, bytes: Uint8Array): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(new Blob([bytes as unknown as BlobPart], { type: file.type || 'image/*' }));
  } catch {
    throw new ToolError(`“${file.name}” is not an image this browser can open.`);
  }
}

/** Pixel filters shared with the restyle tool. */
export function filterCanvas(canvas: HTMLCanvasElement, mode: 'gray' | 'invert' | 'sepia' | 'bw' | 'enhance'): void {
  const ctx = canvas.getContext('2d')!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  let lo = 0;
  let hi = 255;
  if (mode === 'enhance') {
    // stretch the luminance histogram (ignoring the extreme 1%) for scans
    const hist = new Uint32Array(256);
    for (let i = 0; i < d.length; i += 4) hist[Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])]++;
    const total = d.length / 4;
    let acc = 0;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc > total * 0.01) {
        lo = v;
        break;
      }
    }
    acc = 0;
    for (let v = 255; v >= 0; v--) {
      acc += hist[v];
      if (acc > total * 0.01) {
        hi = v;
        break;
      }
    }
    if (hi - lo < 20) {
      lo = 0;
      hi = 255;
    }
  }
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    if (mode === 'invert') {
      d[i] = 255 - r;
      d[i + 1] = 255 - g;
      d[i + 2] = 255 - b;
    } else if (mode === 'sepia') {
      d[i] = Math.min(255, 0.393 * r + 0.769 * g + 0.189 * b);
      d[i + 1] = Math.min(255, 0.349 * r + 0.686 * g + 0.168 * b);
      d[i + 2] = Math.min(255, 0.272 * r + 0.534 * g + 0.131 * b);
    } else if (mode === 'gray') {
      d[i] = d[i + 1] = d[i + 2] = y;
    } else if (mode === 'bw') {
      const v = y > 150 ? 255 : 0;
      d[i] = d[i + 1] = d[i + 2] = v;
    } else {
      const v = Math.max(0, Math.min(255, ((y - lo) / (hi - lo)) * 255));
      d[i] = d[i + 1] = d[i + 2] = v;
    }
  }
  ctx.putImageData(img, 0, 0);
}

export async function processImage(
  file: PickedFile,
  o: { maxSide: number; quality: number; mode: ImgMode },
): Promise<Processed> {
  const bytes = await file.bytes();
  const bmp = await bitmapOf(file, bytes);
  const kind = sniff(bytes);
  const scale = o.maxSide > 0 ? Math.min(1, o.maxSide / Math.max(bmp.width, bmp.height)) : 1;
  // untouched JPEG/PNG can go straight into the PDF
  if (kind && scale === 1 && o.mode === 'color') {
    return { bytes, kind, width: bmp.width, height: bmp.height };
  }
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close && bmp.close();
  if (o.mode === 'gray') filterCanvas(canvas, 'gray');
  else if (o.mode === 'bw') filterCanvas(canvas, 'bw');
  else if (o.mode === 'enhance') filterCanvas(canvas, 'enhance');
  const blob: Blob = await new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new ToolError('Could not encode the image.'))), 'image/jpeg', o.quality),
  );
  return { bytes: new Uint8Array(await blob.arrayBuffer()), kind: 'jpg', width: w, height: h };
}
