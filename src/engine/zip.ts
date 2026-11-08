import JSZip from 'jszip';
import type { OutFile } from './types';

export async function zipFiles(files: OutFile[], name: string): Promise<OutFile> {
  const z = new JSZip();
  files.forEach((f) => z.file(f.name, f.bytes));
  const bytes = await z.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  return { name, mime: 'application/zip', bytes };
}
