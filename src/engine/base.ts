// Small helpers with NO heavy dependencies (no pdf-lib), so the pages that only list tools or move files around
// never pull the PDF engine into their bundle. engine/util.ts re-exports everything here for the tools.
export class ToolError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ToolError';
    this.code = code;
  }
}

export const MM = 72 / 25.4;
export const INCH = 72;

export const PAGE_SIZES: Record<string, [number, number]> = {
  a3: [841.89, 1190.55],
  a4: [595.28, 841.89],
  a5: [419.53, 595.28],
  letter: [612, 792],
  legal: [612, 1008],
};

export const baseName = (n: string) => n.replace(/\.[^.]+$/, '') || 'file';

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 2 : 1)} MB`;
}

export function toBlob(bytes: Uint8Array, mime: string): Blob {
  return new Blob([bytes as unknown as BlobPart], { type: mime });
}
