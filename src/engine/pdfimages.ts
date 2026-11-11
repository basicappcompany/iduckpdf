/**
 * Pulls the pictures out of a PDF without a browser: JPEGs are copied out byte for byte (no quality loss),
 * and plain pixel images (grey, RGB, palette, with a soft mask for transparency) are written as PNG.
 * Anything else (JPEG 2000, scanned fax formats, CMYK pixels, stencil masks) is counted and reported, not guessed at.
 */
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFRawStream, PDFRef, PDFString, decodePDFRawStream } from 'pdf-lib';
import { zlibSync } from 'fflate';

export type FoundImage = { page: number; width: number; height: number; ext: 'jpg' | 'png'; mime: string; bytes: Uint8Array };
export type ExtractResult = { images: FoundImage[]; tooSmall: number; unsupported: number; masks: number };

const N = (s: string) => PDFName.of(s);

function num(ctx: PDFDocument['context'], d: PDFDict, key: string): number | undefined {
  const v = ctx.lookup(d.get(N(key)));
  return v instanceof PDFNumber ? v.asNumber() : undefined;
}

function filterNames(ctx: PDFDocument['context'], d: PDFDict): string[] {
  const f = ctx.lookup(d.get(N('Filter')));
  if (f instanceof PDFName) return [f.asString().replace(/^\//, '')];
  if (f instanceof PDFArray) return f.asArray().map((x) => { const v = ctx.lookup(x); return v instanceof PDFName ? v.asString().replace(/^\//, '') : ''; });
  return [];
}

type Space = { n: 1 | 3; palette?: Uint8Array; hival?: number };

function spaceOf(ctx: PDFDocument['context'], raw: any, depth = 0): Space | null {
  const o = ctx.lookup(raw);
  if (depth > 3 || !o) return null;
  if (o instanceof PDFName) {
    const nm = o.asString().replace(/^\//, '');
    if (nm === 'DeviceRGB' || nm === 'RGB' || nm === 'CalRGB') return { n: 3 };
    if (nm === 'DeviceGray' || nm === 'G' || nm === 'CalGray') return { n: 1 };
    return null;
  }
  if (o instanceof PDFArray && o.size() > 0) {
    const head = ctx.lookup(o.get(0));
    const nm = head instanceof PDFName ? head.asString().replace(/^\//, '') : '';
    if (nm === 'ICCBased') {
      const st = ctx.lookup(o.get(1));
      const n = st instanceof PDFRawStream ? num(ctx, st.dict, 'N') : undefined;
      return n === 1 ? { n: 1 } : n === 3 ? { n: 3 } : null;
    }
    if (nm === 'CalRGB' || nm === 'CalGray') return spaceOf(ctx, head, depth + 1);
    if (nm === 'Indexed' || nm === 'I') {
      const base = spaceOf(ctx, o.get(1), depth + 1);
      const hiv = ctx.lookup(o.get(2));
      const lk = ctx.lookup(o.get(3));
      if (!base || !(hiv instanceof PDFNumber)) return null;
      let table: Uint8Array | null = null;
      if (lk instanceof PDFString || lk instanceof PDFHexString) table = lk.asBytes();
      else if (lk instanceof PDFRawStream) table = decodePDFRawStream(lk).decode();
      if (!table) return null;
      const hival = Math.min(255, hiv.asNumber());
      const pal = new Uint8Array((hival + 1) * 3);
      for (let i = 0; i <= hival; i++) {
        for (let c = 0; c < 3; c++) pal[i * 3 + c] = base.n === 3 ? table[i * 3 + c] ?? 0 : table[i] ?? 0;
      }
      return { n: 3, palette: pal, hival };
    }
  }
  return null;
}

/** Sample data (any depth up to 8 bits) to one byte per component. Rows are padded to a whole byte. */
function unpack(data: Uint8Array, w: number, h: number, comps: number, bpc: number, scale: boolean): Uint8Array {
  if (bpc === 8) return data;
  const out = new Uint8Array(w * h * comps);
  const rowBytes = Math.ceil((w * comps * bpc) / 8);
  const max = (1 << bpc) - 1;
  let k = 0;
  for (let y = 0; y < h; y++) {
    for (let i = 0; i < w * comps; i++) {
      const bit = i * bpc;
      const byte = data[y * rowBytes + (bit >> 3)] ?? 0;
      const v = (byte >> (8 - bpc - (bit & 7))) & max;
      out[k++] = scale ? Math.round((v * 255) / max) : v;
    }
  }
  return out;
}

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (b: Uint8Array) => {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/** Encode 8-bit grey (1), RGB (3) or RGBA (4) pixels as a PNG file. */
export function encodePng(pixels: Uint8Array, w: number, h: number, comps: 1 | 3 | 4): Uint8Array {
  const raw = new Uint8Array((w * comps + 1) * h);
  for (let y = 0; y < h; y++) raw.set(pixels.subarray(y * w * comps, (y + 1) * w * comps), y * (w * comps + 1) + 1);
  const idat = zlibSync(raw, { level: 6 });
  const chunk = (type: string, body: Uint8Array) => {
    const out = new Uint8Array(12 + body.length);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, body.length);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(body, 8);
    dv.setUint32(8 + body.length, crc32(out.subarray(4, 8 + body.length)));
    return out;
  };
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  ihdr[8] = 8;
  ihdr[9] = comps === 1 ? 0 : comps === 3 ? 2 : 6;
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

type Hit = { key: string; page: number; stream: PDFRawStream };

function collect(doc: PDFDocument, pageIdx: number[]): Hit[] {
  const ctx = doc.context;
  const pages = doc.getPages();
  const seen = new Set<string>();
  const hits: Hit[] = [];
  const walk = (res: PDFDict | undefined, page: number, depth: number) => {
    if (!res || depth > 3) return;
    const xo = ctx.lookup(res.get(N('XObject')));
    if (!(xo instanceof PDFDict)) return;
    for (const [, v] of xo.entries()) {
      const key = v instanceof PDFRef ? v.toString() : '';
      if (key && seen.has(key)) continue;
      const st = ctx.lookup(v);
      if (!(st instanceof PDFRawStream)) continue;
      if (key) seen.add(key);
      const sub = ctx.lookup(st.dict.get(N('Subtype')));
      const subName = sub instanceof PDFName ? sub.asString() : '';
      if (subName === '/Image') hits.push({ key, page, stream: st });
      else if (subName === '/Form') {
        const r = ctx.lookup(st.dict.get(N('Resources')));
        if (r instanceof PDFDict) walk(r, page, depth + 1);
      }
    }
  };
  for (const i of pageIdx) {
    const node: any = pages[i].node;
    const res = node.Resources?.() ?? node.getInheritableAttribute?.(N('Resources'));
    walk(res instanceof PDFDict ? res : undefined, i + 1, 0);
  }
  return hits;
}

export async function extractImages(bytes: Uint8Array, opts: { pages?: number[]; minSize?: number } = {}): Promise<ExtractResult> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
  const ctx = doc.context;
  const idx = opts.pages && opts.pages.length ? opts.pages : doc.getPageIndices();
  const minSize = opts.minSize ?? 0;
  const res: ExtractResult = { images: [], tooSmall: 0, unsupported: 0, masks: 0 };
  for (const { stream, page } of collect(doc, idx)) {
    const d = stream.dict;
    const w = num(ctx, d, 'Width') || 0;
    const h = num(ctx, d, 'Height') || 0;
    if (!w || !h) { res.unsupported++; continue; }
    const mask = ctx.lookup(d.get(N('ImageMask')));
    if (mask && String(mask) === 'true') { res.masks++; continue; }
    if (Math.max(w, h) < minSize) { res.tooSmall++; continue; }
    const filters = filterNames(ctx, d);
    if (filters.length === 1 && filters[0] === 'DCTDecode') {
      res.images.push({ page, width: w, height: h, ext: 'jpg', mime: 'image/jpeg', bytes: stream.getContents() });
      continue;
    }
    if (filters.some((f) => !['FlateDecode', 'Fl', 'ASCIIHexDecode', 'ASCII85Decode', 'LZWDecode', 'RunLengthDecode', 'RL'].includes(f))) { res.unsupported++; continue; }
    const space = spaceOf(ctx, d.get(N('ColorSpace')));
    const bpc = num(ctx, d, 'BitsPerComponent') || 8;
    if (!space || bpc > 8 || (bpc !== 8 && !space.palette && space.n === 3)) { res.unsupported++; continue; }
    let raw: Uint8Array;
    try { raw = decodePDFRawStream(stream).decode(); } catch { res.unsupported++; continue; }
    const comps = space.palette ? 1 : space.n;
    if (raw.length < Math.ceil((w * comps * bpc) / 8) * h) { res.unsupported++; continue; }
    const samples = unpack(raw, w, h, comps, bpc, !space.palette);
    let rgb: Uint8Array;
    let n: 1 | 3 = space.n;
    if (space.palette) {
      rgb = new Uint8Array(w * h * 3);
      const top = (space.hival ?? 0) * 3;
      for (let i = 0; i < w * h; i++) {
        const p = Math.min(samples[i] * 3, top);
        rgb[i * 3] = space.palette[p]; rgb[i * 3 + 1] = space.palette[p + 1]; rgb[i * 3 + 2] = space.palette[p + 2];
      }
    } else {
      rgb = samples;
      const dec = ctx.lookup(d.get(N('Decode')));
      if (n === 1 && dec instanceof PDFArray && dec.size() === 2 && ctx.lookup(dec.get(0)) instanceof PDFNumber && (ctx.lookup(dec.get(0)) as PDFNumber).asNumber() === 1) {
        rgb = rgb.map((v) => 255 - v);
      }
    }
    // transparency from a soft mask of the same size
    const sm = ctx.lookup(d.get(N('SMask')));
    if (sm instanceof PDFRawStream && num(ctx, sm.dict, 'Width') === w && num(ctx, sm.dict, 'Height') === h && (num(ctx, sm.dict, 'BitsPerComponent') || 8) === 8) {
      try {
        const a = decodePDFRawStream(sm).decode();
        if (a.length >= w * h) {
          const out = new Uint8Array(w * h * 4);
          for (let i = 0; i < w * h; i++) {
            if (n === 1) { out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = rgb[i]; }
            else { out[i * 4] = rgb[i * 3]; out[i * 4 + 1] = rgb[i * 3 + 1]; out[i * 4 + 2] = rgb[i * 3 + 2]; }
            out[i * 4 + 3] = a[i];
          }
          res.images.push({ page, width: w, height: h, ext: 'png', mime: 'image/png', bytes: encodePng(out, w, h, 4) });
          continue;
        }
      } catch { /* fall through to the picture without transparency */ }
    }
    res.images.push({ page, width: w, height: h, ext: 'png', mime: 'image/png', bytes: encodePng(rgb, w, h, n) });
  }
  return res;
}
