// Mobile apps are future scope. Rendering will need a WebView-hosted pdf.js or a native module.
import { ToolError } from './util';

const later = () => new ToolError('This tool is browser-only for now. The mobile apps are coming later.');

export async function getPdfjs(): Promise<any> {
  throw later();
}
export async function openPdfjs(_b: Uint8Array): Promise<any> {
  throw later();
}
export type Rendered = { canvas: any; viewport: any; page: any };
export async function renderPage(_d: any, _p: number, _s: number): Promise<Rendered> {
  throw later();
}
export async function canvasToBytes(_c: any, _m: 'image/jpeg' | 'image/png', _q?: number): Promise<Uint8Array> {
  throw later();
}
export async function textByPage(_b: Uint8Array, _cb?: (i: number, n: number) => void): Promise<string[]> {
  throw later();
}
