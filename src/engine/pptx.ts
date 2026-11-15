/**
 * PowerPoint (.pptx) to PDF pages. A .pptx is a zip of XML where every shape has a position, so each slide becomes a page of the
 * slide's own size and shapes are drawn where they are: filled rectangles and ellipses, lines, pictures (PNG, JPEG), tables and
 * text with its size, colour, bullets and alignment. Positions and styles that a shape does not set are inherited from its layout
 * and master, as in PowerPoint. Charts, SmartArt, effects, animations, notes and non-rectangular shapes are not reproduced.
 */
import JSZip from 'jszip';
import { PDFDocument, rgb } from 'pdf-lib';
import { Fonts, drawBlocks, type Block, type Color, type Family, type Para, type Run } from './layout';
import { ToolError } from './base';

type El = any;
const EMU = 1 / 12700;
const ln = (el: El) => el.localName || String(el.nodeName).split(':').pop();
const kids = (el: El | undefined, name: string): El[] => {
  const out: El[] = [];
  for (let c = el && el.firstChild; c; c = c.nextSibling) if (c.nodeType === 1 && ln(c) === name) out.push(c);
  return out;
};
const kid = (el: El | undefined, name: string): El | undefined => kids(el, name)[0];
const attr = (el: El | undefined, a: string): string | undefined => (el && el.getAttribute ? el.getAttribute(a) || undefined : undefined);
const num = (s?: string) => (s === undefined || s === '' || isNaN(Number(s)) ? undefined : Number(s));
const parse = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');
const dirOf = (p: string) => p.slice(0, p.lastIndexOf('/') + 1);
const resolvePath = (base: string, target: string) => {
  if (target.startsWith('/')) return target.slice(1);
  const parts = (dirOf(base) + target).split('/');
  const out: string[] = [];
  for (const p of parts) { if (p === '..') out.pop(); else if (p !== '.') out.push(p); }
  return out.join('/');
};

