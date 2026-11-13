// pdf.js (served from /vendor, copied from node_modules on install) for anything that needs to
// look at page content: rendering to images, text extraction, rasterising. Browser only for now.
import { ToolError } from './base';

declare global {
  interface Window {
    pdfjsLib?: any;
  }
}

let loader: Promise<any> | null = null;

export function getPdfjs(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new ToolError('This tool needs a browser.'));
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (!loader) {
    loader = new Promise((resolve, reject) => {
      // pdf.js is an ES module; this tiny same-origin module imports it, sets the worker and hangs it on window.pdfjsLib
      const s = document.createElement('script');
      s.type = 'module';
      s.src = '/vendor/pdfjs-loader.mjs';
      s.onload = () => {
        const lib = window.pdfjsLib;
        if (!lib) return reject(new ToolError('The PDF engine failed to start.'));
        resolve(lib);
      };
      s.onerror = () => {
        loader = null;
        reject(new ToolError('Could not load the PDF engine. Check your connection and try again.'));
      };
      document.head.appendChild(s);
    });
  }
  return loader;
}

export async function openPdfjs(bytes: Uint8Array): Promise<any> {
  const lib = await getPdfjs();
  try {
    return await lib.getDocument({
      data: bytes.slice(),
      isEvalSupported: false, // never compile PDF-supplied code (CVE-2024-4367)
      wasmUrl: '/vendor/pdfjs/wasm/',
      standardFontDataUrl: '/vendor/pdfjs/standard_fonts/',
      cMapUrl: '/vendor/pdfjs/cmaps/',
      cMapPacked: true,
    }).promise;
  } catch (e: any) {
    if (e && e.name === 'PasswordException') throw new ToolError('This PDF is password-protected.');
    throw new ToolError('This PDF could not be opened. It may be damaged. Try the Repair tool.');
  }
}

export type Rendered = { canvas: HTMLCanvasElement; viewport: any; page: any };

export async function renderPage(doc: any, pageNo: number, scale: number): Promise<Rendered> {
  const page = await doc.getPage(pageNo);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return { canvas, viewport, page };
}

export function canvasToBytes(canvas: HTMLCanvasElement, mime: 'image/jpeg' | 'image/png', quality = 0.85): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (b) => {
        if (!b) return reject(new ToolError('Could not encode an image. The page may be too large; try a lower quality.'));
        resolve(new Uint8Array(await b.arrayBuffer()));
      },
      mime,
      quality,
    );
  });
}

/** Text of every page, in reading order. Empty strings for pages with no text layer. */
export async function textByPage(bytes: Uint8Array, onPage?: (i: number, n: number) => void): Promise<string[]> {
  const doc = await openPdfjs(bytes);
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    let t = '';
    for (const it of tc.items as any[]) {
      t += it.str;
      t += it.hasEOL ? '\n' : '';
    }
    out.push(t.replace(/[ \t]+\n/g, '\n').trim());
    onPage && onPage(i, doc.numPages);
  }
  return out;
}
