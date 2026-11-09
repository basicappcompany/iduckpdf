/**
 * Spreadsheet files without a spreadsheet library: read .xlsx (a zip of XML) and CSV into plain text cells with the number,
 * date and percent formats Excel would show, and write simple .xlsx files. Formulas are not evaluated: the value Excel saved
 * with the file is used. Styles, merged cells, charts and pictures are ignored.
 */
import JSZip from 'jszip';
import { ToolError } from './base';

export type Cell = { text: string; num: boolean };
export type Sheet = { name: string; rows: Cell[][]; widths: number[] };

type El = any;
const kids = (el: El, name: string): El[] => {
  const out: El[] = [];
  for (let c = el && el.firstChild; c; c = c.nextSibling) if (c.nodeType === 1 && (c.localName || String(c.nodeName).split(':').pop()) === name) out.push(c);
  return out;
};
const kid = (el: El, name: string): El | undefined => kids(el, name)[0];
const parseXml = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');

const colIndex = (ref: string): number => {
  const m = /^([A-Z]+)/i.exec(ref);
  if (!m) return 0;
  let n = 0;
  for (const ch of m[1].toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
};
export const colName = (i: number): string => {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

const BUILTIN_DATE = new Set([14, 15, 16, 17, 22, 45, 46, 47]);
const BUILTIN_PERCENT: Record<number, number> = { 9: 0, 10: 2 };
const BUILTIN_DECIMALS: Record<number, [number, boolean]> = { 1: [0, false], 2: [2, false], 3: [0, true], 4: [2, true] };

type Fmt = { kind: 'general' | 'date' | 'percent' | 'number'; decimals: number; thousands: boolean; prefix: string; suffix: string; time: boolean };
const GENERAL: Fmt = { kind: 'general', decimals: -1, thousands: false, prefix: '', suffix: '', time: false };

function parseFormat(id: number, code: string | undefined): Fmt {
  if (BUILTIN_DATE.has(id)) return { ...GENERAL, kind: 'date', time: id === 22 };
  if (id in BUILTIN_PERCENT) return { ...GENERAL, kind: 'percent', decimals: BUILTIN_PERCENT[id] };
  if (id in BUILTIN_DECIMALS) return { ...GENERAL, kind: 'number', decimals: BUILTIN_DECIMALS[id][0], thousands: BUILTIN_DECIMALS[id][1] };
  if (!code || /^general$/i.test(code)) return GENERAL;
  const plain = code.split(';')[0].replace(/"[^"]*"/g, (m) => m.replace(/./g, '_')).replace(/\\./g, '_').replace(/\[[^\]]*\]/g, '');
  if (/[dmyhs]/i.test(plain.replace(/_/g, '')) && !/[#0]/.test(plain)) return { ...GENERAL, kind: 'date', time: /[hs]/i.test(plain) };
  const literals = (code.match(/"([^"]*)"/g) || []).map((s) => s.slice(1, -1));
  const sym = (code.match(/\[\$([^\]\-]*)/) || [])[1] || (/[$€£¥]/.exec(code) || [])[0] || '';
  const decimals = (/\.(0+)/.exec(plain) || [, ''])[1].length;
  const thousands = /#,##/.test(plain) || /0,0/.test(plain);
  const percent = /%/.test(plain);
  const prefix = sym && code.indexOf(sym) < code.search(/[#0]/) ? sym : '';
  const suffix = percent ? '%' : literals.filter((l) => /^\s*[A-Za-z%]+\s*$/.test(l)).join('');
  if (!/[#0]/.test(plain)) return GENERAL;
  return { kind: percent ? 'percent' : 'number', decimals, thousands, prefix, suffix: percent ? '' : suffix, time: false };
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
function excelDate(serial: number, date1904: boolean, time: boolean): string {
  const ms = Math.round((serial - (date1904 ? 24107 : 25569)) * 86400000);
  const d = new Date(ms);
  const day = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const hasTime = time || Math.abs(serial - Math.floor(serial)) > 1e-9;
  return hasTime ? `${Math.floor(serial) === 0 ? '' : day + ' '}${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : day;
}
const withCommas = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export function formatNumber(v: number, f: Fmt, date1904 = false): string {
  if (f.kind === 'date') return excelDate(v, date1904, f.time);
  if (f.kind === 'percent') return `${(v * 100).toFixed(Math.max(0, f.decimals))}%`;
  if (f.kind === 'number') {
    const abs = Math.abs(v).toFixed(Math.max(0, f.decimals));
    const [int, frac] = abs.split('.');
    return `${v < 0 ? '-' : ''}${f.prefix}${f.thousands ? withCommas(int) : int}${frac ? '.' + frac : ''}${f.suffix}`;
  }
  if (Number.isInteger(v)) return String(v);
  return String(parseFloat(v.toPrecision(10)));
}

export async function readXlsx(bytes: Uint8Array): Promise<Sheet[]> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new ToolError('This does not look like an .xlsx file. Older .xls files are not supported: open them in Excel and save as .xlsx.');
  }
  const read = async (p: string) => { const f = zip.file(p); return f ? f.async('string') : ''; };
  const wbXml = await read('xl/workbook.xml');
  if (!wbXml) throw new ToolError('This does not look like an Excel workbook (xl/workbook.xml is missing).');
  const wb = parseXml(wbXml).documentElement;
  const date1904 = /date1904="(1|true)"/.test(wbXml);

  const rels: Record<string, string> = {};
  const relsXml = await read('xl/_rels/workbook.xml.rels');
  if (relsXml) for (const r of Array.from(parseXml(relsXml).getElementsByTagName('Relationship')) as El[]) rels[r.getAttribute('Id')] = r.getAttribute('Target');

  const shared: string[] = [];
  const ssXml = await read('xl/sharedStrings.xml');
  if (ssXml) for (const si of kids(parseXml(ssXml).documentElement, 'si')) shared.push(Array.from(si.getElementsByTagName('t') as El[]).map((t: El) => t.textContent || '').join(''));

  const numFmts: Record<number, string> = {};
  const xfFormat: Fmt[] = [];
  const stXml = await read('xl/styles.xml');
  if (stXml) {
    const st = parseXml(stXml).documentElement;
    for (const nf of kids(kid(st, 'numFmts'), 'numFmt')) numFmts[Number(nf.getAttribute('numFmtId'))] = nf.getAttribute('formatCode');
    for (const xf of kids(kid(st, 'cellXfs'), 'xf')) { const id = Number(xf.getAttribute('numFmtId') || 0); xfFormat.push(parseFormat(id, numFmts[id])); }
  }

  const sheets: Sheet[] = [];
  for (const sh of kids(kid(wb, 'sheets'), 'sheet')) {
    if (sh.getAttribute('state') === 'hidden' || sh.getAttribute('state') === 'veryHidden') continue;
    const target = rels[sh.getAttribute('r:id')];
    if (!target) continue;
    const path = target.startsWith('/') ? target.slice(1) : 'xl/' + target;
    const xml = await read(path);
    if (!xml) continue;
    const ws = parseXml(xml).documentElement;
    const rows: Cell[][] = [];
    let maxCol = 0;
    let lastRow = 0;
    for (const row of kids(kid(ws, 'sheetData'), 'row')) {
      const rIdx = Number(row.getAttribute('r') || lastRow + 1);
      while (rows.length < rIdx - 1 && rows.length - lastRow < 4) rows.push([]); // keep small gaps, ignore huge ones
      const cells: Cell[] = [];
      for (const c of kids(row, 'c')) {
        const ref = c.getAttribute('r') || '';
        const ci = ref ? colIndex(ref) : cells.length;
        const t = c.getAttribute('t') || 'n';
        const v = kid(c, 'v');
        let text = '';
        let num = false;
        if (t === 's') text = shared[Number(v?.textContent)] ?? '';
        else if (t === 'inlineStr') text = Array.from(c.getElementsByTagName('t') as El[]).map((x: El) => x.textContent || '').join('');
        else if (t === 'b') text = v?.textContent === '1' ? 'TRUE' : 'FALSE';
        else if (t === 'str' || t === 'e') text = v?.textContent || '';
        else if (v && v.textContent !== '') {
          const n = Number(v.textContent);
          const fmt = xfFormat[Number(c.getAttribute('s') || 0)] || GENERAL;
          text = isNaN(n) ? v.textContent || '' : formatNumber(n, fmt, date1904);
          num = !isNaN(n) && fmt.kind !== 'date';
        }
        while (cells.length < ci) cells.push({ text: '', num: false });
        cells[ci] = { text, num };
        maxCol = Math.max(maxCol, ci + 1);
      }
      rows.push(cells);
      lastRow = rows.length;
    }
    // trailing empty rows are not worth printing
    while (rows.length && rows[rows.length - 1].every((c) => !c || !c.text)) rows.pop();
    if (!rows.length) continue;
    const widths: number[] = new Array(maxCol).fill(0);
    for (const col of kids(kid(ws, 'cols'), 'col')) {
      const w = Number(col.getAttribute('width') || 0);
      for (let i = Number(col.getAttribute('min')) - 1; i < Math.min(Number(col.getAttribute('max')), maxCol); i++) if (i >= 0) widths[i] = w;
    }
    const full = rows.map((r) => Array.from({ length: maxCol }, (_, i) => r[i] || { text: '', num: false }));
    sheets.push({ name: sh.getAttribute('name') || `Sheet${sheets.length + 1}`, rows: full, widths });
  }
  if (!sheets.length) throw new ToolError('This workbook has no sheets with data.');
  return sheets;
}

/** CSV or TSV text to cells. The separator (comma, semicolon or tab) is guessed from the first line. */
export function parseCsv(text: string): Sheet {
  const body = text.replace(/^﻿/, '');
  const first = body.split(/\r?\n/, 1)[0] || '';
  const sep = [',', ';', '\t'].map((s) => [s, first.split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (q) {
      if (ch === '"' && body[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && body[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  while (rows.length && rows[rows.length - 1].every((c) => !c)) rows.pop();
  const maxCol = Math.max(1, ...rows.map((r) => r.length));
  const isNum = (s: string) => /^-?[\d,]*\.?\d+%?$/.test(s.trim()) && s.trim() !== '';
  return { name: 'Sheet1', rows: rows.map((r) => Array.from({ length: maxCol }, (_, i) => ({ text: r[i] ?? '', num: isNum(r[i] ?? '') }))), widths: new Array(maxCol).fill(0) };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!)).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

export type OutSheet = { name: string; rows: (string | number | null)[][] };

/** A small, valid .xlsx: text as inline strings, numbers as numbers, auto column widths, bold first row optional. */
export async function writeXlsx(sheets: OutSheet[], opts: { boldFirstRow?: boolean } = {}): Promise<Uint8Array> {
  const z = new JSZip();
  const used = new Set<string>();
  const names = sheets.map((s, i) => {
    let n = (s.name || `Sheet${i + 1}`).replace(/[\[\]:*?/\\]/g, ' ').trim().slice(0, 31) || `Sheet${i + 1}`;
    let k = 2;
    while (used.has(n.toLowerCase())) n = `${n.slice(0, 28)} ${k++}`;
    used.add(n.toLowerCase());
    return n;
  });
  z.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
  z.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  z.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`);
  z.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  z.file('xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>');
  sheets.forEach((s, si) => {
    const ncols = Math.max(1, ...s.rows.map((r) => r.length));
    const widths = Array.from({ length: ncols }, (_, c) => Math.min(60, Math.max(8, ...s.rows.slice(0, 200).map((r) => String(r[c] ?? '').length + 2))));
    const rowsXml = s.rows.map((r, ri) => {
      const cells = r.map((v, ci) => {
        if (v === null || v === '' || v === undefined) return '';
        const ref = `${colName(ci)}${ri + 1}`;
        const style = opts.boldFirstRow && ri === 0 ? ' s="1"' : '';
        return typeof v === 'number' && isFinite(v) ? `<c r="${ref}"${style}><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`;
      }).join('');
      return cells ? `<row r="${ri + 1}">${cells}</row>` : '';
    }).join('');
    z.file(`xl/worksheets/sheet${si + 1}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rowsXml}</sheetData></worksheet>`);
  });
  return z.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