/* ---------- colour ---------- */
const hex = (h: string): Color => { const n = parseInt(h, 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
const toHsl = ([r, g, b]: Color): [number, number, number] => {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
};
const fromHsl = ([h, s, l]: [number, number, number]): Color => {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t: number) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
};
const PRESET: Record<string, string> = { black: '000000', white: 'FFFFFF', red: 'FF0000', green: '008000', blue: '0000FF', yellow: 'FFFF00', gray: '808080', grey: '808080', orange: 'FFA500', purple: '800080' };

type Ctx = { theme: Record<string, string>; clrMap: Record<string, string> };
function colorOf(parent: El | undefined, ctx: Ctx): Color | undefined {
  if (!parent) return undefined;
  const c = Array.from(parent.childNodes as El[]).find((n: El) => n.nodeType === 1 && /^(srgbClr|schemeClr|sysClr|prstClr)$/.test(ln(n)));
  if (!c) return undefined;
  const t = ln(c);
  let base: Color | undefined;
  if (t === 'srgbClr') base = hex(attr(c, 'val') || '000000');
  else if (t === 'sysClr') base = hex(attr(c, 'lastClr') || '000000');
  else if (t === 'prstClr') base = hex(PRESET[(attr(c, 'val') || 'black').toLowerCase()] || '000000');
  else {
    const name = attr(c, 'val') || 'tx1';
    const mapped = ctx.clrMap[name] || name;
    base = ctx.theme[mapped] ? hex(ctx.theme[mapped]) : undefined;
    if (!base) return undefined;
  }
  let hsl = toHsl(base);
  for (const m of Array.from(c.childNodes as El[])) {
    if (m.nodeType !== 1) continue;
    const v = (num(attr(m, 'val')) ?? 100000) / 100000;
    const k = ln(m);
    if (k === 'lumMod') hsl = [hsl[0], hsl[1], Math.min(1, hsl[2] * v)];
    else if (k === 'lumOff') hsl = [hsl[0], hsl[1], Math.min(1, Math.max(0, hsl[2] + v))];
    else if (k === 'tint') hsl = [hsl[0], hsl[1], hsl[2] + (1 - hsl[2]) * (1 - v)];
    else if (k === 'shade') hsl = [hsl[0], hsl[1], hsl[2] * v];
  }
  return fromHsl(hsl);
}
const fillOf = (spPr: El | undefined, ctx: Ctx): Color | null | undefined => {
  if (!spPr) return undefined;
  if (kid(spPr, 'noFill')) return null;
  const sf = kid(spPr, 'solidFill');
  if (sf) return colorOf(sf, ctx);
  const gf = kid(spPr, 'gradFill');
  if (gf) return colorOf(kid(kid(gf, 'gsLst'), 'gs'), ctx);
  return undefined;
};

/* ---------- text style inheritance ---------- */
type LvlProps = { sz?: number; b?: boolean; i?: boolean; u?: boolean; color?: Color; family?: Family; algn?: string; marL?: number; indent?: number; bu?: string | null; spcBef?: number; lnSpc?: number };
const familyOf = (face?: string): Family | undefined => (!face ? undefined : /courier|consolas|mono/i.test(face) ? 'mono' : /times|georgia|garamond|cambria|serif|palatino|book/i.test(face) && !/sans/i.test(face) ? 'serif' : 'sans');

function lvlProps(pPr: El | undefined, ctx: Ctx): LvlProps {
  const o: LvlProps = {};
  if (!pPr) return o;
  const a = attr(pPr, 'algn'); if (a) o.algn = a;
  const ml = num(attr(pPr, 'marL')); if (ml !== undefined) o.marL = ml * EMU;
  const ind = num(attr(pPr, 'indent')); if (ind !== undefined) o.indent = ind * EMU;
  if (kid(pPr, 'buNone')) o.bu = null;
  const bc = kid(pPr, 'buChar'); if (bc) o.bu = attr(bc, 'char') || '•';
  const ba = kid(pPr, 'buAutoNum'); if (ba) o.bu = '#';
  const sb = kid(kid(pPr, 'spcBef'), 'spcPts'); if (sb) o.spcBef = (num(attr(sb, 'val')) ?? 0) / 100;
  const ls = kid(kid(pPr, 'lnSpc'), 'spcPct'); if (ls) o.lnSpc = (num(attr(ls, 'val')) ?? 100000) / 100000;
  const d = kid(pPr, 'defRPr');
  if (d) {
    const sz = num(attr(d, 'sz')); if (sz) o.sz = sz / 100;
    const b = attr(d, 'b'); if (b !== undefined) o.b = b === '1' || b === 'true';
    const i = attr(d, 'i'); if (i !== undefined) o.i = i === '1' || i === 'true';
    const u = attr(d, 'u'); if (u !== undefined) o.u = u !== 'none';
    const col = colorOf(kid(d, 'solidFill'), ctx); if (col) o.color = col;
    o.family = familyOf(attr(kid(d, 'latin'), 'typeface')) ?? o.family;
  }
  return o;
}

type Ph = { type?: string; idx?: string; xfrm?: Xf; lst: El[]; anchor?: string; ins?: number[] };
type Xf = { x: number; y: number; w: number; h: number };
const xfOf = (spPr: El | undefined): Xf | undefined => {
  const xf = kid(spPr, 'xfrm');
  if (!xf) return undefined;
  const off = kid(xf, 'off'), ext = kid(xf, 'ext');
  if (!off || !ext) return undefined;
  return { x: (num(attr(off, 'x')) ?? 0) * EMU, y: (num(attr(off, 'y')) ?? 0) * EMU, w: (num(attr(ext, 'cx')) ?? 0) * EMU, h: (num(attr(ext, 'cy')) ?? 0) * EMU };
};

export type PptxStats = { slides: number; pictures: number; skippedPictures: number; unsupported: number; replaced: number };

export async function pptxToPdf(bytes: Uint8Array, doc: PDFDocument, fonts: Fonts, onSlide: (i: number, n: number) => void = () => {}): Promise<PptxStats> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new ToolError('This does not look like a .pptx file. Older .ppt files are not supported: open them in PowerPoint and save as .pptx.');
  }
  const read = async (p: string) => { const f = zip.file(p); return f ? f.async('string') : ''; };
  const presXml = await read('ppt/presentation.xml');
  if (!presXml) throw new ToolError('This does not look like a PowerPoint file (ppt/presentation.xml is missing).');
  const pres = parse(presXml).documentElement;
  const sz = kid(pres, 'sldSz');
  const SW = (num(attr(sz, 'cx')) ?? 9144000) * EMU;
  const SH = (num(attr(sz, 'cy')) ?? 6858000) * EMU;

  const relsOf = async (part: string): Promise<Record<string, { target: string; type: string }>> => {
    const x = await read(dirOf(part) + '_rels/' + part.slice(part.lastIndexOf('/') + 1) + '.rels');
    const out: Record<string, { target: string; type: string }> = {};
    if (x) for (const r of Array.from(parse(x).getElementsByTagName('Relationship')) as El[]) out[r.getAttribute('Id')] = { target: resolvePath(part, r.getAttribute('Target') || ''), type: r.getAttribute('Type') || '' };
    return out;
  };
  const presRels = await relsOf('ppt/presentation.xml');
  const slidePaths = kids(kid(pres, 'sldIdLst'), 'sldId').map((s) => presRels[attr(s, 'r:id') || '']?.target).filter(Boolean) as string[];
  if (!slidePaths.length) throw new ToolError('This presentation has no slides.');

  const theme: Record<string, string> = {};
  const themePath = Object.values(presRels).find((r) => /theme$/.test(r.type))?.target || 'ppt/theme/theme1.xml';
  const themeXml = await read(themePath);
  if (themeXml) {
    const cs = parse(themeXml).getElementsByTagName('a:clrScheme')[0];
    for (const c of Array.from((cs && cs.childNodes) || []) as El[]) {
      if (c.nodeType !== 1) continue;
      const v = c.firstChild && (Array.from(c.childNodes as El[]).find((n: El) => n.nodeType === 1));
      if (v) theme[ln(c)] = attr(v, 'val') && ln(v) === 'srgbClr' ? attr(v, 'val')! : attr(v, 'lastClr') || '000000';
    }
  }
  const defaultText = lvlProps(kid(kid(pres, 'defaultTextStyle'), 'lvl1pPr'), { theme, clrMap: {} });

  const stats: PptxStats = { slides: 0, pictures: 0, skippedPictures: 0, unsupported: 0, replaced: 0 };
  const imageCache = new Map<string, any>();

  for (let si = 0; si < slidePaths.length; si++) {
    onSlide(si + 1, slidePaths.length);
    const slidePath = slidePaths[si];
    const slideXml = parse(await read(slidePath)).documentElement;
    if (attr(slideXml, 'show') === '0') continue; // hidden slides are not printed
    const srels = await relsOf(slidePath);
    const layoutPath = Object.values(srels).find((r) => /slideLayout$/.test(r.type))?.target;
    const lrels = layoutPath ? await relsOf(layoutPath) : {};
    const masterPath = Object.values(lrels).find((r) => /slideMaster$/.test(r.type))?.target;
    const layout = layoutPath ? parse(await read(layoutPath)).documentElement : undefined;
    const master = masterPath ? parse(await read(masterPath)).documentElement : undefined;
    const clrMap: Record<string, string> = { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2' };
    const cm = kid(master, 'clrMap');
    if (cm) for (const a of Array.from(cm.attributes as El[]) as El[]) clrMap[a.name] = a.value;
    const ctx: Ctx = { theme, clrMap };

    // placeholders of the layout and master, for inherited positions and text styles
    const placeholders = (root: El | undefined): Ph[] => {
      const out: Ph[] = [];
      const tree = kid(kid(root, 'cSld'), 'spTree');
      for (const sp of kids(tree, 'sp')) {
        const ph = kid(kid(kid(sp, 'nvSpPr'), 'nvPr'), 'ph');
        if (!ph) continue;
        const body = kid(sp, 'txBody');
        const bp = kid(body, 'bodyPr');
        out.push({ type: attr(ph, 'type'), idx: attr(ph, 'idx'), xfrm: xfOf(kid(sp, 'spPr')), lst: kid(body, 'lstStyle') ? [kid(body, 'lstStyle')] : [], anchor: attr(bp, 'anchor'), ins: ['lIns', 'tIns', 'rIns', 'bIns'].map((k) => num(attr(bp, k)) as number) });
      }
      return out;
    };
    const lph = placeholders(layout);
    const mph = placeholders(master);
    const findPh = (list: Ph[], type?: string, idx?: string) => list.find((p) => (idx && p.idx === idx) || (!idx && p.type === type)) || list.find((p) => type && p.type === type);
    const txStyles = kid(master, 'txStyles');
    // titles use the master's title style, body placeholders its body style, and everything else (text boxes, shapes, table cells) its other style
    const styleFor = (type: string | undefined, isPh: boolean): El | undefined => (!isPh ? kid(txStyles, 'otherStyle') : type === 'title' || type === 'ctrTitle' ? kid(txStyles, 'titleStyle') : !type || /^(body|subTitle|obj|tbl|chart|dgm|media|clipArt)$/.test(type) ? kid(txStyles, 'bodyStyle') : kid(txStyles, 'otherStyle'));

    const page = doc.addPage([SW, SH]);
    stats.slides++;
    const Y = (y: number) => SH - y;

    const bgOf = (root: El | undefined) => fillOf(kid(kid(kid(root, 'cSld'), 'bg'), 'bgPr'), ctx);
    const bg = bgOf(slideXml) ?? bgOf(layout) ?? bgOf(master);
    if (bg) page.drawRectangle({ x: 0, y: 0, width: SW, height: SH, color: rgb(...bg) });

    const loadImage = async (path: string) => {
      if (imageCache.has(path)) return imageCache.get(path);
      const f = zip.file(path);
      let img: any = null;
      if (f && /\.png$/i.test(path)) img = await doc.embedPng(await f.async('uint8array')).catch(() => null);
      else if (f && /\.jpe?g$/i.test(path)) img = await doc.embedJpg(await f.async('uint8array')).catch(() => null);
      imageCache.set(path, img);
      return img;
    };

    type Tx = { ox: number; oy: number; sx: number; sy: number };
    const place = (t: Tx, xf: Xf): Xf => ({ x: t.ox * EMU + 0 + (xf.x) * t.sx, y: t.oy * EMU + xf.y * t.sy, w: xf.w * t.sx, h: xf.h * t.sy });

    const textBlocks = (body: El, phInfo: { type?: string; list: Ph[]; isPh: boolean }, scale: number): { blocks: Block[]; anchor: 't' | 'ctr' | 'b'; ins: number[] } => {
      const bp = kid(body, 'bodyPr');
      const lay = phInfo.list;
      const own = kid(body, 'lstStyle');
      const style = styleFor(phInfo.type, phInfo.isPh);
      let anchor = (attr(bp, 'anchor') || lay.map((p) => p.anchor).find(Boolean) || (phInfo.type === 'title' || phInfo.type === 'ctrTitle' ? 'ctr' : 't')) as string;
      const insFrom = (k: string, d: number, i: number) => { const v = num(attr(bp, k)); if (v !== undefined) return v * EMU; for (const p of lay) if (p.ins && p.ins[i] !== undefined && !isNaN(p.ins[i])) return p.ins[i] * EMU; return d * EMU; };
      const ins = [insFrom('lIns', 91440, 0), insFrom('tIns', 45720, 1), insFrom('rIns', 91440, 2), insFrom('bIns', 45720, 3)];
      const blocks: Block[] = [];
      const counters: number[] = [];
      for (const p of kids(body, 'p')) {
        const pPr = kid(p, 'pPr');
        const lvl = num(attr(pPr, 'lvl')) ?? 0;
        const tag = `lvl${lvl + 1}pPr`;
        const chain: LvlProps[] = [defaultText, lvlProps(kid(style, tag), ctx)];
        for (const l of lay) for (const ls of l.lst) chain.push(lvlProps(kid(ls, tag), ctx));
        chain.push(lvlProps(kid(own, tag), ctx), lvlProps(pPr, ctx));
        const P: LvlProps = Object.assign({}, ...chain.map((c) => Object.fromEntries(Object.entries(c).filter(([, v]) => v !== undefined))));
        const runs: Run[] = [];
        for (const r of Array.from(p.childNodes as El[])) {
          if (r.nodeType !== 1) continue;
          const k = ln(r);
          if (k === 'br') { runs.push({ text: '\n' }); continue; }
          if (k !== 'r' && k !== 'fld') continue;
          const rp = kid(r, 'rPr');
          const text = kid(r, 't')?.textContent || '';
          const sz = num(attr(rp, 'sz'));
          const col = colorOf(kid(rp, 'solidFill'), ctx);
          const b = attr(rp, 'b'); const it = attr(rp, 'i'); const u = attr(rp, 'u');
          runs.push({
            text,
            size: ((sz ? sz / 100 : P.sz) ?? 18) * scale,
            bold: b !== undefined ? b === '1' || b === 'true' : P.b,
            italic: it !== undefined ? it === '1' || it === 'true' : P.i,
            underline: u !== undefined ? u !== 'none' : P.u,
            color: col ?? P.color ?? (theme[clrMap.tx1] ? hex(theme[clrMap.tx1]) : [0, 0, 0]),
            family: familyOf(attr(kid(rp, 'latin'), 'typeface')) ?? P.family,
          });
        }
        const size = ((runs.find((r) => r.size)?.size) ?? (P.sz ?? 18) * scale);
        counters.length = lvl + 1;
        let bullet: string | undefined;
        if (P.bu === '#') { counters[lvl] = (counters[lvl] || 0) + 1; bullet = `${counters[lvl]}.`; } else if (P.bu) { bullet = P.bu === '§' || P.bu === '' || P.bu === '' ? '•' : P.bu; counters[lvl] = 0; } else counters[lvl] = 0;
        const left = (P.marL ?? 0) + (bullet ? Math.max(0, P.indent ?? 0) : 0);
        const para: Para = {
          type: 'p', runs: runs.length && runs.some((r) => r.text) ? runs : [{ text: ' ', size }], size,
          align: P.algn === 'ctr' ? 'center' : P.algn === 'r' ? 'right' : P.algn === 'just' ? 'justify' : 'left',
          indent: bullet ? P.marL ?? 18 : left, firstLine: 0, bullet, bulletIndent: bullet ? Math.max(0, (P.marL ?? 18) + (P.indent ?? -18)) : undefined,
          before: P.spcBef ?? 0, after: 0, lineHeight: (P.lnSpc ?? 1) * 1.15,
        };
        blocks.push(para);
      }
      return { blocks, anchor: anchor === 'ctr' ? 'ctr' : anchor === 'b' ? 'b' : 't', ins };
    };

    const drawText = async (body: El | undefined, box: Xf, phInfo: { type?: string; list: Ph[]; isPh: boolean }) => {
      if (!body || !kids(body, 'p').some((p) => (p.textContent || '').trim())) return;
      const af = kid(kid(body, 'bodyPr'), 'normAutofit');
      const scale = (num(attr(af, 'fontScale')) ?? 100000) / 100000;
      const { blocks, anchor, ins } = textBlocks(body, phInfo, scale);
      const w = box.w - ins[0] - ins[2];
      const h = box.h - ins[1] - ins[3];
      await drawBlocks(page, fonts, blocks, box.x + ins[0], Y(box.y + ins[1]), w, h, anchor);
    };

    const drawShape = async (sp: El, t: Tx) => {
      const nv = kid(kid(sp, 'nvSpPr'), 'nvPr');
      const ph = kid(nv, 'ph');
      const phType = attr(ph, 'type');
      const phIdx = attr(ph, 'idx');
      const spPr = kid(sp, 'spPr');
      const lay = ph ? findPh(lph, phType, phIdx) : undefined;
      const mas = ph ? findPh(mph, phType ?? lay?.type, undefined) : undefined;
      const own = xfOf(spPr) ?? lay?.xfrm ?? mas?.xfrm;
      if (!own) return;
      if (/^(dt|ftr|sldNum)$/.test(phType || '') && !(kid(sp, 'txBody')?.textContent || '').trim()) return;
      const box = place(t, own);
      const style = kid(sp, 'style');
      let fill = fillOf(spPr, ctx);
      if (fill === undefined && style && num(attr(kid(style, 'fillRef'), 'idx')) && !ph) fill = colorOf(kid(style, 'fillRef'), ctx);
      const lnEl = kid(spPr, 'ln');
      let line = lnEl ? (kid(lnEl, 'noFill') ? null : fillOf(lnEl, ctx) ?? undefined) : undefined;
      if (line === undefined && style && num(attr(kid(style, 'lnRef'), 'idx')) && !ph) line = colorOf(kid(style, 'lnRef'), ctx);
      const lw = Math.max(0.25, (num(attr(lnEl, 'w')) ?? 9525) * EMU);
      const geom = attr(kid(spPr, 'prstGeom'), 'prst') || (kid(spPr, 'custGeom') ? 'cust' : 'rect');
      const draws = !!fill || !!line;
      if (draws) {
        if (geom === 'ellipse') page.drawEllipse({ x: box.x + box.w / 2, y: Y(box.y + box.h / 2), xScale: box.w / 2, yScale: box.h / 2, color: fill ? rgb(...fill) : undefined, borderColor: line ? rgb(...line) : undefined, borderWidth: line ? lw : 0 });
        else if (/^(line|straightConnector1|bentConnector\d|curvedConnector\d)$/.test(geom)) {
          const xf = kid(spPr, 'xfrm');
          const flipV = attr(xf, 'flipV') === '1';
          page.drawLine({ start: { x: box.x, y: Y(flipV ? box.y + box.h : box.y) }, end: { x: box.x + box.w, y: Y(flipV ? box.y : box.y + box.h) }, thickness: lw, color: rgb(...(line || [0, 0, 0])) });
        } else {
          if (!/^(rect|roundRect|round1Rect|round2SameRect|snipRoundRect|flowChartProcess|flowChartAlternateProcess|plaque)$/.test(geom)) stats.unsupported++;
          page.drawRectangle({ x: box.x, y: Y(box.y + box.h), width: box.w, height: box.h, color: fill ? rgb(...fill) : undefined, borderColor: line ? rgb(...line) : undefined, borderWidth: line ? lw : 0 });
        }
      }
      await drawText(kid(sp, 'txBody'), box, { type: phType, list: [lay, mas].filter(Boolean) as Ph[], isPh: !!ph });
    };

    const drawPic = async (pic: El, t: Tx) => {
      const xf = xfOf(kid(pic, 'spPr'));
      if (!xf) return;
      const box = place(t, xf);
      const rid = attr(kid(kid(pic, 'blipFill'), 'blip'), 'r:embed');
      const target = rid && srels[rid]?.target;
      const img = target ? await loadImage(target) : null;
      if (img) { page.drawImage(img, { x: box.x, y: Y(box.y + box.h), width: box.w, height: box.h }); stats.pictures++; } else stats.skippedPictures++;
    };

    const drawFrame = async (gf: El, t: Tx) => {
      const xfEl = kid(gf, 'xfrm');
      const off = kid(xfEl, 'off'), ext = kid(xfEl, 'ext');
      if (!off || !ext) return;
      const box = place(t, { x: (num(attr(off, 'x')) ?? 0) * EMU, y: (num(attr(off, 'y')) ?? 0) * EMU, w: (num(attr(ext, 'cx')) ?? 0) * EMU, h: (num(attr(ext, 'cy')) ?? 0) * EMU });
      const tbl = gf.getElementsByTagName('a:tbl')[0];
      if (!tbl) {
        stats.unsupported++;
        page.drawRectangle({ x: box.x, y: Y(box.y + box.h), width: box.w, height: box.h, borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 0.75, borderDashArray: [4, 3] });
        await drawBlocks(page, fonts, [{ type: 'p', runs: [{ text: 'Chart or diagram (not reproduced)', italic: true, size: 10, color: [0.45, 0.45, 0.45] }], align: 'center', size: 10 }], box.x, Y(box.y), box.w, box.h, 'ctr');
        return;
      }
      const cols = kids(kid(tbl, 'tblGrid'), 'gridCol').map((g) => (num(attr(g, 'w')) ?? 0) * EMU * t.sx);
      const firstRow = attr(kid(tbl, 'tblPr'), 'firstRow') === '1';
      let y = box.y;
      let ri = 0;
      for (const tr of kids(tbl, 'tr')) {
        const rh = (num(attr(tr, 'h')) ?? 370840) * EMU * t.sy;
        let x = box.x;
        let ci = 0;
        for (const tc of kids(tr, 'tc')) {
          const span = num(attr(tc, 'gridSpan')) ?? 1;
          const w = cols.slice(ci, ci + span).reduce((a, b) => a + b, 0) || cols[ci] || 60;
          const cf = fillOf(kid(tc, 'tcPr'), ctx) ?? (firstRow && ri === 0 ? ([0.85, 0.88, 0.95] as Color) : null);
          page.drawRectangle({ x, y: Y(y + rh), width: w, height: rh, color: cf ? rgb(...cf) : undefined, borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 0.5 });
          const body = kid(tc, 'txBody');
          if (body && !attr(tc, 'hMerge') && !attr(tc, 'vMerge')) {
            const { blocks } = textBlocks(body, { type: undefined, list: [], isPh: false }, 1);
            for (const b of blocks) if (b.type === 'p') { b.runs.forEach((r) => { r.size = Math.min(r.size ?? 14, 14); if (firstRow && ri === 0) r.bold = true; }); b.size = Math.min(b.size ?? 14, 14); }
            await drawBlocks(page, fonts, blocks, x + 4, Y(y + 3), w - 8, rh - 6, 'ctr');
          }
          x += w;
          ci += span;
        }
        y += rh;
        ri++;
      }
    };

    const walk = async (tree: El, t: Tx) => {
      for (const c of Array.from(tree.childNodes as El[])) {
        if (c.nodeType !== 1) continue;
        const k = ln(c);
        if (k === 'sp') await drawShape(c, t);
        else if (k === 'pic') await drawPic(c, t);
        else if (k === 'graphicFrame') await drawFrame(c, t);
        else if (k === 'cxnSp') await drawShape(c, t);
        else if (k === 'grpSp') {
          const gx = kid(kid(c, 'grpSpPr'), 'xfrm');
          const off = kid(gx, 'off'), ext = kid(gx, 'ext'), cho = kid(gx, 'chOff'), che = kid(gx, 'chExt');
          if (off && ext && cho && che) {
            const kx = (num(attr(ext, 'cx')) ?? 1) / (num(attr(che, 'cx')) || 1);
            const ky = (num(attr(ext, 'cy')) ?? 1) / (num(attr(che, 'cy')) || 1);
            await walk(c, { sx: t.sx * kx, sy: t.sy * ky, ox: t.ox + t.sx * ((num(attr(off, 'x')) ?? 0) - (num(attr(cho, 'x')) ?? 0) * kx), oy: t.oy + t.sy * ((num(attr(off, 'y')) ?? 0) - (num(attr(cho, 'y')) ?? 0) * ky) });
          } else await walk(c, t);
        }
      }
    };
    // master and layout shapes that are not placeholders (logos, decorative bars) sit behind the slide's own shapes
    for (const root of [master, layout]) {
      const tree = kid(kid(root, 'cSld'), 'spTree');
      if (!tree) continue;
      for (const c of Array.from(tree.childNodes as El[])) {
        if (c.nodeType !== 1) continue;
        const k = ln(c);
        const isPh = !!kid(kid(kid(c, 'nvSpPr'), 'nvPr'), 'ph');
        if ((k === 'sp' && !isPh) || k === 'pic' || k === 'cxnSp') {
          if (k === 'pic') {
            const rels = root === layout ? lrels : masterPath ? await relsOf(masterPath) : {};
            const rid = attr(kid(kid(c, 'blipFill'), 'blip'), 'r:embed');
            const target = rid && rels[rid]?.target;
            const xf = xfOf(kid(c, 'spPr'));
            const img = target ? await loadImage(target) : null;
            if (img && xf) page.drawImage(img, { x: xf.x, y: Y(xf.y + xf.h), width: xf.w, height: xf.h });
          } else await drawShape(c, { ox: 0, oy: 0, sx: 1, sy: 1 });
        }
      }
    }
    await walk(kid(kid(slideXml, 'cSld'), 'spTree') || slideXml, { ox: 0, oy: 0, sx: 1, sy: 1 });
  }
  if (!stats.slides) throw new ToolError('All slides in this presentation are hidden, so there is nothing to print.');
  stats.replaced = fonts.replaced;
  return stats;
}
