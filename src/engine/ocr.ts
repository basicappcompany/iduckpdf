// Tesseract.js (OCR) from /vendor, copied from node_modules on install (see scripts/copy-vendor.js). Like pdf.js it is loaded with a
// script tag the first time it is needed, so none of it is in the main bundle, and nothing comes from a third-party CDN.
import { ToolError } from './base';

declare global {
  interface Window {
    Tesseract?: any;
  }
}

export type OcrWord = { text: string; x0: number; y0: number; x1: number; y1: number; confidence: number };

/** Languages whose letters the standard PDF fonts can write into the invisible text layer. */
export const OCR_LANGUAGES: { value: string; label: string }[] = [
  { value: 'eng', label: 'English' },
  { value: 'spa', label: 'Español' },
  { value: 'fra', label: 'Français' },
  { value: 'deu', label: 'Deutsch' },
  { value: 'ita', label: 'Italiano' },
  { value: 'por', label: 'Português' },
  { value: 'nld', label: 'Nederlands' },
];

let loader: Promise<any> | null = null;

export function getTesseract(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new ToolError('OCR needs a browser.'));
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (!loader) {
    loader = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = '/vendor/tesseract/tesseract.min.js';
      s.async = true;
      s.onload = () => (window.Tesseract ? resolve(window.Tesseract) : reject(new ToolError('The OCR engine failed to start.')));
      s.onerror = () => {
        loader = null;
        reject(new ToolError('Could not load the OCR engine. Check your connection and try again.'));
      };
      document.head.appendChild(s);
    });
  }
  return loader;
}

/** Starts a recognition worker for one language. `onProgress` receives 0..1 for the page being read. */
export async function createOcrWorker(lang: string, onProgress: (fraction: number) => void): Promise<any> {
  const T = await getTesseract();
  const base = `${location.origin}/vendor/tesseract`;
  try {
    return await T.createWorker(lang, 1, {
      workerPath: `${base}/worker.min.js`,
      corePath: `${base}/core`,
      langPath: `${base}/lang`,
      workerBlobURL: false,
      logger: (m: any) => {
        if (m && m.status === 'recognizing text' && typeof m.progress === 'number') onProgress(m.progress);
      },
    });
  } catch {
    throw new ToolError('The OCR engine could not start. Check your connection and try again.');
  }
}

/** Read one image (a canvas, a Blob, ...) and return every word with its box in image pixels. */
export async function recognizeWords(worker: any, image: unknown): Promise<{ words: OcrWord[]; text: string }> {
  const { data } = await worker.recognize(image, {}, { blocks: true });
  const words: OcrWord[] = [];
  for (const b of data.blocks || []) for (const p of b.paragraphs || []) for (const l of p.lines || []) for (const w of l.words || []) {
    if (w && w.text && w.bbox) words.push({ text: String(w.text), x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1, confidence: Number(w.confidence) || 0 });
  }
  return { words, text: String(data.text || '') };
}
