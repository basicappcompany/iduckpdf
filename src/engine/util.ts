import { PDFDocument, PDFFont, rgb } from 'pdf-lib';
import type { OutFile, PickedFile } from './types';
import { ToolError } from './base';

export { ToolError, MM, INCH, PAGE_SIZES, baseName, fmtBytes, toBlob } from './base';

export function pdfOut(name: string, bytes: Uint8Array): OutFile {
  return { name, mime: 'application/pdf', bytes };
}

export async function loadDoc(f: PickedFile, opts: { updateMetadata?: boolean; lenient?: boolean } = {}): Promise<PDFDocument> {
  const bytes = await f.bytes();
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, {
      ignoreEncryption: true,
      updateMetadata: opts.updateMetadata ?? true,
      throwOnInvalidObject: !opts.lenient,
    });
  } catch {
    throw new ToolError(`“${f.name}” could not be read. It may be damaged or not a real PDF. Try the Repair tool.`);
  }
  if (doc.isEncrypted) {
    throw new ToolError(`“${f.name}” is password-protected. Unlocking is on the roadmap, so remove the password first.`);
  }
  return doc;
}

export async function save(doc: PDFDocument): Promise<Uint8Array> {
  return doc.save({ useObjectStreams: true });
}

/**
 * Parse page specs like "1-3, 5, 8-", "odd", "even", "last" into 0-based indices.
 * blank: what an empty spec means.
 */
export function parsePages(
  spec: string | undefined,
  total: number,
  o: { blank?: 'all' | 'error'; unique?: boolean } = {},
): number[] {
  const s = (spec || '').trim().toLowerCase();
  if (!s) {
    if (o.blank === 'error') throw new ToolError('Enter which pages you mean, for example 1-3, 5, 8-');
    return Array.from({ length: total }, (_, i) => i);
  }
  const out: number[] = [];
  for (const raw of s.split(/[,;\s]+/).filter(Boolean)) {
    const tok = raw.replace(/last/g, String(total)).replace(/first/g, '1');
    if (tok === 'all') {
      for (let i = 0; i < total; i++) out.push(i);
      continue;
    }
    if (tok === 'odd' || tok === 'even') {
      for (let i = 0; i < total; i++) if ((i + 1) % 2 === (tok === 'odd' ? 1 : 0)) out.push(i);
      continue;
    }
    const m = tok.match(/^(\d*)-(\d*)$/) || tok.match(/^(\d+)$/);
    if (!m) throw new ToolError(`“${raw}” is not a page or range. Use things like 3, 2-5 or 8-`);
    const a = m[2] === undefined ? +m[1] : m[1] ? +m[1] : 1;
    const b = m[2] === undefined ? +m[1] : m[2] ? +m[2] : total;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    if (lo < 1 || hi > total) throw new ToolError(`Page ${lo < 1 ? lo : hi} is out of range. This PDF has ${total} page${total === 1 ? '' : 's'}.`);
    if (a <= b) for (let i = lo; i <= hi; i++) out.push(i - 1);
    else for (let i = hi; i >= lo; i--) out.push(i - 1);
  }
  if (!out.length) throw new ToolError('No pages matched.');
  return o.unique === false ? out : Array.from(new Set(out));
}

/** Split "1-3, 5" into separate groups (one per comma), each a list of 0-based indices. */
export function parseGroups(spec: string, total: number): number[][] {
  const parts = spec.split(/[,;]+/).map((p) => p.trim()).filter(Boolean);
  if (!parts.length) throw new ToolError('Enter at least one range, for example 1-3, 4, 5-');
  return parts.map((p) => parsePages(p, total));
}

const COLORS: Record<string, [number, number, number]> = {
  black: [0.1, 0.1, 0.1],
  gray: [0.5, 0.5, 0.5],
  red: [0.85, 0.15, 0.15],
  blue: [0.1, 0.3, 0.85],
  green: [0.1, 0.55, 0.25],
  white: [1, 1, 1],
};
export const colorOf = (name: string) => {
  const c = COLORS[name] || COLORS.black;
  return rgb(c[0], c[1], c[2]);
};

/** Standard PDF fonts only cover Latin-1. Swap anything else for “?” instead of crashing. */
export function safeText(font: PDFFont, text: string): string {
  let out = '';
  for (const ch of text) {
    if (ch === '\n' || ch === '\t') {
      out += ch === '\t' ? '    ' : ' ';
      continue;
    }
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      out += '?';
    }
  }
  return out;
}

export function wrapText(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    if (!para.trim()) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const word of para.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) <= maxWidth) line = test;
      else {
        if (line) lines.push(line);
        // very long single words: hard-break
        let w = word;
        while (font.widthOfTextAtSize(w, size) > maxWidth && w.length > 1) {
          let cut = w.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), size) > maxWidth) cut--;
          lines.push(w.slice(0, cut));
          w = w.slice(cut);
        }
        line = w;
      }
    }
    lines.push(line);
  }
  return lines;
}

export function expandTokens(s: string, v: { n: number; total: number; file: string }): string {
  const d = new Date();
  return s
    .replace(/\{n\}/g, String(v.n))
    .replace(/\{total\}/g, String(v.total))
    .replace(/\{file\}/g, v.file)
    .replace(/\{date\}/g, d.toISOString().slice(0, 10));
}

export function needOne(files: PickedFile[] | undefined, what = 'a PDF'): PickedFile {
  if (!files || !files.length) throw new ToolError(`Add ${what} first.`);
  return files[0];
}
