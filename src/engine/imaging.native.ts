// Mobile apps are future scope.
import type { PickedFile } from './types';
import { ToolError } from './util';

export type ImgMode = 'color' | 'gray' | 'bw' | 'enhance';
export type Processed = { bytes: Uint8Array; kind: 'jpg' | 'png'; width: number; height: number };

export function filterCanvas(_c: any, _m: 'gray' | 'invert' | 'sepia' | 'bw' | 'enhance'): void {
  throw new ToolError('This tool is browser-only for now.');
}
export async function processImage(_f: PickedFile, _o: { maxSide: number; quality: number; mode: ImgMode }): Promise<Processed> {
  throw new ToolError('This tool is browser-only for now. The mobile apps are coming later.');
}
