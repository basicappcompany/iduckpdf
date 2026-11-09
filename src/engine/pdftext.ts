/**
 * Reads the text of a PDF page as positioned pieces, then rebuilds lines, paragraphs and tables from where the pieces sit.
 * Used by PDF to Word and PDF to Excel. It works on PDFs that have a real text layer; scans need OCR first.
 */
import { getPdfjs } from './render';

export type Piece = { str: string; x: number; y: number; w: number; h: number; bold: boolean; italic: boolean }; // y: baseline from the top of the displayed page
export type Cell = { text: string; x0: number; x1: number };
export type Line = { y: number; h: number; cells: Cell[]; text: string; bold: boolean; x0: number };

const median = (a: number[]) => {
  const s = a.filter((v) => v > 0).sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : 10;
};

export async function pagePieces(page: any): Promise<{ pieces: Piece[]; width: number; height: number }> {
  const lib = await getPdfjs();
  const vp = page.getViewport({ scale: 1 });
  const tc = await page.getTextContent();
  const styles = tc.styles || {};
  const pieces: Piece[] = [];
  for (const it of tc.items as any[]) {
    if (!it.str || !it.str.trim()) continue;
    const t = lib.Util.transform(vp.transform, it.transform);
    const h = Math.hypot(t[2], t[3]) || it.height || 10;
    const fam = String(styles[it.fontName]?.fontFamily || '') + ' ' + String(it.fontName || '');
    pieces.push({ str: it.str, x: t[4], y: t[5], w: it.width || 0, h, bold: /bold|black|heavy|semibold/i.test(fam), italic: /italic|oblique/i.test(fam) });
  }
  return { pieces, width: vp.width, height: vp.height };
}

/** Group pieces into lines (by baseline) and split each line into cells wherever there is a clear horizontal gap. */
export function buildLines(pieces: Piece[]): Line[] {
  if (!pieces.length) return [];
  const body = median(pieces.map((p) => p.h));
  const tol = body * 0.45;
  const sorted = [...pieces].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: Piece[][] = [];
  for (const p of sorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last[0].y - p.y) <= tol) last.push(p);
    else rows.push([p]);
  }
  const lines: Line[] = [];
  for (const r of rows) {
    r.sort((a, b) => a.x - b.x);
    const cells: Cell[] = [];
    let cur: Cell | null = null;
    let prevEnd = 0;
    const gapAt = Math.max(7, body * 0.9);
    for (const p of r) {
      const gap = cur ? p.x - prevEnd : 0;
      if (!cur || gap > gapAt) {
        cur = { text: p.str.trim(), x0: p.x, x1: p.x + p.w };
        cells.push(cur);
      } else {
        cur.text += (gap > body * 0.12 || /\s$/.test(cur.text) ? ' ' : '') + p.str.trim();
        cur.x1 = p.x + p.w;
      }
      prevEnd = p.x + p.w;
    }
    const h = Math.max(...r.map((p) => p.h));
    lines.push({ y: r[0].y, h, cells, text: cells.map((c) => c.text).join(' '), bold: r.every((p) => p.bold), x0: cells[0].x0 });
  }
  return lines;
}

export type Grid = { rows: string[][]; columns: number };

/** Rows with two or more cells define the columns; every row's cells are then dropped into the column they overlap. */
export function detectTable(lines: Line[]): Grid {
  const multi = lines.filter((l) => l.cells.length >= 2);
  type Col = { x0: number; x1: number };
  const cols: Col[] = [];
  const overlap = (a: Col, b: Col) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  for (const l of multi) for (const c of l.cells) {
    const w = Math.max(1, c.x1 - c.x0);
    const hit = cols.find((k) => overlap(k, c) > 0.3 * Math.min(w, Math.max(1, k.x1 - k.x0)) || Math.abs(k.x0 - c.x0) < 6 || Math.abs(k.x1 - c.x1) < 6);
    if (hit) { hit.x0 = Math.min(hit.x0, c.x0); hit.x1 = Math.max(hit.x1, c.x1); } else cols.push({ x0: c.x0, x1: c.x1 });
  }
  cols.sort((a, b) => a.x0 - b.x0);
  // merge columns that grew into each other
  for (let i = 0; i < cols.length - 1; ) {
    if (cols[i].x1 > cols[i + 1].x0 + 2) { cols[i].x1 = Math.max(cols[i].x1, cols[i + 1].x1); cols.splice(i + 1, 1); } else i++;
  }
  const n = Math.max(1, cols.length);
  const rows = lines.map((l) => {
    const out: string[] = new Array(n).fill('');
    if (l.cells.length === 1 || !cols.length) { out[0] = l.text; return out; }
    for (const c of l.cells) {
      let best = 0;
      let bestScore = -1e9;
      cols.forEach((k, i) => {
        const score = overlap(k, c) - Math.abs((k.x0 + k.x1) / 2 - (c.x0 + c.x1) / 2) * 0.01;
        if (score > bestScore) { bestScore = score; best = i; }
      });
      out[best] = out[best] ? out[best] + ' ' + c.text : c.text;
    }
    return out;
  });
  return { rows, columns: n };
}

