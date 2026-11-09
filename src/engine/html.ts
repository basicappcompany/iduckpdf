/**
 * HTML to layout blocks. This is not a browser: it reads the structure (headings, paragraphs, lists, tables, images, links,
 * emphasis, code) and a few inline styles (colour, bold, italic, alignment, size) and ignores style sheets and scripts. That is
 * enough for articles, documentation and saved web pages, and is stated plainly on the tool page.
 */
import type { Align, Block, Cell, Color, Family, Para, Run } from './layout';
import { rgbOf } from './layout';

type Style = { bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; color?: Color; family?: Family; size?: number; link?: string; sup?: boolean; sub?: boolean };
type Ctx = { blocks: Block[]; images: number; skippedImages: number; baseSize: number };

const SKIP = new Set(['script', 'style', 'head', 'noscript', 'template', 'svg', 'canvas', 'iframe', 'object', 'embed', 'audio', 'video', 'select', 'button', 'input', 'textarea', 'nav', 'dialog']);
const HEADING: Record<string, number> = { h1: 2.1, h2: 1.65, h3: 1.35, h4: 1.15, h5: 1, h6: 0.9 };
const BLOCKS = new Set(['p', 'div', 'section', 'article', 'header', 'footer', 'main', 'aside', 'blockquote', 'ul', 'ol', 'li', 'pre', 'table', 'hr', 'figure', 'figcaption', 'address', 'details', 'summary', 'dl', 'dt', 'dd', 'center', 'body', 'html', 'form', 'fieldset', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

const cssColor = (v: string): Color | undefined => {
  const t = v.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3})$/.exec(t);
  if (hex) return rgbOf('#' + hex[1].split('').map((c) => c + c).join(''));
  if (/^#[0-9a-f]{6}$/.test(t)) return rgbOf(t);
  const m = /^rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(t);
  if (m) return [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255];
  const names: Record<string, Color> = { black: [0, 0, 0], white: [1, 1, 1], red: [0.8, 0, 0], green: [0, 0.5, 0], blue: [0, 0, 0.8], gray: [0.5, 0.5, 0.5], grey: [0.5, 0.5, 0.5], orange: [1, 0.55, 0], purple: [0.5, 0, 0.5], navy: [0, 0, 0.5] };
  return names[t];
};
const styleAttr = (el: any): Record<string, string> => {
  const out: Record<string, string> = {};
  const raw = el.getAttribute && el.getAttribute('style');
  if (raw) for (const part of String(raw).split(';')) {
    const i = part.indexOf(':');
    if (i > 0) out[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
  }
  return out;
};
const lenToPt = (v: string, base: number): number | undefined => {
  const m = /^([\d.]+)\s*(px|pt|em|rem|%)?$/i.exec(v.trim());
  if (!m) return undefined;
  const n = Number(m[1]);
  const u = (m[2] || 'px').toLowerCase();
  return u === 'pt' ? n : u === 'px' ? n * 0.75 : u === 'em' || u === 'rem' ? n * base : u === '%' ? (n / 100) * base : undefined;
};

function styled(el: any, st: Style, base: number): Style {
  const tag = String(el.nodeName || '').toLowerCase();
  const out: Style = { ...st };
  if (tag === 'b' || tag === 'strong' || tag === 'th') out.bold = true;
  if (tag === 'i' || tag === 'em' || tag === 'cite' || tag === 'dfn' || tag === 'var') out.italic = true;
  if (tag === 'u' || tag === 'ins') out.underline = true;
  if (tag === 's' || tag === 'del' || tag === 'strike') out.strike = true;
  if (tag === 'code' || tag === 'kbd' || tag === 'samp' || tag === 'tt') out.family = 'mono';
  if (tag === 'sup') out.sup = true;
  if (tag === 'sub') out.sub = true;
  if (tag === 'small') out.size = (out.size ?? base) * 0.85;
  if (tag === 'a' && el.getAttribute('href')) {
    out.link = el.getAttribute('href');
    out.color = [0.05, 0.27, 0.75];
    out.underline = true;
  }
  const css = styleAttr(el);
  if (css.color) out.color = cssColor(css.color) ?? out.color;
  const fw = css['font-weight'];
  if (fw) out.bold = /bold|[6-9]00/.test(fw);
  if (css['font-style']) out.italic = /italic|oblique/.test(css['font-style']);
  const td = css['text-decoration'];
  if (td) { if (/underline/.test(td)) out.underline = true; if (/line-through/.test(td)) out.strike = true; }
  if (css['font-size']) { const pt = lenToPt(css['font-size'], out.size ?? base); if (pt) out.size = pt; }
  const ff = css['font-family'];
  if (ff) out.family = /mono|courier|consolas/i.test(ff) ? 'mono' : /serif|times|georgia|garamond/i.test(ff) && !/sans/i.test(ff) ? 'serif' : out.family;
  return out;
}

const alignOf = (el: any, inherited?: Align): Align | undefined => {
  const css = styleAttr(el)['text-align'];
  const a = (css || (el.getAttribute && el.getAttribute('align')) || '').toLowerCase();
  return a === 'center' || a === 'right' || a === 'justify' || a === 'left' ? (a as Align) : inherited;
};

function dataImage(src: string): { bytes: Uint8Array; kind: 'png' | 'jpg' } | null {
  const m = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(src.trim());
  if (!m) return null;
  try {
    const bin = atob(m[2].replace(/\s/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, kind: m[1].toLowerCase() === 'png' ? 'png' : 'jpg' };
  } catch {
    return null;
  }
}

type Flow = { runs: Run[] };

function inline(node: any, st: Style, flow: Flow, ctx: Ctx, flush: () => void) {
  if (node.nodeType === 3) {
    const text = String(node.nodeValue || '').replace(/\s+/g, ' ');
    if (!text) return;
    flow.runs.push({ text, bold: st.bold, italic: st.italic, underline: st.underline, strike: st.strike, color: st.color, family: st.family, size: st.size, link: st.link, sup: st.sup, sub: st.sub });
    return;
  }
  if (node.nodeType !== 1) return;
  const tag = String(node.nodeName).toLowerCase();
  if (SKIP.has(tag)) return;
  if (tag === 'br') { flow.runs.push({ text: '\n' }); return; }
  if (tag === 'img') {
    const di = dataImage(node.getAttribute('src') || '');
    if (di) { flush(); ctx.blocks.push({ type: 'img', bytes: di.bytes, kind: di.kind }); ctx.images++; } else ctx.skippedImages++;
    return;
  }
  const next = styled(node, st, ctx.baseSize);
  for (let c = node.firstChild; c; c = c.nextSibling) inline(c, next, flow, ctx, flush);
}

function paragraphOf(runs: Run[], extra: Partial<Para>, ctx: Ctx): Para | null {
  // trim the outer whitespace and drop empty paragraphs
  while (runs.length && !runs[0].text.replace(/^\s+/, '')) runs.shift();
  if (runs.length) runs[0] = { ...runs[0], text: runs[0].text.replace(/^\s+/, '') };
  while (runs.length && !runs[runs.length - 1].text.replace(/\s+$/, '')) runs.pop();
  if (runs.length) runs[runs.length - 1] = { ...runs[runs.length - 1], text: runs[runs.length - 1].text.replace(/\s+$/, '') };
  if (!runs.length || !runs.some((r) => r.text.trim())) return null;
  return { type: 'p', runs, size: ctx.baseSize, ...extra };
}

function walk(node: any, st: Style, ctx: Ctx, out: Block[], o: { indent: number; list?: { ordered: boolean; n: number; depth: number }; align?: Align }) {
  // gather inline content between block children
  let flow: Flow = { runs: [] };
  const flushPara = (extra: Partial<Para> = {}) => {
    const p = paragraphOf(flow.runs, { indent: o.indent, align: o.align, after: 6, ...extra }, ctx);
    if (p) out.push(p);
    flow = { runs: [] };
  };
  const flushInline = () => flushPara();
  const prevBlocks = ctx.blocks;
  ctx.blocks = out; // images found inside inline content are appended to the block list being built

  for (let c = node.firstChild; c; c = c.nextSibling) {
    if (c.nodeType === 3) { inline(c, st, flow, ctx, flushInline); continue; }
    if (c.nodeType !== 1) continue;
    const tag = String(c.nodeName).toLowerCase();
    if (SKIP.has(tag)) continue;
    if (!BLOCKS.has(tag)) { inline(c, st, flow, ctx, flushInline); continue; }

    flushPara();
    const next = styled(c, st, ctx.baseSize);
    const align = alignOf(c, o.align);

    if (tag in HEADING) {
      const f: Flow = { runs: [] };
      const hs: Style = { ...next, bold: true, size: ctx.baseSize * HEADING[tag] };
      for (let k = c.firstChild; k; k = k.nextSibling) inline(k, hs, f, ctx, () => {});
      const p = paragraphOf(f.runs, { indent: o.indent, align, before: ctx.baseSize * (tag === 'h1' ? 1.2 : 0.9), after: ctx.baseSize * 0.5, keepNext: true, size: hs.size }, ctx);
      if (p) out.push(p);
    } else if (tag === 'p' || tag === 'figcaption' || tag === 'summary' || tag === 'dt' || tag === 'address') {
      const f: Flow = { runs: [] };
      const flushHere = () => { const p = paragraphOf(f.runs, { indent: o.indent, align, after: 7 }, ctx); if (p) out.push(p); f.runs = []; };
      for (let k = c.firstChild; k; k = k.nextSibling) inline(k, tag === 'dt' ? { ...next, bold: true } : next, f, ctx, flushHere);
      flushHere();
    } else if (tag === 'pre') {
      const text = String(c.textContent || '').replace(/^\n/, '').replace(/\s+$/, '');
      if (text) out.push({ type: 'p', runs: [{ text, family: 'mono', size: ctx.baseSize * 0.85 }], indent: o.indent + 6, bg: [0.95, 0.95, 0.95], after: 8, size: ctx.baseSize * 0.85, lineHeight: 1.25 });
    } else if (tag === 'hr') {
      out.push({ type: 'hr' });
    } else if (tag === 'ul' || tag === 'ol') {
      const depth = (o.list?.depth ?? -1) + 1;
      const ordered = tag === 'ol';
      let n = Number(c.getAttribute('start') || 1);
      for (let li = c.firstChild; li; li = li.nextSibling) {
        if (li.nodeType !== 1 || String(li.nodeName).toLowerCase() !== 'li') continue;
        const bullet = ordered ? `${n++}.` : depth === 0 ? '•' : depth === 1 ? '-' : '•';
        const f: Flow = { runs: [] };
        const nested: any[] = [];
        for (let k = li.firstChild; k; k = k.nextSibling) {
          const kt = k.nodeType === 1 ? String(k.nodeName).toLowerCase() : '';
          if (kt === 'ul' || kt === 'ol') nested.push(k);
          else inline(k, styled(li, next, ctx.baseSize), f, ctx, () => {});
        }
        const left = o.indent + 22;
        const p = paragraphOf(f.runs, { indent: left, bullet, bulletIndent: left - 16, align, after: 3 }, ctx);
        if (p) out.push(p);
        for (const nl of nested) walk({ firstChild: nl, nodeType: 1 } as any, next, ctx, out, { indent: left, list: { ordered, n, depth }, align });
      }
    } else if (tag === 'table') {
      const t = tableOf(c, next, ctx);
      if (t) out.push(t, { type: 'space', h: 8 });
    } else if (tag === 'blockquote') {
      walk(c, { ...next, italic: true }, ctx, out, { indent: o.indent + 24, align });
    } else {
      // div, section, article, li outside a list, body, ...
      walk(c, next, ctx, out, { ...o, align });
    }
  }
  flushPara();
  ctx.blocks = prevBlocks;
}

function tableOf(tbl: any, st: Style, ctx: Ctx): Block | null {
  const rows: { cells: Cell[]; header?: boolean }[] = [];
  const collect = (node: any) => {
    for (let c = node.firstChild; c; c = c.nextSibling) {
      if (c.nodeType !== 1) continue;
      const tag = String(c.nodeName).toLowerCase();
      if (tag === 'thead' || tag === 'tbody' || tag === 'tfoot') collect(c);
      else if (tag === 'tr') {
        const cells: Cell[] = [];
        let header = false;
        for (let d = c.firstChild; d; d = d.nextSibling) {
          if (d.nodeType !== 1) continue;
          const dt = String(d.nodeName).toLowerCase();
          if (dt !== 'td' && dt !== 'th') continue;
          if (dt === 'th') header = true;
          const blocks: Block[] = [];
          const cst = styled(d, st, ctx.baseSize);
          walk(d, { ...cst, size: ctx.baseSize * 0.95 }, ctx, blocks, { indent: 0, align: alignOf(d) });
          for (const b of blocks) if (b.type === 'p') b.after = 2;
          const span = Number(d.getAttribute('colspan') || 1) || 1;
          cells.push({ blocks: blocks.length ? blocks : [{ type: 'p', runs: [{ text: ' ' }], size: ctx.baseSize }], span, bg: dt === 'th' ? [0.93, 0.93, 0.93] : cssColor(styleAttr(d)['background-color'] || styleAttr(d).background || '') });
        }
        if (cells.length) rows.push({ cells, header });
      }
    }
  };
  collect(tbl);
  if (!rows.length) return null;
  const border = tbl.getAttribute('border') !== '0' && styleAttr(tbl).border !== 'none';
  return { type: 'table', rows, border };
}

export function htmlToBlocks(html: string, baseSize = 11): { blocks: Block[]; images: number; skippedImages: number } {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const root: any = (doc as any).body || (doc as any).documentElement;
  const ctx: Ctx = { blocks: [], images: 0, skippedImages: 0, baseSize };
  const out: Block[] = [];
  const title = (doc as any).title || (doc.getElementsByTagName('title')[0] && doc.getElementsByTagName('title')[0].textContent) || '';
  const hasH1 = !!root && !!root.getElementsByTagName && root.getElementsByTagName('h1').length > 0;
  if (title && !hasH1 && String(title).trim()) out.push({ type: 'p', runs: [{ text: String(title).trim(), bold: true, size: baseSize * 1.8 }], after: 10, size: baseSize * 1.8, keepNext: true });
  if (root) walk(root, {}, ctx, out, { indent: 0 });
  return { blocks: out, images: ctx.images, skippedImages: ctx.skippedImages };
}
