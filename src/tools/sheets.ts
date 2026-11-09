import { PDFDocument } from 'pdf-lib';
import type { ToolDef } from '../engine/types';
import type { Block, Cell as LCell, PageSpec } from '../engine/layout';
import { Fonts, renderBlocks } from '../engine/layout';
import { parseCsv, readXlsx, writeXlsx, type Sheet } from '../engine/xlsx';
import { buildLines, detectTable, pagePieces, toNumber } from '../engine/pdftext';
import { openPdfjs } from '../engine/render';
import { MM, PAGE_SIZES, ToolError, baseName, loadDoc, needOne, pdfOut, save } from '../engine/util';

const sizeOptions = [
  { value: 'a4', label: 'A4' },
  { value: 'letter', label: 'US Letter' },
  { value: 'a3', label: 'A3' },
  { value: 'legal', label: 'US Legal' },
];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Roughly how many characters wide each column should be: the file's own width, or what the content needs. */
function columnChars(sheet: Sheet): number[] {
  return sheet.widths.map((w, i) => {
    const longest = Math.max(...sheet.rows.slice(0, 300).map((r) => (r[i]?.text || '').length), 1);
    return clamp(w > 0 ? Math.min(w, longest + 3) : longest + 2, 4, 48);
  });
}

function sheetBlocks(sheet: Sheet, usable: number, header: boolean, grid: boolean): { blocks: Block[]; size: number } {
  const chars = columnChars(sheet);
  const BASE = 9;
  const MIN = 6;
  const total = chars.reduce((a, b) => a + b, 0);
  const natural = (size: number) => total * size * 0.5;
  const size = natural(BASE) <= usable ? BASE : clamp((BASE * usable) / natural(BASE), MIN, BASE);
  // columns that do not fit even at the smallest size are split into groups printed one after another
  const groups: number[][] = [];
  let cur: number[] = [];
  let w = 0;
  chars.forEach((c, i) => {
    const cw = c * size * 0.5;
    if (cur.length && w + cw > usable) { groups.push(cur); cur = []; w = 0; }
    cur.push(i);
    w += cw;
  });
  if (cur.length) groups.push(cur);
  const blocks: Block[] = [{ type: 'p', runs: [{ text: sheet.name, bold: true, size: 12 }], size: 12, after: 6, keepNext: true }];
  groups.forEach((cols, gi) => {
    if (groups.length > 1) blocks.push({ type: 'p', runs: [{ text: `Columns ${cols[0] + 1} to ${cols[cols.length - 1] + 1}`, italic: true, size: 8, color: [0.4, 0.4, 0.4] }], size: 8, after: 2, keepNext: true });
    const rows = sheet.rows.map((r, ri) => ({
      cells: cols.map((c): LCell => {
        const cell = r[c] || { text: '', num: false };
        const isHeader = header && ri === 0;
        return { blocks: [{ type: 'p', runs: [{ text: cell.text || ' ', bold: isHeader, size }], align: cell.num ? 'right' : 'left', size, after: 0, lineHeight: 1.15 }], bg: isHeader ? [0.9, 0.93, 0.98] : undefined };
      }),
    }));
    blocks.push({ type: 'table', cols: cols.map((c) => chars[c]), rows, border: grid, pad: 2.5, repeatHeader: header }, { type: 'space', h: gi < groups.length - 1 ? 12 : 4 });
  });
  return { blocks, size };
}

