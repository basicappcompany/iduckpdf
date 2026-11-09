/**
 * A small document layout engine on top of pdf-lib: it turns a list of blocks (paragraphs of styled runs, lists, tables, images,
 * rules, page breaks) into paginated PDF pages. The Word, HTML and Excel converters all produce blocks and hand them to this.
 *
 * It uses the 14 standard PDF fonts (sans, serif, mono), so characters outside Western European text cannot be drawn: they are
 * transliterated where possible (accents stripped) and otherwise replaced by "?", and the count is reported to the caller.
 */
import { PDFDocument, PDFFont, PDFImage, PDFPage, PDFString, StandardFonts, rgb } from 'pdf-lib';

export type Color = [number, number, number]; // 0..1
export type Family = 'sans' | 'serif' | 'mono';
export type Align = 'left' | 'center' | 'right' | 'justify';

export type Run = { text: string; bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; size?: number; color?: Color; family?: Family; link?: string; sup?: boolean; sub?: boolean };
export type Para = {
  type: 'p';
  runs: Run[];
  align?: Align;
  indent?: number; // left indent, points
  firstLine?: number; // extra indent of the first line (negative = hanging)
  rightIndent?: number;
  before?: number;
  after?: number;
  bullet?: string; // drawn in the left margin of the first line
  bulletIndent?: number; // where the bullet starts, from the left edge (default: just left of the text)
  lineHeight?: number; // multiplier of the font size, default 1.2
  bg?: Color;
  keepNext?: boolean;
  size?: number; // default size for runs without one
};
export type Img = { type: 'img'; bytes: Uint8Array; kind: 'png' | 'jpg'; width?: number; height?: number; align?: Align };
export type Cell = { blocks: Block[]; span?: number; bg?: Color };
export type Table = { type: 'table'; cols?: number[]; rows: { cells: Cell[]; header?: boolean }[]; border?: boolean; pad?: number; repeatHeader?: boolean };
export type Rule = { type: 'hr' };
export type Break = { type: 'pagebreak' };
export type Space = { type: 'space'; h: number };
export type Block = Para | Img | Table | Rule | Break | Space;

export type PageSpec = { width: number; height: number; margin: { top: number; right: number; bottom: number; left: number } };

type Item = {
  h: number;
  draw: (page: PDFPage, x: number, top: number) => void; // top = PDF y coordinate of the item's top edge
  newPage?: boolean;
  keepNext?: boolean;
  hdr?: Item; // table rows point at their header row so it can be repeated on each new page
  isHeader?: boolean;
};

export class Fonts {
  private cache = new Map<string, PDFFont>();
  replaced = 0;
  constructor(readonly doc: PDFDocument) {}
  private static NAMES: Record<Family, [StandardFonts, StandardFonts, StandardFonts, StandardFonts]> = {
    sans: [StandardFonts.Helvetica, StandardFonts.HelveticaBold, StandardFonts.HelveticaOblique, StandardFonts.HelveticaBoldOblique],
    serif: [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold, StandardFonts.TimesRomanItalic, StandardFonts.TimesRomanBoldItalic],
    mono: [StandardFonts.Courier, StandardFonts.CourierBold, StandardFonts.CourierOblique, StandardFonts.CourierBoldOblique],
  };
  async get(family: Family, bold: boolean, italic: boolean): Promise<PDFFont> {
    const key = `${family}${bold ? 'b' : ''}${italic ? 'i' : ''}`;
    let f = this.cache.get(key);
    if (!f) {
      f = await this.doc.embedFont(Fonts.NAMES[family][bold && italic ? 3 : bold ? 1 : italic ? 2 : 0]);
      this.cache.set(key, f);
    }
    return f;
  }
  /** Text the font can draw: accents stripped where the exact letter is missing, otherwise "?". */
  safe(font: PDFFont, text: string): string {
    let out = '';
    for (const ch of text.replace(/ /g, ' ').replace(/[ -   ]/g, ' ').replace(/[​-‍﻿]/g, '')) {
      if (ch === '\t') { out += '    '; continue; }
      try {
        font.encodeText(ch);
        out += ch;
        continue;
      } catch { /* try a plainer letter */ }
      const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
      try {
        if (base && base !== ch) {
          font.encodeText(base);
          out += base;
          continue;
        }
      } catch { /* fall through */ }
      out += ch === '−' ? '-' : ch === '–' || ch === '—' ? '-' : '?';
      if (out.endsWith('?')) this.replaced++;
    }
    return out;
  }
}