export type Para = { text: string; size: number; bold: boolean; italic: boolean; heading: 0 | 1 | 2 | 3; left: number; gapBefore: boolean; list?: string };

/** Lines to paragraphs: a new paragraph starts after a bigger vertical gap, a change of size, or a list marker. */
export function buildParagraphs(lines: Line[]): Para[] {
  if (!lines.length) return [];
  const body = median(lines.map((l) => l.h));
  const out: Para[] = [];
  let prev: Line | null = null;
  let cur: Para | null = null;
  const marker = /^(•|●|▪|-|\*|\d{1,3}[.)]|[a-z][.)])\s+/;
  for (const l of lines) {
    const text = l.text.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const size = l.h;
    const gap = prev ? l.y - prev.y - prev.h : 0;
    const startsList = marker.test(text);
    const newPara = !cur || gap > body * 0.55 || Math.abs(size - cur.size) > body * 0.2 || startsList || l.x0 - cur.left > body * 1.5;
    if (newPara) {
      const ratio = size / body;
      const heading = ratio >= 1.7 ? 1 : ratio >= 1.35 ? 2 : ratio >= 1.15 && l.bold ? 3 : 0;
      cur = { text, size, bold: l.bold, italic: false, heading: heading as 0 | 1 | 2 | 3, left: l.x0, gapBefore: gap > body * 0.55, list: startsList ? (text.match(marker) || [''])[0].trim() : undefined };
      out.push(cur);
    } else if (cur) {
      // join wrapped lines, healing a hyphen at the end of a line
      cur.text = /[-­]$/.test(cur.text) && /^[a-z]/.test(text) ? cur.text.slice(0, -1) + text : cur.text + ' ' + text;
      cur.bold = cur.bold && l.bold;
    }
    prev = l;
  }
  return out;
}

/** A plain number written the usual ways (1,234.50 or -12 or (45)), else null. Leading-zero codes such as 007 stay text. */
export function toNumber(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const neg = /^\(.*\)$/.test(t);
  const core = t.replace(/^\(|\)$/g, '');
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(core) || /^-?\d+(\.\d+)?$/.test(core)) {
    if (/^-?0\d/.test(core) && !core.includes('.')) return null;
    const n = Number(core.replace(/,/g, ''));
    return isFinite(n) ? (neg ? -n : n) : null;
  }
  return null;
}

/**
 * Two-column pages: if a clear vertical gutter runs down the middle (no text crosses it, for most of the page), the pieces are
 * returned as two groups, left column first, so the text is read column by column instead of line by line across both.
 */
export function splitColumns(pieces: Piece[], pageWidth: number): Piece[][] {
  if (pieces.length < 40) return [pieces];
  const lo = pageWidth * 0.3;
  const hi = pageWidth * 0.7;
  const step = 2;
  const blocked: boolean[] = [];
  for (let x = Math.floor(lo); x < hi; x += step) blocked.push(pieces.some((p) => p.x < x + step && p.x + p.w > x));
  // find the widest empty stretch in the middle band
  let best = { from: -1, len: 0 };
  let from = -1;
  blocked.forEach((b, i) => {
    if (!b && from < 0) from = i;
    if ((b || i === blocked.length - 1) && from >= 0) {
      const len = (b ? i : i + 1) - from;
      if (len > best.len) best = { from, len };
      from = -1;
    }
  });
  if (best.len * step < 12) return [pieces];
  const gutter = lo + (best.from + best.len / 2) * step;
  const left = pieces.filter((p) => p.x + p.w / 2 < gutter);
  const right = pieces.filter((p) => p.x + p.w / 2 >= gutter);
  // only a real two-column page has plenty of text on both sides
  if (left.length < pieces.length * 0.25 || right.length < pieces.length * 0.25) return [pieces];
  return [left, right];
}