export const sheetTools: ToolDef[] = [
  {
    id: 'excel-to-pdf',
    name: 'Excel to PDF',
    short: 'Spreadsheets to tidy PDFs.',
    desc: 'Convert an Excel workbook (.xlsx) or a CSV file into a PDF: every sheet becomes a neatly laid-out table, with dates, percentages and numbers formatted as Excel shows them. It runs in your browser, so nothing is uploaded.',
    category: 'convert',
    icon: '📊',
    keywords: ['excel', 'xlsx', 'csv', 'spreadsheet', 'excel to pdf', 'workbook', 'table', 'sheet'],
    inputs: [{ key: 'files', label: 'Excel workbook (.xlsx) or CSV file', accept: 'any', hint: 'Older .xls files: open them in Excel and save as .xlsx first.' }],
    options: [
      { key: 'sheets', type: 'select', label: 'Sheets', default: 'all', options: [{ value: 'all', label: 'All sheets' }, { value: 'first', label: 'First sheet only' }] },
      { key: 'orient', type: 'select', label: 'Page orientation', default: 'auto', options: [{ value: 'auto', label: 'Automatic' }, { value: 'portrait', label: 'Portrait' }, { value: 'landscape', label: 'Landscape' }] },
      { key: 'size', type: 'select', label: 'Page size', default: 'a4', options: sizeOptions },
      { key: 'header', type: 'toggle', label: 'First row is a header', default: true, hint: 'It is shaded and repeated at the top of every page.' },
      { key: 'grid', type: 'toggle', label: 'Draw cell borders', default: true },
    ],
    runLabel: 'Convert to PDF',
    tips: ['Wide sheets are shrunk to fit the page, and split into column groups if they are still too wide.', 'Values are shown as Excel last saved them. Formulas are not recalculated, and merged cells, colours, charts and pictures are not reproduced.', 'To print part of a sheet, copy it into a new workbook first.'],
    faq: [
      { q: 'Is my spreadsheet uploaded?', a: 'No. The workbook is read and converted inside your browser tab. Nothing is sent to a server.' },
      { q: 'Will it look like my Excel formatting?', a: 'It shows every sheet as a clean table and keeps number, date and percent formats, but it does not reproduce colours, fonts, merged cells, charts or pictures. For a pixel-exact print, use Excel’s own Save as PDF.' },
      { q: 'What about very wide sheets?', a: 'They are scaled down to fit. If that would make the text too small, the columns are split into groups printed one after another.' },
      { q: 'Does it support .xls and .ods?', a: 'No, only .xlsx and CSV. Open older files in Excel and save as .xlsx first.' },
    ],
    status: 'ready',
    async run({ files, opts, progress }) {
      const f = needOne(files.files, 'an Excel workbook or CSV file');
      const bytes = await f.bytes();
      progress(0.1, 'Reading the spreadsheet…');
      let sheets: Sheet[];
      if (/\.(csv|tsv|txt)$/i.test(f.name)) sheets = [parseCsv(new TextDecoder('utf-8').decode(bytes))];
      else sheets = await readXlsx(bytes);
      if (opts.sheets === 'first') sheets = sheets.slice(0, 1);
      const rowCount = sheets.reduce((n, s) => n + s.rows.length, 0);
      if (rowCount > 60000) throw new ToolError('That spreadsheet is very large (over 60,000 rows). Copy the part you need into a smaller workbook.');
      const [pw, ph] = PAGE_SIZES[String(opts.size || 'a4')] || PAGE_SIZES.a4;
      const margin = 14 * MM;
      const doc = await PDFDocument.create();
      const fonts = new Fonts(doc);
      let pages = 0;
      for (let i = 0; i < sheets.length; i++) {
        progress(0.2 + (0.7 * i) / sheets.length, `Laying out “${sheets[i].name}”…`);
        const chars = columnChars(sheets[i]);
        const wantWide = chars.reduce((a, b) => a + b, 0) * 9 * 0.5 > pw - 2 * margin;
        const landscape = opts.orient === 'landscape' || (opts.orient !== 'portrait' && wantWide);
        const [W, H] = landscape ? [ph, pw] : [pw, ph];
        const spec: PageSpec = { width: W, height: H, margin: { top: margin, right: margin, bottom: margin, left: margin } };
        const { blocks } = sheetBlocks(sheets[i], W - 2 * margin, !!opts.header, !!opts.grid);
        pages += await renderBlocks(doc, fonts, blocks, spec);
      }
      doc.setTitle(baseName(f.name));
      doc.setProducer('iDuckPDF');
      const notes = [`${sheets.length} sheet${sheets.length === 1 ? '' : 's'}, ${rowCount} rows, ${pages} page${pages === 1 ? '' : 's'}. Formulas show the values Excel saved with the file.`];
      if (fonts.replaced) notes.push(`${fonts.replaced} character${fonts.replaced === 1 ? '' : 's'} outside Western European text could not be drawn and became “?”.`);
      return { files: [pdfOut(`${baseName(f.name)}.pdf`, await save(doc))], notes };
    },
  },
  {
    id: 'pdf-to-excel',
    name: 'PDF to Excel',
    short: 'Pull tables out into a spreadsheet.',
    desc: 'Extract the tables and text of a PDF into an Excel workbook (.xlsx). Columns are found from where the text sits on the page, and numbers become real numbers. It works on PDFs with a text layer and runs in your browser, so the file is never uploaded.',
    category: 'convert',
    icon: '📈',
    keywords: ['table', 'excel', 'xlsx', 'extract table', 'pdf to excel', 'pdf to xlsx', 'bank statement', 'invoice', 'spreadsheet'],
    inputs: [{ key: 'files', label: 'PDF with tables', accept: 'pdf', hint: 'Scanned PDFs have no text layer: run them through Read scans (OCR) first.' }],
    options: [
      { key: 'mode', type: 'select', label: 'Layout', default: 'tables', options: [{ value: 'tables', label: 'Find the columns' }, { value: 'lines', label: 'One line per row' }], hint: '“Find the columns” works best on tables and statements.' },
      { key: 'sheets', type: 'select', label: 'Sheets', default: 'perPage', options: [{ value: 'perPage', label: 'One sheet per page' }, { value: 'one', label: 'Everything on one sheet' }] },
      { key: 'numbers', type: 'toggle', label: 'Turn numbers into numbers', default: true, hint: 'So Excel can add them up. Codes with leading zeros and values with symbols stay as text.' },
    ],
    runLabel: 'Convert to Excel',
    tips: ['Check the result against the PDF, especially tables with merged cells or tables that run across pages.', 'Works on PDFs with selectable text. For scans, use Read scans (OCR) first.', 'Statements and invoices usually convert well. Complex layouts may need tidying in Excel.'],
    faq: [
      { q: 'Is my PDF uploaded?', a: 'No. The PDF is read and the workbook is built inside your browser tab.' },
      { q: 'How does it find the columns?', a: 'It looks at where text sits on each page. Pieces of text that line up vertically form a column. This suits tables with clear spacing; tables without any gaps between columns cannot be split.' },
      { q: 'Why is the result empty or strange?', a: 'A scanned PDF has no text to read: use Read scans (OCR) first. Merged cells, tables that span pages and unusual layouts can also need tidying in Excel.' },
      { q: 'Are numbers real numbers?', a: 'Yes, by default. Plain numbers like 1,234.50 or (45) become numeric cells. Codes such as 007 and values with currency symbols stay as text so nothing is changed by mistake.' },
    ],
    status: 'ready',
    async run({ files, opts, progress }) {
      const f = needOne(files.files);
      const view = await openPdfjs(await f.bytes());
      const n: number = view.numPages;
      const tableMode = opts.mode !== 'lines';
      const sheets: { name: string; rows: (string | number | null)[][] }[] = [];
      const oneRows: (string | number | null)[][] = [];
      let textual = 0;
      for (let i = 1; i <= n; i++) {
        progress(0.05 + (0.85 * (i - 1)) / n, `Reading page ${i} of ${n}…`);
        const { pieces } = await pagePieces(await view.getPage(i));
        if (!pieces.length) continue;
        textual++;
        const lines = buildLines(pieces);
        const grid = tableMode ? detectTable(lines) : { rows: lines.map((l) => [l.text]), columns: 1 };
        const rows = grid.rows.map((r) => r.map((c): string | number | null => (c === '' ? null : opts.numbers ? toNumber(c) ?? c : c)));
        if (opts.sheets === 'one') { oneRows.push(...rows, ...(i < n ? [[]] : [])); } else sheets.push({ name: `Page ${i}`, rows });
      }
      if (!textual) throw new ToolError('This PDF has no text layer to read, so it is probably a scan. Run it through Read scans (OCR) first, then convert the result.');
      const out = opts.sheets === 'one' ? [{ name: baseName(f.name).slice(0, 31) || 'PDF', rows: oneRows }] : sheets;
      progress(0.95, 'Building the workbook…');
      const bytes = await writeXlsx(out, { boldFirstRow: false });
      const rowCount = out.reduce((a, s) => a + s.rows.length, 0);
      return { files: [{ name: `${baseName(f.name)}.xlsx`, mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', bytes }], notes: [`${out.length} sheet${out.length === 1 ? '' : 's'}, ${rowCount} rows. Check the columns against the PDF: layouts differ.`] };
    },
  },
];
void loadDoc;