type Seg = { text: string; font: PDFFont; size: number; color: Color; x: number; w: number; underline?: boolean; strike?: boolean; link?: string; rise: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

async function layoutPara(p: Para, width: number, fonts: Fonts): Promise<Item[]> {
  const left = p.indent ?? 0;
  const right = p.rightIndent ?? 0;
  const base = p.size ?? 11;
  const lh = p.lineHeight ?? 1.2;
  // tokens: words and spaces, carrying their run style
  type Tok = { text: string; font: PDFFont; size: number; color: Color; underline?: boolean; strike?: boolean; link?: string; rise: number; space: boolean; br?: boolean; w: number };
  const toks: Tok[] = [];
  for (const r of p.runs) {
    const family = r.family ?? 'sans';
    const font = await fonts.get(family, !!r.bold, !!r.italic);
    const size = (r.size ?? base) * (r.sup || r.sub ? 0.7 : 1);
    const rise = r.sup ? (r.size ?? base) * 0.35 : r.sub ? -(r.size ?? base) * 0.15 : 0;
    const parts = r.text.split('\n');
    parts.forEach((part, pi) => {
      if (pi > 0) toks.push({ text: '', font, size, color: r.color ?? [0, 0, 0], rise, space: false, br: true, w: 0 });
      for (const piece of part.split(/(\s+)/)) {
        if (!piece) continue;
        const space = /^\s+$/.test(piece);
        const text = space ? ' '.repeat(Math.min(piece.replace(/\t/g, '    ').length, 4)) : fonts.safe(font, piece);
        toks.push({ text, font, size, color: r.color ?? [0, 0, 0], underline: r.underline, strike: r.strike, link: r.link, rise, space, w: font.widthOfTextAtSize(text, size) });
      }
    });
  }
  const lines: { segs: Seg[]; w: number; h: number; last: boolean; words: number }[] = [];
  let cur: Seg[] = [];
  let curW = 0;
  let curSize = 0;
  let words = 0;
  const avail = (first: boolean) => Math.max(20, width - left - right - (first ? (p.firstLine ?? 0) : 0));
  const flush = (last: boolean) => {
    // drop trailing spaces
    while (cur.length && cur[cur.length - 1].text.trim() === '') {
      curW -= cur[cur.length - 1].w;
      cur.pop();
    }
    const size = curSize || base;
    lines.push({ segs: cur, w: curW, h: size * lh, last, words });
    cur = [];
    curW = 0;
    curSize = 0;
    words = 0;
  };
  const push = (t: Tok, text: string, w: number) => {
    const prev = cur[cur.length - 1];
    if (prev && prev.font === t.font && prev.size === t.size && prev.color === t.color && prev.underline === t.underline && prev.strike === t.strike && prev.link === t.link && prev.rise === t.rise) {
      prev.text += text;
      prev.w += w;
    } else cur.push({ text, font: t.font, size: t.size, color: t.color, x: curW, w, underline: t.underline, strike: t.strike, link: t.link, rise: t.rise });
    curW += w;
    curSize = Math.max(curSize, t.size);
  };
  for (const t of toks) {
    const first = lines.length === 0;
    if (t.br) { flush(true); continue; }
    if (t.space) {
      if (cur.length) push(t, t.text, t.w);
      continue;
    }
    let text = t.text;
    let w = t.w;
    if (curW + w > avail(first) && cur.length) {
      flush(false);
    }
    // a word wider than a whole line is broken by characters
    while (w > avail(lines.length === 0) && text.length > 1) {
      let n = text.length - 1;
      while (n > 1 && t.font.widthOfTextAtSize(text.slice(0, n), t.size) > avail(lines.length === 0) - curW) n--;
      const head = text.slice(0, n);
      push(t, head, t.font.widthOfTextAtSize(head, t.size));
      flush(false);
      text = text.slice(n);
      w = t.font.widthOfTextAtSize(text, t.size);
    }
    push(t, text, w);
    words++;
  }
  if (cur.length || !lines.length) flush(true);
  else lines[lines.length - 1].last = true;

  const items: Item[] = [];
  if (p.before) items.push({ h: p.before, draw: () => {} });
  lines.forEach((ln, i) => {
    const first = i === 0;
    const x0 = left + (first ? p.firstLine ?? 0 : 0);
    const room = width - x0 - right;
    let shift = 0;
    let extra = 0;
    if (p.align === 'center') shift = Math.max(0, (room - ln.w) / 2);
    else if (p.align === 'right') shift = Math.max(0, room - ln.w);
    else if (p.align === 'justify' && !ln.last && ln.words > 1 && ln.w > room * 0.6) extra = (room - ln.w) / Math.max(1, ln.segs.reduce((n, s) => n + (s.text.match(/ /g) || []).length, 0));
    const lineH = ln.h;
    const maxSize = ln.segs.reduce((m, s) => Math.max(m, s.size), 0) || base;
    const item: Item = {
      h: lineH,
      keepNext: i < lines.length - 1 ? undefined : p.keepNext,
      draw(page, x, top) {
        if (p.bg) page.drawRectangle({ x, y: top - lineH, width, height: lineH, color: rgb(...p.bg) });
        if (first && p.bullet) {
          const bf = ln.segs[0]?.font;
          if (bf) {
            const bw = bf.widthOfTextAtSize(p.bullet, maxSize);
            page.drawText(p.bullet, { x: x + (p.bulletIndent !== undefined ? p.bulletIndent : left + (p.firstLine ?? 0) - bw - 4), y: top - maxSize * 0.88 - (lineH - maxSize * 1.2) / 2, size: maxSize, font: bf, color: rgb(...ln.segs[0].color) });
          }
        }
        let cx = x + x0 + shift;
        for (const s of ln.segs) {
          const y = top - maxSize * 0.88 - (lineH - maxSize * 1.2) / 2 + s.rise;
          const spaces = (s.text.match(/ /g) || []).length;
          const w = s.w + extra * spaces;
          if (extra && spaces) {
            // justified: draw word by word so the gaps can stretch
            let wx = cx;
            for (const part of s.text.split(/( )/)) {
              if (!part) continue;
              if (part !== ' ') page.drawText(part, { x: wx, y, size: s.size, font: s.font, color: rgb(...s.color) });
              wx += s.font.widthOfTextAtSize(part, s.size) + (part === ' ' ? extra : 0);
            }
          } else if (s.text.trim()) page.drawText(s.text, { x: cx, y, size: s.size, font: s.font, color: rgb(...s.color) });
          if (s.underline) page.drawLine({ start: { x: cx, y: y - s.size * 0.12 }, end: { x: cx + w, y: y - s.size * 0.12 }, thickness: Math.max(0.5, s.size * 0.06), color: rgb(...s.color) });
          if (s.strike) page.drawLine({ start: { x: cx, y: y + s.size * 0.3 }, end: { x: cx + w, y: y + s.size * 0.3 }, thickness: Math.max(0.5, s.size * 0.06), color: rgb(...s.color) });
          if (s.link) {
            const ctx = page.doc.context;
            const annot = ctx.obj({ Type: 'Annot', Subtype: 'Link', Rect: [cx, y - s.size * 0.25, cx + w, y + s.size * 0.9], Border: [0, 0, 0], A: { Type: 'Action', S: 'URI', URI: PDFString.of(s.link) } });
            page.node.addAnnot(ctx.register(annot));
          }
          cx += w;
        }
      },
    };
    items.push(item);
  });
  if (p.after) items.push({ h: p.after, draw: () => {} });
  return items;
}

async function layoutImage(b: Img, width: number, maxH: number, fonts: Fonts): Promise<Item[]> {
  let img: PDFImage;
  try {
    img = b.kind === 'png' ? await fonts.doc.embedPng(b.bytes) : await fonts.doc.embedJpg(b.bytes);
  } catch {
    return [];
  }
  let w = b.width ?? img.width * 0.75;
  let h = b.height ?? (w * img.height) / img.width;
  const k = Math.min(1, width / w, maxH / h);
  w *= k;
  h *= k;
  const shift = b.align === 'center' ? (width - w) / 2 : b.align === 'right' ? width - w : 0;
  return [{ h: h + 4, draw: (page, x, top) => page.drawImage(img, { x: x + shift, y: top - h, width: w, height: h }) }];
}

async function layoutTable(t: Table, width: number, maxH: number, fonts: Fonts, depth: number): Promise<Item[]> {
  const ncols = Math.max(1, ...t.rows.map((r) => r.cells.reduce((n, c) => n + (c.span ?? 1), 0)));
  const rel = t.cols && t.cols.length === ncols ? t.cols : Array(ncols).fill(1);
  const total = rel.reduce((a, b) => a + b, 0) || 1;
  const colW = rel.map((v) => (v / total) * width);
  const pad = t.pad ?? 4;
  const border = t.border !== false;
  const items: Item[] = [];
  for (const row of t.rows) {
    let col = 0;
    const cells: { x: number; w: number; items: Item[]; h: number; bg?: Color }[] = [];
    for (const c of row.cells) {
      const span = Math.max(1, c.span ?? 1);
      const w = colW.slice(col, col + span).reduce((a, b) => a + b, 0);
      const x = colW.slice(0, col).reduce((a, b) => a + b, 0);
      const inner = await layoutBlocks(c.blocks, Math.max(10, w - pad * 2), maxH, fonts, depth + 1);
      cells.push({ x, w, items: inner, h: inner.reduce((s, i) => s + i.h, 0) + pad * 2, bg: c.bg });
      col += span;
    }
    const h = Math.max(...cells.map((c) => c.h), 8 + pad * 2);
    items.push({
      h,
      draw(page, x, top) {
        for (const c of cells) {
          if (c.bg) page.drawRectangle({ x: x + c.x, y: top - h, width: c.w, height: h, color: rgb(...c.bg) });
          if (border) page.drawRectangle({ x: x + c.x, y: top - h, width: c.w, height: h, borderColor: rgb(0.55, 0.55, 0.55), borderWidth: 0.5 });
          let y = top - pad;
          for (const it of c.items) {
            it.draw(page, x + c.x + pad, y);
            y -= it.h;
          }
        }
      },
    });
  }
  if (t.repeatHeader && items.length > 1) {
    items[0].isHeader = true;
    for (let i = 1; i < items.length; i++) items[i].hdr = items[0];
  }
  return items;
}

export async function layoutBlocks(blocks: Block[], width: number, maxH: number, fonts: Fonts, depth = 0): Promise<Item[]> {
  const out: Item[] = [];
  for (const b of blocks) {
    if (b.type === 'p') out.push(...(await layoutPara(b, width, fonts)));
    else if (b.type === 'img') out.push(...(await layoutImage(b, width, maxH, fonts)));
    else if (b.type === 'table' && depth < 3) out.push(...(await layoutTable(b, width, maxH, fonts, depth)));
    else if (b.type === 'hr') out.push({ h: 10, draw: (page, x, top) => page.drawLine({ start: { x, y: top - 5 }, end: { x: x + width, y: top - 5 }, thickness: 0.7, color: rgb(0.6, 0.6, 0.6) }) });
    else if (b.type === 'space') out.push({ h: b.h, draw: () => {} });
    else if (b.type === 'pagebreak') out.push({ h: 0, draw: () => {}, newPage: true });
  }
  return out;
}

/** Lay out the blocks and add the pages to `doc`. Returns how many pages were added. */
export async function renderBlocks(doc: PDFDocument, fonts: Fonts, blocks: Block[], spec: PageSpec): Promise<number> {
  const width = spec.width - spec.margin.left - spec.margin.right;
  const maxH = spec.height - spec.margin.top - spec.margin.bottom;
  const items = await layoutBlocks(blocks, width, maxH, fonts);
  let page = doc.addPage([spec.width, spec.height]);
  let pages = 1;
  let y = 0; // distance used from the top margin
  const fresh = () => {
    page = doc.addPage([spec.width, spec.height]);
    pages++;
    y = 0;
  };
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.newPage) {
      if (y > 0) fresh();
      continue;
    }
    const next = it.keepNext ? items[i + 1] : undefined;
    const need = it.h + (next ? Math.min(next.h, 40) : 0);
    if (y > 0 && y + need > maxH) {
      fresh();
      if (it.hdr && !it.isHeader) {
        it.hdr.draw(page, spec.margin.left, spec.height - spec.margin.top);
        y += it.hdr.h;
      }
    }
    it.draw(page, spec.margin.left, spec.height - spec.margin.top - y);
    y += it.h;
  }
  return pages;
}

export const PT = { mm: 72 / 25.4, inch: 72, twip: 1 / 20, emu: 1 / 12700 };
export { clamp };
export const rgbOf = (hex: string): Color | undefined => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return undefined;
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/**
 * Draw blocks inside a box without paginating (used for slides and table cells that must stay where they are). `top` is the PDF y
 * coordinate of the box's top edge. Returns the height the content needs, so callers can tell when it overflows.
 */
export async function drawBlocks(page: PDFPage, fonts: Fonts, blocks: Block[], x: number, top: number, width: number, height: number, anchor: 't' | 'ctr' | 'b' = 't'): Promise<number> {
  const items = await layoutBlocks(blocks, Math.max(8, width), height, fonts);
  const total = items.reduce((s, i) => s + i.h, 0);
  let y = top - (anchor === 'ctr' ? Math.max(0, (height - total) / 2) : anchor === 'b' ? Math.max(0, height - total) : 0);
  for (const it of items) {
    if (it.newPage) continue;
    it.draw(page, x, y);
    y -= it.h;
  }
  return total;
}
