/**
 * Word (.docx) to layout blocks. A .docx is a zip of XML files; this reads the body (paragraphs, runs, lists, tables, images,
 * page breaks), resolves styles and numbering, and takes the page size and margins from the document. Headers, footers, text
 * boxes, shapes, comments and tracked deletions are not reproduced.
 */
import JSZip from 'jszip';
import type { Align, Block, Cell, Color, Family, PageSpec, Para, Run } from './layout';
import { PT, rgbOf } from './layout';
import { ToolError } from './base';

type El = any;
const kids = (el: El, name: string): El[] => {
  const out: El[] = [];
  for (let c = el && el.firstChild; c; c = c.nextSibling) if (c.nodeType === 1 && (c.localName || String(c.nodeName).split(':').pop()) === name) out.push(c);
  return out;
};
const kid = (el: El, name: string): El | undefined => kids(el, name)[0];
const val = (el: El | undefined, attr = 'w:val'): string | undefined => (el && el.getAttribute ? el.getAttribute(attr) || undefined : undefined);
const num = (s?: string) => (s === undefined || s === '' || isNaN(Number(s)) ? undefined : Number(s));
const parseXml = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');

type RunProps = { size?: number; bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; color?: Color; family?: Family; sup?: boolean; sub?: boolean; caps?: boolean };
type ParaProps = { numId?: string; ilvl?: number; align?: Align; left?: number; right?: number; firstLine?: number; before?: number; after?: number; line?: number; keepNext?: boolean; pageBreakBefore?: boolean; shade?: Color };
type Style = { basedOn?: string; r: RunProps; p: ParaProps };
type Lvl = { fmt: string; text: string; left?: number; hanging?: number };

const familyOf = (name?: string): Family | undefined => {
  if (!name) return undefined;
  if (/courier|consolas|mono|lucida console|menlo/i.test(name)) return 'mono';
  if (/times|georgia|garamond|cambria|book antiqua|palatino|serif|minion|century/i.test(name) && !/sans/i.test(name)) return 'serif';
  return 'sans';
};
const flag = (el: El | undefined): boolean | undefined => {
  if (!el) return undefined;
  const v = val(el);
  return !(v === '0' || v === 'false' || v === 'off' || v === 'none');
};

function runProps(rpr: El | undefined): RunProps {
  const o: RunProps = {};
  if (!rpr) return o;
  const sz = num(val(kid(rpr, 'sz')));
  if (sz) o.size = sz / 2;
  const b = flag(kid(rpr, 'b')); if (b !== undefined) o.bold = b;
  const i = flag(kid(rpr, 'i')); if (i !== undefined) o.italic = i;
  const u = kid(rpr, 'u'); if (u) o.underline = val(u) !== 'none';
  const s = flag(kid(rpr, 'strike')); if (s !== undefined) o.strike = s;
  const c = val(kid(rpr, 'color')); if (c && c !== 'auto') o.color = rgbOf(c);
  const f = kid(rpr, 'rFonts'); if (f) o.family = familyOf(val(f, 'w:ascii') || val(f, 'w:hAnsi'));
  const va = val(kid(rpr, 'vertAlign')); if (va === 'superscript') o.sup = true; if (va === 'subscript') o.sub = true;
  const caps = flag(kid(rpr, 'caps')); if (caps) o.caps = true;
  return o;
}

function paraProps(ppr: El | undefined): ParaProps {
  const o: ParaProps = {};
  if (!ppr) return o;
  const jc = val(kid(ppr, 'jc'));
  if (jc) o.align = jc === 'both' || jc === 'distribute' ? 'justify' : jc === 'center' ? 'center' : jc === 'right' || jc === 'end' ? 'right' : 'left';
  const ind = kid(ppr, 'ind');
  if (ind) {
    const l = num(val(ind, 'w:left') ?? val(ind, 'w:start')); if (l !== undefined) o.left = l * PT.twip;
    const r = num(val(ind, 'w:right') ?? val(ind, 'w:end')); if (r !== undefined) o.right = r * PT.twip;
    const fl = num(val(ind, 'w:firstLine')); const hg = num(val(ind, 'w:hanging'));
    if (hg !== undefined) o.firstLine = -hg * PT.twip; else if (fl !== undefined) o.firstLine = fl * PT.twip;
  }
  const sp = kid(ppr, 'spacing');
  if (sp) {
    const b = num(val(sp, 'w:before')); if (b !== undefined) o.before = b * PT.twip;
    const a = num(val(sp, 'w:after')); if (a !== undefined) o.after = a * PT.twip;
    const ln = num(val(sp, 'w:line')); if (ln !== undefined && (val(sp, 'w:lineRule') || 'auto') === 'auto') o.line = ln / 240;
  }
  const np = kid(ppr, 'numPr');
  if (np) { o.numId = val(kid(np, 'numId')); o.ilvl = num(val(kid(np, 'ilvl'))); }
  if (kid(ppr, 'keepNext')) o.keepNext = true;
  if (kid(ppr, 'pageBreakBefore')) o.pageBreakBefore = true;
  const shd = val(kid(ppr, 'shd'), 'w:fill'); if (shd && shd !== 'auto') o.shade = rgbOf(shd);
  return o;
}

export type DocxResult = { blocks: Block[]; page: PageSpec; images: number; skippedImages: number };

export async function docxToBlocks(bytes: Uint8Array): Promise<DocxResult> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new ToolError('This does not look like a .docx file. Older .doc files are not supported: open them in Word and save as .docx.');
  }
  const read = async (p: string) => { const f = zip.file(p); return f ? f.async('string') : ''; };
  const docXml = await read('word/document.xml');
  if (!docXml) throw new ToolError('This does not look like a Word document (word/document.xml is missing).');
  const doc = parseXml(docXml);
  const body = kid(doc.documentElement, 'body');
  if (!body) throw new ToolError('The document body could not be read.');

  // relationships: hyperlinks and images
  const rels: Record<string, { target: string; external: boolean }> = {};
  const relsXml = await read('word/_rels/document.xml.rels');
  if (relsXml) for (const r of Array.from(parseXml(relsXml).getElementsByTagName('Relationship'))) rels[(r as El).getAttribute('Id')] = { target: (r as El).getAttribute('Target') || '', external: (r as El).getAttribute('TargetMode') === 'External' };

  const styles: Record<string, Style> = {};
  let defaults: Style = { r: {}, p: {} };
  const stylesXml = await read('word/styles.xml');
  if (stylesXml) {
    const sd = parseXml(stylesXml).documentElement;
    const dd = kid(sd, 'docDefaults');
    if (dd) defaults = { r: runProps(kid(kid(dd, 'rPrDefault'), 'rPr')), p: paraProps(kid(kid(dd, 'pPrDefault'), 'pPr')) };
    for (const s of kids(sd, 'style')) {
      const id = s.getAttribute('w:styleId');
      if (id) styles[id] = { basedOn: val(kid(s, 'basedOn')), r: runProps(kid(s, 'rPr')), p: paraProps(kid(s, 'pPr')) };
    }
  }
  const resolve = (id: string | undefined): Style => {
    const chain: Style[] = [];
    let cur = id;
    for (let n = 0; cur && styles[cur] && n < 12; n++) { chain.unshift(styles[cur]); cur = styles[cur].basedOn; }
    const out: Style = { r: { ...defaults.r }, p: { ...defaults.p } };
    for (const s of chain) { Object.assign(out.r, s.r); Object.assign(out.p, s.p); }
    return out;
  };

  const abstracts: Record<string, Record<number, Lvl>> = {};
  const nums: Record<string, string> = {};
  const numXml = await read('word/numbering.xml');
  if (numXml) {
    const nd = parseXml(numXml).documentElement;
    for (const a of kids(nd, 'abstractNum')) {
      const lv: Record<number, Lvl> = {};
      for (const l of kids(a, 'lvl')) {
        const ind = kid(kid(l, 'pPr'), 'ind');
        lv[Number(l.getAttribute('w:ilvl') || 0)] = { fmt: val(kid(l, 'numFmt')) || 'decimal', text: val(kid(l, 'lvlText')) || '', left: num(val(ind, 'w:left')), hanging: num(val(ind, 'w:hanging')) };
      }
      abstracts[a.getAttribute('w:abstractNumId')] = lv;
    }
    for (const n of kids(nd, 'num')) nums[n.getAttribute('w:numId')] = val(kid(n, 'abstractNumId')) || '';
  }
  const counters: Record<string, number[]> = {};
  const fmtNum = (n: number, fmt: string) => {
    if (fmt === 'lowerLetter') return String.fromCharCode(96 + ((n - 1) % 26) + 1);
    if (fmt === 'upperLetter') return String.fromCharCode(64 + ((n - 1) % 26) + 1);
    if (fmt === 'lowerRoman' || fmt === 'upperRoman') {
      const map: [number, string][] = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
      let r = '';
      let k = n;
      for (const [v, s] of map) while (k >= v) { r += s; k -= v; }
      return fmt === 'upperRoman' ? r.toUpperCase() : r;
    }
    return String(n);
  };
  const bulletFor = (numId: string, ilvl: number): { text: string; left?: number; hanging?: number } | null => {
    const lv = abstracts[nums[numId]]?.[ilvl];
    if (!lv) return null;
    if (lv.fmt === 'bullet') return { text: ilvl % 2 ? '-' : '•', left: lv.left, hanging: lv.hanging };
    const c = (counters[numId] = counters[numId] || []);
    c[ilvl] = (c[ilvl] || 0) + 1;
    c.length = ilvl + 1; // a new item at this level restarts the deeper ones
    return { text: lv.text.replace(/%(\d)/g, (_m, d) => { const lvl = Number(d) - 1; return fmtNum(c[lvl] || 1, abstracts[nums[numId]]?.[lvl]?.fmt || 'decimal'); }), left: lv.left, hanging: lv.hanging };
  };

  let images = 0;
  let skippedImages = 0;
  const imageOf = async (drawing: El): Promise<Block | null> => {
    const blip = drawing.getElementsByTagName('a:blip')[0];
    const embed = blip && blip.getAttribute('r:embed');
    const rel = embed && rels[embed];
    if (!rel) return null;
    const path = rel.target.startsWith('/') ? rel.target.slice(1) : 'word/' + rel.target;
    const kind = /\.png$/i.test(path) ? 'png' : /\.jpe?g$/i.test(path) ? 'jpg' : null;
    const f = zip.file(path);
    if (!kind || !f) { skippedImages++; return null; }
    const ext = drawing.getElementsByTagName('wp:extent')[0];
    const cx = num(ext && ext.getAttribute('cx')); const cy = num(ext && ext.getAttribute('cy'));
    images++;
    return { type: 'img', bytes: await f.async('uint8array'), kind, width: cx ? cx * PT.emu : undefined, height: cy ? cy * PT.emu : undefined };
  };

  const blocks: Block[] = [];

  const paragraph = async (p: El, out: Block[], inTable = false) => {
    const ppr = kid(p, 'pPr');
    const sid = val(kid(ppr, 'pStyle'));
    const st = resolve(sid);
    const props = { ...st.p, ...paraProps(ppr) };
    const base = st.r.size ?? 11;
    const paraRun = { ...st.r, ...runProps(kid(ppr, 'rPr')) };
    const runs: Run[] = [];
    const extras: Block[] = [];
    let breakAfter = false;

    const addRuns = async (container: El, link?: string) => {
      for (const c of Array.from(container.childNodes) as El[]) {
        if (c.nodeType !== 1) continue;
        const name = c.localName || String(c.nodeName).split(':').pop();
        if (name === 'r') {
          const rp = { ...st.r, ...runProps(kid(c, 'rPr')) };
          // character style
          const rs = val(kid(kid(c, 'rPr'), 'rStyle'));
          const merged = rs ? { ...st.r, ...resolve(rs).r, ...runProps(kid(c, 'rPr')) } : rp;
          const mk = (text: string): Run => ({ text: merged.caps ? text.toUpperCase() : text, bold: merged.bold, italic: merged.italic, underline: merged.underline || !!link, strike: merged.strike, size: merged.size, color: link ? [0.05, 0.27, 0.75] : merged.color, family: merged.family, link, sup: merged.sup, sub: merged.sub });
          for (const rc of Array.from(c.childNodes) as El[]) {
            if (rc.nodeType !== 1) continue;
            const rn = rc.localName || String(rc.nodeName).split(':').pop();
            if (rn === 't') runs.push(mk(rc.textContent || ''));
            else if (rn === 'tab') runs.push(mk('\t'));
            else if (rn === 'br' || rn === 'cr') {
              if (val(rc, 'w:type') === 'page') breakAfter = true; else runs.push(mk('\n'));
            } else if (rn === 'noBreakHyphen') runs.push(mk('-'));
            else if (rn === 'drawing') { const im = await imageOf(rc); if (im) extras.push(im); }
          }
        } else if (name === 'hyperlink') {
          const rid = c.getAttribute('r:id');
          await addRuns(c, rid && rels[rid] ? rels[rid].target : undefined);
        } else if (name === 'ins' || name === 'smartTag' || name === 'sdt' || name === 'fldSimple' || name === 'sdtContent') await addRuns(c, link);
        // w:del (tracked deletions), w:bookmarkStart etc. are skipped on purpose
      }
    };
    await addRuns(p);

    const numId = props.numId;
    const ilvl = props.ilvl ?? 0;
    let bullet: string | undefined;
    let left = props.left ?? 0;
    let first = props.firstLine ?? 0;
    let bulletIndent: number | undefined;
    if (numId && numId !== '0') {
      const b = bulletFor(numId, ilvl);
      if (b) {
        bullet = b.text;
        if (b.left !== undefined) left = b.left * PT.twip;
        const hang = (b.hanging ?? 360) * PT.twip;
        bulletIndent = Math.max(0, left - hang);
        first = 0;
      }
    }
    const text = runs.map((r) => r.text).join('');
    const hasContent = text.trim().length > 0 || extras.length > 0;
    if (props.pageBreakBefore) out.push({ type: 'pagebreak' });
    const para: Para = {
      type: 'p', runs: runs.length ? runs : [{ text: ' ', size: paraRun.size }], align: props.align, indent: left, firstLine: first, rightIndent: props.right,
      before: props.before ?? 0, after: props.after ?? 0, lineHeight: props.line ? Math.max(1, props.line * 1.17) : 1.17, size: base, bullet, bulletIndent, bg: props.shade, keepNext: props.keepNext,
    };
    if (hasContent || !inTable) out.push(para);
    out.push(...extras);
    if (breakAfter) out.push({ type: 'pagebreak' });
  };

  const table = async (t: El, out: Block[]) => {
    const grid = kids(kid(t, 'tblGrid'), 'gridCol').map((g) => num(val(g, 'w:w')) || 1);
    const bordersEl = kid(kid(t, 'tblPr'), 'tblBorders');
    const styleId = val(kid(kid(t, 'tblPr'), 'tblStyle')) || '';
    const border = bordersEl ? Array.from(bordersEl.childNodes as El[]).some((e: El) => e.nodeType === 1 && !/^(nil|none)$/.test(val(e) || '')) : /grid/i.test(styleId);
    const rows: { cells: Cell[]; header?: boolean }[] = [];
    for (const tr of kids(t, 'tr')) {
      const cells: Cell[] = [];
      for (const tc of kids(tr, 'tc')) {
        const tcPr = kid(tc, 'tcPr');
        const span = num(val(kid(tcPr, 'gridSpan'))) || 1;
        const shade = val(kid(tcPr, 'shd'), 'w:fill');
        const inner: Block[] = [];
        if (val(kid(tcPr, 'vMerge')) === undefined && kid(tcPr, 'vMerge')) { cells.push({ blocks: [{ type: 'p', runs: [{ text: ' ' }], size: 8 }], span }); continue; }
        for (const c of Array.from(tc.childNodes) as El[]) {
          if (c.nodeType !== 1) continue;
          const n = c.localName || String(c.nodeName).split(':').pop();
          if (n === 'p') await paragraph(c, inner, true);
          else if (n === 'tbl') await table(c, inner);
        }
        cells.push({ blocks: inner.length ? inner : [{ type: 'p', runs: [{ text: ' ' }], size: 8 }], span, bg: shade && shade !== 'auto' ? rgbOf(shade) : undefined });
      }
      if (cells.length) rows.push({ cells });
    }
    if (rows.length) out.push({ type: 'table', cols: grid.length ? grid : undefined, rows, border }, { type: 'space', h: 6 });
  };

  let sect: El | undefined;
  for (const c of Array.from(body.childNodes) as El[]) {
    if (c.nodeType !== 1) continue;
    const n = c.localName || String(c.nodeName).split(':').pop();
    if (n === 'p') await paragraph(c, blocks);
    else if (n === 'tbl') await table(c, blocks);
    else if (n === 'sectPr') sect = c;
  }

  const pgSz = kid(sect, 'pgSz');
  const pgMar = kid(sect, 'pgMar');
  let w = (num(val(pgSz, 'w:w')) ?? 11906) * PT.twip;
  let h = (num(val(pgSz, 'w:h')) ?? 16838) * PT.twip;
  if (val(pgSz, 'w:orient') === 'landscape' && w < h) [w, h] = [h, w];
  const m = (a: string, d: number) => Math.max(18, (num(val(pgMar, a)) ?? d) * PT.twip);
  return { blocks, page: { width: w, height: h, margin: { top: m('w:top', 1440), right: m('w:right', 1440), bottom: m('w:bottom', 1440), left: m('w:left', 1440) } }, images, skippedImages };
}
