/**
 * Tests for the Office and web conversions (Word, HTML, Excel, PowerPoint, and PDF to Word / Excel). They run in Node: the
 * browser's XML parser is replaced by @xmldom/xmldom, and pdf.js (legacy build) reads the generated PDFs back so the tests can
 * check what ended up on each page.
 * Run:  npx tsx scripts/test-office.ts
 */
import JSZip from 'jszip';
import { DOMParser as XmlDOMParser } from '@xmldom/xmldom';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { ALL_TOOLS } from '../src/tools/all';
import type { PickedFile, ToolResult } from '../src/engine/types';
import { ToolError } from '../src/engine/util';
import { readXlsx } from '../src/engine/xlsx';

(globalThis as any).DOMParser = XmlDOMParser;
const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!/polyfill|fetchStandardFontData/.test(String(a[0]))) warn(...a); }; // pdf.js chatter in Node
const nodeRequire = eval('require') as NodeRequire;
const pdfjs = nodeRequire('pdfjs-dist/legacy/build/pdf.mjs');
const FONT_DIR = nodeRequire('path').join(process.cwd(), 'node_modules', 'pdfjs-dist', 'standard_fonts') + '/';
// pdf.js looks for window.pdfjsLib in the browser build of our loader; tell it we already have the library
(globalThis as any).window = { pdfjsLib: pdfjs };

const byId = (id: string) => ALL_TOOLS.find((t) => t.id === id)!;
const pf = (name: string, bytes: Uint8Array, type = 'application/octet-stream'): PickedFile => ({ name, size: bytes.length, type, bytes: async () => bytes });
let pass = 0;
let fail = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, extra = '') {
  if (ok) pass++;
  else { fail++; failures.push(`${name} ${extra}`); }
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`);
}
async function run(id: string, files: Record<string, PickedFile[]>, opts: Record<string, any> = {}): Promise<ToolResult> {
  const tool = byId(id);
  const defaults: Record<string, any> = {};
  (tool.options || []).forEach((o) => (defaults[o.key] = (o as any).default ?? ''));
  return tool.run!({ files, opts: { ...defaults, ...opts }, progress: () => {} });
}
const throws = async (fn: () => Promise<unknown>) => { try { await fn(); return null; } catch (e) { return e; } };

/** Text of each page, with pdf.js (positions are kept so lines come out in reading order). */
async function pdfPages(bytes: Uint8Array): Promise<{ text: string; width: number; height: number }[]> {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, disableFontFace: true, standardFontDataUrl: FONT_DIR, verbosity: 0 }).promise;
  const out = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    out.push({ text: (tc.items as any[]).map((it) => it.str).join(' ').replace(/\s+/g, ' '), width: vp.width, height: vp.height });
  }
  return out;
}
const all = (pages: { text: string }[]) => pages.map((p) => p.text).join(' ');
/** Targets of the clickable links on every page. */
async function pdfLinks(bytes: Uint8Array): Promise<string[]> {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, disableFontFace: true, standardFontDataUrl: FONT_DIR, verbosity: 0 }).promise;
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) for (const a of await (await doc.getPage(i)).getAnnotations()) if (a.url) out.push(a.url);
  return out;
}

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
async function makeDocx(body: string, extra: Record<string, string> = {}): Promise<Uint8Array> {
  const z = new JSZip();
  z.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>');
  z.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document ${NS}><w:body>${body}</w:body></w:document>`);
  for (const [p, c] of Object.entries(extra)) z.file(p, c);
  return z.generateAsync({ type: 'uint8array' });
}

/** A small .xlsx built by hand, so the tests do not depend on a spreadsheet library. */
async function makeXlsx(sheets: { name: string; xml: string; state?: string }[], strings: string[] = []): Promise<Uint8Array> {
  const z = new JSZip();
  z.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>');
  z.file('xl/workbook.xml', '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + sheets.map((sh, i) => `<sheet name="${sh.name}" sheetId="${i + 1}" r:id="rId${i + 1}"${sh.state ? ` state="${sh.state}"` : ''}/>`).join('') + '</sheets></workbook>');
  z.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="x" Target="worksheets/sheet${i + 1}.xml"/>`).join('') + '</Relationships>');
  z.file('xl/sharedStrings.xml', '<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + strings.map((t) => `<si><t>${t}</t></si>`).join('') + '</sst>');
  z.file('xl/styles.xml', '<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts><cellXfs count="4"><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="10"/><xf numFmtId="164"/></cellXfs></styleSheet>');
  sheets.forEach((sh, i) => z.file(`xl/worksheets/sheet${i + 1}.xml`, '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + sh.xml + '</worksheet>'));
  return z.generateAsync({ type: 'uint8array' });
}

(async () => {
  // ================= HTML to PDF =================
  const html = `<html><head><title>Doc</title><style>p{color:red}</style><script>alert(1)</script></head><body>
    <h1>Main Title</h1><p>First paragraph with <b>bold</b> and <a href="https://example.com/x">a link</a> and café.</p>
    <ul><li>Alpha</li><li>Beta<ul><li>Nested</li></ul></li></ul><ol><li>One</li><li>Two</li></ol>
    <table border="1"><tr><th>Name</th><th>Qty</th></tr><tr><td>Apple</td><td>3</td></tr></table>
    <pre>code line</pre><hr/><blockquote>Quoted words</blockquote></body></html>`;
  let r = await run('html-to-pdf', { files: [] }, { html });
  let pages = await pdfPages(r.files![0].bytes);
  let text = all(pages);
  check('html: headings, paragraphs, lists, a table, code and a quote are all in the PDF', ['Main Title', 'First paragraph', 'bold', 'Alpha', 'Beta', 'Nested', 'One', 'Two', 'Name', 'Apple', 'code line', 'Quoted words'].every((w) => text.includes(w)), text.slice(0, 120));
  check('html: scripts and style sheets are not printed', !text.includes('alert') && !text.includes('color:red'));
  check('html: an accented letter in the standard font survives', text.includes('café'));
  check('html: list bullets and numbers are drawn', text.includes('•') && text.includes('1.') && text.includes('2.'));
  check('html: a hyperlink becomes a clickable annotation', (await pdfLinks(r.files![0].bytes)).includes('https://example.com/x'));
  check('html: the page is A4 by default', Math.abs(pages[0].width - 595.28) < 1 && Math.abs(pages[0].height - 841.89) < 1);

  const long = '<body>' + Array.from({ length: 160 }, (_, i) => `<p>Paragraph number ${i + 1} has enough words to take up a good share of one line on the page so the document must flow onto further pages.</p>`).join('') + '</body>';
  r = await run('html-to-pdf', { files: [] }, { html: long });
  pages = await pdfPages(r.files![0].bytes);
  check('html: a long document is paginated, with the last paragraph on the last page', pages.length >= 4 && pages[pages.length - 1].text.includes('Paragraph number 160'), `${pages.length} pages`);
  check('html: no paragraph is lost between pages', Array.from({ length: 160 }, (_, i) => `Paragraph number ${i + 1} `).every((p) => all(pages).includes(p)));

  r = await run('html-to-pdf', { files: [pf('page.html', new TextEncoder().encode('<p>From a file</p>'))] }, { size: 'letter' });
  pages = await pdfPages(r.files![0].bytes);
  check('html: an .html file works, with Letter paper when asked', pages[0].text.includes('From a file') && Math.abs(pages[0].width - 612) < 1, `${pages[0].width}`);
  r = await run('html-to-pdf', { files: [] }, { html: '<p>Привет hello</p>' });
  check('html: characters the standard fonts cannot draw are replaced and reported', (r.notes || []).join(' ').includes('could not be drawn') && all(await pdfPages(r.files![0].bytes)).includes('hello'));
  check('html: nothing to convert is refused with advice', (await throws(() => run('html-to-pdf', { files: [] }, { html: '  ' }))) instanceof ToolError);
  check('html: a linked picture is reported as left out', ((await run('html-to-pdf', { files: [] }, { html: '<html><body><p>x</p><img src="http://example.com/a.png"/></body></html>' })).notes || []).join(' ').includes('left out'));

  // ================= Word to PDF =================
  const styles = `<?xml version="1.0"?><w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
    <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="40"/><w:color w:val="1F3864"/></w:rPr></w:style></w:styles>`;
  const numbering = `<?xml version="1.0"?><w:numbering ${NS}>
    <w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val=""/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>
    <w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>
    <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>`;
  const rels = `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.org/doc" TargetMode="External"/></Relationships>`;
  const p = (t: string, ppr = '', rpr = '') => `<w:p>${ppr ? `<w:pPr>${ppr}</w:pPr>` : ''}<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}<w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;
  const body = [
    p('Report Heading', '<w:pStyle w:val="Heading1"/>'),
    `<w:p><w:r><w:t xml:space="preserve">Normal text with </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>bold</w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve"> italic </w:t></w:r><w:hyperlink r:id="rId9"><w:r><w:t>a link</w:t></w:r></w:hyperlink></w:p>`,
    p('Bullet one', '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>'),
    p('Bullet two', '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>'),
    p('Step first', '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr>'),
    p('Step second', '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr>'),
    `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/></w:tblPr><w:tblGrid><w:gridCol w:w="3000"/><w:gridCol w:w="6000"/></w:tblGrid>
      <w:tr><w:tc><w:p><w:r><w:t>Cell A1</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Cell B1</w:t></w:r></w:p></w:tc></w:tr>
      <w:tr><w:tc><w:p><w:r><w:t>Cell A2</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Cell B2</w:t></w:r></w:p></w:tc></w:tr></w:tbl>`,
    `<w:p><w:r><w:t>Before the break</w:t></w:r><w:r><w:br w:type="page"/></w:r></w:p>`,
    p('After the break'),
    '<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>',
  ].join('');
  const docx = await makeDocx(body, { 'word/styles.xml': styles, 'word/numbering.xml': numbering, 'word/_rels/document.xml.rels': rels });
  r = await run('word-to-pdf', { files: [pf('report.docx', docx)] });
  pages = await pdfPages(r.files![0].bytes);
  text = all(pages);
  check('word: heading, formatted paragraph and a hyperlink are in the PDF', ['Report Heading', 'Normal text with', 'bold', 'italic', 'a link'].every((w) => text.includes(w)));
  check('word: bullets and numbered steps are drawn with their markers', text.includes('•') && text.includes('Bullet one') && /1\. ?Step first|Step first/.test(text) && text.includes('2.'));
  check('word: a table keeps every cell', ['Cell A1', 'Cell B1', 'Cell A2', 'Cell B2'].every((w) => text.includes(w)));
  check('word: a page break starts a new page', pages.length === 2 && pages[0].text.includes('Before the break') && pages[1].text.includes('After the break'), `${pages.length} pages`);
  check('word: the page size and orientation come from the document (A4 landscape)', Math.abs(pages[0].width - 841.9) < 1 && Math.abs(pages[0].height - 595.3) < 1, `${pages[0].width} x ${pages[0].height}`);
  check('word: the hyperlink is clickable', (await pdfLinks(r.files![0].bytes)).includes('https://example.org/doc'));
  r = await run('word-to-pdf', { files: [pf('report.docx', docx)] }, { size: 'letter' });
  pages = await pdfPages(r.files![0].bytes);
  check('word: choosing Letter overrides the document page size', Math.abs(pages[0].width - 612) < 1 && Math.abs(pages[0].height - 792) < 1);
  check('word: the result notes what is not reproduced', (r.notes || []).join(' ').includes('headers, footers'));
  const big = await makeDocx(Array.from({ length: 120 }, (_, i) => p(`Line ${i + 1} of a long document that should flow across several pages without losing anything.`)).join('') + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>');
  pages = await pdfPages((await run('word-to-pdf', { files: [pf('big.docx', big)] })).files![0].bytes);
  check('word: a long document flows onto several pages and keeps every line', pages.length >= 3 && Array.from({ length: 120 }, (_, i) => `Line ${i + 1} of`).every((l) => all(pages).includes(l)), `${pages.length} pages`);
  check('word: a file that is not a Word document is refused clearly', (await throws(() => run('word-to-pdf', { files: [pf('x.docx', new TextEncoder().encode('not a zip'))] }))) instanceof ToolError);
  const plainZip = await new JSZip().file('a.txt', 'hi').generateAsync({ type: 'uint8array' });
  check('word: a zip that is not a Word document is refused clearly', (await throws(() => run('word-to-pdf', { files: [pf('x.docx', plainZip)] }))) instanceof ToolError);

  // ================= Excel to PDF =================
  const strings = ['Item', 'Qty', 'Price', 'Date', 'Growth', 'Total', 'Apple', 'Pear', 'Hello notes'];
  const sales = '<sheetData>' +
    '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c><c r="E1" t="s"><v>4</v></c><c r="F1" t="s"><v>5</v></c></row>' +
    '<row r="2"><c r="A2" t="s"><v>6</v></c><c r="B2"><v>3</v></c><c r="C2"><v>1.5</v></c><c r="D2" s="1"><v>45292</v></c><c r="E2" s="2"><v>0.125</v></c><c r="F2" s="3"><v>1234.5</v></c></row>' +
    '<row r="3"><c r="A3" t="s"><v>7</v></c><c r="B3"><v>12</v></c><c r="C3"><v>0.3333333333333333</v></c><c r="D3" s="1"><v>45658</v></c><c r="E3" s="2"><v>-0.05</v></c><c r="F3" s="3"><v>99</v></c></row></sheetData>';
  const notes = '<sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Inline note</t></is></c><c r="B1" t="b"><v>1</v></c></row></sheetData>';
  const xlsx = await makeXlsx([{ name: 'Sales', xml: sales }, { name: 'Hidden', xml: notes, state: 'hidden' }, { name: 'Notes', xml: notes }], strings);
  const read = await readXlsx(xlsx);
  check('xlsx reader: numbers, dates, percent and thousands formats come out as Excel shows them', read[0].rows[1].map((c) => c.text).join('|') === 'Apple|3|1.5|2024-01-01|12.50%|1,234.50', read[0].rows[1].map((c) => c.text).join('|'));
  check('xlsx reader: a long decimal is tidied and negatives keep their sign', read[0].rows[2][2].text === '0.3333333333' && read[0].rows[2][4].text === '-5.00%' && read[0].rows[2][3].text === '2025-01-01');
  check('xlsx reader: hidden sheets are skipped and inline strings and booleans work', read.length === 2 && read[1].name === 'Notes' && read[1].rows[0][0].text === 'Inline note' && read[1].rows[0][1].text === 'TRUE');
  r = await run('excel-to-pdf', { files: [pf('book.xlsx', xlsx)] });
  pages = await pdfPages(r.files![0].bytes);
  text = all(pages);
  check('excel: every sheet is printed with its name, headers and formatted values', ['Sales', 'Item', 'Qty', 'Apple', 'Pear', '2024-01-01', '12.50%', '1,234.50', 'Notes', 'Inline note'].every((w) => text.includes(w)), text.slice(0, 100));
  check('excel: a hidden sheet is not printed', !text.includes('Hidden'));
  r = await run('excel-to-pdf', { files: [pf('book.xlsx', xlsx)] }, { sheets: 'first' });
  check('excel: "first sheet only" leaves the others out', !all(await pdfPages(r.files![0].bytes)).includes('Inline note'));

  // a long sheet: the header row repeats on every page
  const longRows = '<sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Code</t></is></c><c r="B1" t="inlineStr"><is><t>Amount</t></is></c></row>' + Array.from({ length: 220 }, (_, i) => `<row r="${i + 2}"><c r="A${i + 2}" t="inlineStr"><is><t>ROW${i + 1}</t></is></c><c r="B${i + 2}"><v>${i + 1}</v></c></row>`).join('') + '</sheetData>';
  r = await run('excel-to-pdf', { files: [pf('long.xlsx', await makeXlsx([{ name: 'Long', xml: longRows }]))] });
  pages = await pdfPages(r.files![0].bytes);
  check('excel: a 220-row sheet runs over several pages and keeps every row', pages.length >= 3 && Array.from({ length: 220 }, (_, i) => `ROW${i + 1} `).every((x) => all(pages).includes(x)), `${pages.length} pages`);
  check('excel: the header row is repeated at the top of every page', pages.every((p) => p.text.includes('Code') && p.text.includes('Amount')));
  r = await run('excel-to-pdf', { files: [pf('long.xlsx', await makeXlsx([{ name: 'Long', xml: longRows }]))] }, { header: false });
  check('excel: with "first row is a header" off, the header is not repeated', (await pdfPages(r.files![0].bytes)).slice(1).every((p) => !p.text.includes('Code')));

  // a very wide sheet is shrunk, then split into column groups, and nothing is lost
  const wideCells = (row: number) => Array.from({ length: 36 }, (_, c) => { const col = c < 26 ? String.fromCharCode(65 + c) : 'A' + String.fromCharCode(65 + c - 26); return `<c r="${col}${row}" t="inlineStr"><is><t>${row === 1 ? 'Head' + c : 'Value number ' + c}</t></is></c>`; }).join('');
  const wide = '<sheetData><row r="1">' + wideCells(1) + '</row><row r="2">' + wideCells(2) + '</row></sheetData>';
  r = await run('excel-to-pdf', { files: [pf('wide.xlsx', await makeXlsx([{ name: 'Wide', xml: wide }]))] });
  pages = await pdfPages(r.files![0].bytes);
  check('excel: a very wide sheet keeps every column (landscape, shrunk or split into groups)', Array.from({ length: 36 }, (_, c) => 'Head' + c).every((h) => all(pages).includes(h)) && pages[0].width > pages[0].height, `${pages.length} pages, ${pages[0].width.toFixed(0)} wide`);

  // CSV
  const csv = 'Name;Score;Note\r\n"Smith, Jo";12,5;"said ""hi"""\r\nLee;7;plain\r\n';
  r = await run('excel-to-pdf', { files: [pf('data.csv', new TextEncoder().encode(csv))] });
  text = all(await pdfPages(r.files![0].bytes));
  check('csv: a semicolon file with quotes and an embedded separator converts', ['Name', 'Smith, Jo', 'said "hi"', 'Lee', 'plain'].every((w) => text.includes(w)), text.slice(0, 80));
  check('excel: something that is not an Excel file is refused with advice', (await throws(() => run('excel-to-pdf', { files: [pf('x.xlsx', new TextEncoder().encode('nope'))] }))) instanceof ToolError);

  // ================= PDF to Excel =================
  const tdoc = await PDFDocument.create();
  const tf = await tdoc.embedFont(StandardFonts.Helvetica);
  const tp = tdoc.addPage([595, 842]);
  const put = (t: string, x: number, y: number, size = 11) => tp.drawText(t, { x, y, size, font: tf });
  put('Statement for January', 50, 780, 16);
  put('Item', 50, 740); put('Qty', 260, 740); put('Price', 360, 740); put('Note', 450, 740);
  put('Apple', 50, 720); put('3', 268, 720); put('1,200.50', 345, 720); put('fresh', 450, 720);
  put('Pear', 50, 700); put('12', 262, 700); put('(45.00)', 352, 700); put('007', 450, 700);
  put('Plum', 50, 680); put('150', 255, 680); put('9.99', 362, 680); put('ok', 450, 680);
  const t2 = tdoc.addPage([595, 842]);
  t2.drawText('Second page text', { x: 50, y: 780, size: 12, font: tf });
  const tbytes = await tdoc.save();
  r = await run('pdf-to-excel', { files: [pf('stmt.pdf', tbytes, 'application/pdf')] });
  let wbk = await readXlsx(r.files![0].bytes);
  const rowText = (sheet: number, row: number) => wbk[sheet].rows[row].map((c) => c.text).join('|');
  check('pdf to excel: one sheet per page', wbk.length === 2 && wbk[0].name === 'Page 1' && wbk[1].name === 'Page 2');
  const flat = wbk[0].rows.map((rw) => rw.map((c) => c.text).join('|'));
  check('pdf to excel: the heading line stays in the first column', flat[0].startsWith('Statement for January'), flat[0]);
  check('pdf to excel: the table rows are split into the right columns', flat.some((l) => l === 'Item|Qty|Price|Note') && flat.some((l) => l === 'Apple|3|1200.5|fresh') && flat.some((l) => l === 'Plum|150|9.99|ok'), flat.join(' // '));
  check('pdf to excel: (45.00) becomes -45 and the code 007 stays text', flat.some((l) => l === 'Pear|12|-45|007'), flat.join(' // '));
  const numericCell = wbk[0].rows.flat().find((c) => c.text === '1200.5');
  check('pdf to excel: numbers are stored as real numbers', !!numericCell && numericCell.num === true);
  check('pdf to excel: the second page is on its own sheet', rowText(1, 0).startsWith('Second page text'));
  r = await run('pdf-to-excel', { files: [pf('stmt.pdf', tbytes, 'application/pdf')] }, { numbers: false });
  wbk = await readXlsx(r.files![0].bytes);
  check('pdf to excel: with "numbers" off everything stays text', !wbk[0].rows.flat().some((c) => c.num));
  r = await run('pdf-to-excel', { files: [pf('stmt.pdf', tbytes, 'application/pdf')] }, { sheets: 'one' });
  wbk = await readXlsx(r.files![0].bytes);
  check('pdf to excel: "everything on one sheet" gives a single sheet with both pages', wbk.length === 1 && wbk[0].rows.some((rw) => rw[0].text === 'Second page text') && wbk[0].rows.some((rw) => rw[0].text === 'Apple'));
  r = await run('pdf-to-excel', { files: [pf('stmt.pdf', tbytes, 'application/pdf')] }, { mode: 'lines' });
  wbk = await readXlsx(r.files![0].bytes);
  check('pdf to excel: "one line per row" puts each line in column A', wbk[0].rows.some((rw) => rw[0].text.startsWith('Apple') && rw.length === 1));
  const blank = await PDFDocument.create();
  blank.addPage([300, 300]);
  const blankBytes = await blank.save();
  const scanErr = await throws(() => run('pdf-to-excel', { files: [pf('blank.pdf', blankBytes, 'application/pdf')] }));
  check('pdf to excel: a PDF with no text layer points to OCR', scanErr instanceof ToolError && /Read scans \(OCR\)/.test((scanErr as Error).message));

  // ================= PDF to Word =================
  const wd = await PDFDocument.create();
  const reg = await wd.embedFont(StandardFonts.Helvetica);
  const bold = await wd.embedFont(StandardFonts.HelveticaBold);
  const wp1 = wd.addPage([595, 842]);
  const w = (pg: any, t: string, x: number, y: number, size = 11, font = reg) => pg.drawText(t, { x, y, size, font });
  w(wp1, 'Annual Report', 50, 780, 26, bold);
  w(wp1, 'This report summarises the results of the year and', 50, 740);
  w(wp1, 'explains what the board plans to do next.', 50, 726);
  w(wp1, 'Highlights', 50, 690, 16, bold);
  w(wp1, '\u2022 Alpha growth', 50, 668); w(wp1, '\u2022 Beta launch', 50, 652);
  w(wp1, 'Region', 50, 610); w(wp1, 'Sales', 250, 610); w(wp1, 'Margin', 400, 610);
  w(wp1, 'North', 50, 592); w(wp1, '120', 250, 592); w(wp1, '14%', 400, 592);
  w(wp1, 'South', 50, 574); w(wp1, '98', 250, 574); w(wp1, '11%', 400, 574);
  const wp2 = wd.addPage([595, 842]);
  for (let i = 1; i <= 26; i++) { w(wp2, `LEFTCOL line ${i} text`, 50, 800 - i * 22); w(wp2, `RIGHTCOL line ${i} text`, 320, 800 - i * 22); }
  const wordBytes = await wd.save();
  r = await run('pdf-to-word', { files: [pf('report.pdf', wordBytes, 'application/pdf')] });
  const dz = await JSZip.loadAsync(r.files![0].bytes);
  const dxml = await dz.file('word/document.xml')!.async('string');
  const plain = dxml.replace(/<w:br w:type="page"\/>/g, ' [PAGEBREAK] ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  check('pdf to word: a real .docx with document, styles and content types', !!dz.file('word/styles.xml') && !!dz.file('[Content_Types].xml') && r.files![0].name === 'report.docx');
  check('pdf to word: the big bold title becomes a Heading 1 and the sub-heading a heading', /Heading1"\/>[^]*?Annual Report/.test(dxml) && /Heading[23]"\/>[^]*?Highlights/.test(dxml));
  check('pdf to word: wrapped lines are joined into one paragraph', plain.includes('summarises the results of the year and explains what the board plans'), plain.slice(0, 200));
  check('pdf to word: list items stay list items', /<w:ind w:left="540" w:hanging="360"\/>[^]*?Alpha growth/.test(dxml) && plain.includes('Beta launch'));
  check('pdf to word: the table becomes a Word table with every cell', /<w:tbl>/.test(dxml) && ['Region', 'Sales', 'Margin', 'North', '120', '14%', 'South', '98', '11%'].every((c) => dxml.includes('>' + c + '<')));
  check('pdf to word: pages are separated by a page break', dxml.includes('<w:br w:type="page"/>'));
  const leftAt = plain.lastIndexOf('LEFTCOL line 26'), rightAt = plain.indexOf('RIGHTCOL line 1 ');
  check('pdf to word: a two-column page is read column by column (left column first)', leftAt > 0 && rightAt > leftAt, `left26=${leftAt} right1=${rightAt}`);
  const back = await run('word-to-pdf', { files: [pf('report.docx', r.files![0].bytes)] });
  const backText = all(await pdfPages(back.files![0].bytes));
  check('pdf to word: the .docx opens again (round trip through Word to PDF) with the same text', ['Annual Report', 'Highlights', 'Alpha growth', 'Region', 'North', 'LEFTCOL line 1 '].every((x) => backText.includes(x)));
  r = await run('pdf-to-word', { files: [pf('report.pdf', wordBytes, 'application/pdf')] }, { tables: false });
  check('pdf to word: with tables off there is no Word table', !(await (await JSZip.loadAsync(r.files![0].bytes)).file('word/document.xml')!.async('string')).includes('<w:tbl>'));
  const scanDoc = await PDFDocument.create();
  scanDoc.addPage([300, 300]);
  const scanBytes = await scanDoc.save();
  const scanErr2 = await throws(() => run('pdf-to-word', { files: [pf('scan.pdf', scanBytes, 'application/pdf')] }));
  check('pdf to word: a PDF with no text layer points to OCR', scanErr2 instanceof ToolError && /Read scans \(OCR\)/.test((scanErr2 as Error).message));

  // ================= PowerPoint to PDF =================
  const A = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
  const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const relFile = (items: [string, string, string][]) => `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.map(([id, type, target]) => `<Relationship Id="${id}" Type="${REL}/${type}" Target="${target}"/>`).join('')}</Relationships>`;
  const png1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const pz = new JSZip();
  pz.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>');
  pz.file('ppt/presentation.xml', `<?xml version="1.0"?><p:presentation ${A}><p:sldIdLst><p:sldId id="256" r:id="rId1"/><p:sldId id="257" r:id="rId2"/><p:sldId id="258" r:id="rId3"/></p:sldIdLst><p:sldSz cx="9144000" cy="6858000"/></p:presentation>`);
  pz.file('ppt/_rels/presentation.xml.rels', relFile([['rId1', 'slide', 'slides/slide1.xml'], ['rId2', 'slide', 'slides/slide2.xml'], ['rId3', 'slide', 'slides/slide3.xml'], ['rId4', 'theme', 'theme/theme1.xml']]));
  pz.file('ppt/theme/theme1.xml', '<?xml version="1.0"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:themeElements><a:clrScheme name="t"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="44546A"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2><a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2></a:clrScheme></a:themeElements></a:theme>');
  pz.file('ppt/slideMasters/slideMaster1.xml', `<?xml version="1.0"?><p:sldMaster ${A}><p:cSld><p:spTree/></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2"/><p:txStyles><p:titleStyle><a:lvl1pPr algn="l"><a:defRPr sz="4400" b="1"><a:solidFill><a:schemeClr val="tx2"/></a:solidFill></a:defRPr></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr marL="342900" indent="-342900"><a:buChar char="\u2022"/><a:defRPr sz="2800"/></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>`);
  pz.file('ppt/slideLayouts/slideLayout1.xml', `<?xml version="1.0"?><p:sldLayout ${A}><p:cSld><p:spTree>
    <p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="274638"/><a:ext cx="8229600" cy="1143000"/></a:xfrm></p:spPr><p:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/></p:txBody></p:sp>
    <p:sp><p:nvSpPr><p:cNvPr id="3" name="Body"/><p:cNvSpPr/><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="1600200"/><a:ext cx="8229600" cy="2000000"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/></p:txBody></p:sp>
  </p:spTree></p:cSld></p:sldLayout>`);
  pz.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', relFile([['rId1', 'slideMaster', '../slideMasters/slideMaster1.xml']]));
  const slideRels = relFile([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'], ['rId2', 'image', '../media/image1.png']]);
  pz.file('ppt/media/image1.png', png1);
  pz.file('ppt/slides/slide1.xml', `<?xml version="1.0"?><p:sld ${A}><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFF8E7"/></a:solidFill></p:bgPr></p:bg><p:spTree>
    <p:sp><p:nvSpPr><p:cNvPr id="2" name="Title 1"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>Quarterly Review</a:t></a:r></a:p></p:txBody></p:sp>
    <p:sp><p:nvSpPr><p:cNvPr id="3" name="Content 2"/><p:cNvSpPr/><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>First point</a:t></a:r></a:p><a:p><a:r><a:t>Second point</a:t></a:r></a:p></p:txBody></p:sp>
    <p:sp><p:nvSpPr><p:cNvPr id="4" name="Box"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="4000000"/><a:ext cx="2743200" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></p:spPr><p:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr sz="2000"><a:solidFill><a:schemeClr val="bg1"/></a:solidFill></a:rPr><a:t>Box label</a:t></a:r></a:p></p:txBody></p:sp>
    <p:grpSp><p:nvGrpSpPr><p:cNvPr id="5" name="Group"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="4572000" y="4000000"/><a:ext cx="2000000" cy="1000000"/><a:chOff x="0" y="0"/><a:chExt cx="1000000" cy="500000"/></a:xfrm></p:grpSpPr>
      <p:sp><p:nvSpPr><p:cNvPr id="6" name="Inner"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1000000" cy="500000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="1600"/><a:t>Grouped text</a:t></a:r></a:p></p:txBody></p:sp></p:grpSp>
    <p:pic><p:nvPicPr><p:cNvPr id="7" name="Pic"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/></p:blipFill><p:spPr><a:xfrm><a:off x="7000000" y="4000000"/><a:ext cx="1000000" cy="1000000"/></a:xfrm></p:spPr></p:pic>
    <p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="8" name="Table"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="457200" y="5200000"/><a:ext cx="6000000" cy="800000"/></p:xfrm><a:graphic><a:graphicData><a:tbl><a:tblPr firstRow="1"/><a:tblGrid><a:gridCol w="3000000"/><a:gridCol w="3000000"/></a:tblGrid>
      <a:tr h="400000"><a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:t>Cell H1</a:t></a:r></a:p></a:txBody></a:tc><a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:t>Cell H2</a:t></a:r></a:p></a:txBody></a:tc></a:tr>
      <a:tr h="400000"><a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:t>Cell A1</a:t></a:r></a:p></a:txBody></a:tc><a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:t>Cell A2</a:t></a:r></a:p></a:txBody></a:tc></a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame>
  </p:spTree></p:cSld></p:sld>`);
  pz.file('ppt/slides/_rels/slide1.xml.rels', slideRels);
  pz.file('ppt/slides/slide2.xml', `<?xml version="1.0"?><p:sld ${A}><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Second slide title</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`);
  pz.file('ppt/slides/_rels/slide2.xml.rels', relFile([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml']]));
  pz.file('ppt/slides/slide3.xml', `<?xml version="1.0"?><p:sld ${A} show="0"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="T"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Hidden slide text</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`);
  pz.file('ppt/slides/_rels/slide3.xml.rels', relFile([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml']]));
  const pptx = await pz.generateAsync({ type: 'uint8array' });
  if (process.env.DUMP_PPTX) require('fs').writeFileSync(process.env.DUMP_PPTX, pptx);
  r = await run('pptx-to-pdf', { files: [pf('deck.pptx', pptx)] });

  // read positions back with pdf.js
  const pdoc = await pdfjs.getDocument({ data: r.files![0].bytes.slice(), isEvalSupported: false, disableFontFace: true, standardFontDataUrl: FONT_DIR, verbosity: 0 }).promise;
  const slideItems = async (n: number) => {
    const pg = await pdoc.getPage(n);
    const vp = pg.getViewport({ scale: 1 });
    const tc = await pg.getTextContent();
    return { w: vp.width, h: vp.height, items: (tc.items as any[]).filter((i) => i.str.trim()).map((i) => { const t = pdfjs.Util.transform(vp.transform, i.transform); return { s: i.str as string, x: t[4] as number, y: t[5] as number, size: Math.hypot(t[2], t[3]) }; }) };
  };
  const s1 = await slideItems(1);
  const at = (items: { s: string; x: number; y: number; size: number }[], word: string) => items.find((i) => i.s.includes(word));
  check('pptx: one page per slide, the hidden slide left out', pdoc.numPages === 2 && !all(await pdfPages(r.files![0].bytes)).includes('Hidden slide text'), `${pdoc.numPages} pages`);
  check('pptx: the page has the slide size (10 x 7.5 inches = 720 x 540 pt)', Math.abs(s1.w - 720) < 0.5 && Math.abs(s1.h - 540) < 0.5, `${s1.w} x ${s1.h}`);
  const title = at(s1.items, 'Quarterly Review')!;
  check('pptx: a title with no position of its own takes it from the layout (near the top, left margin)', !!title && title.y < 130 && Math.abs(title.x - 36 - 7.2) < 6, title ? `x=${title.x.toFixed(1)} y=${title.y.toFixed(1)}` : 'missing');
  check('pptx: the title takes its size from the master (44 pt)', !!title && Math.abs(title.size - 44) < 1.5, title ? title.size.toFixed(1) : '');
  const p1 = at(s1.items, 'First point')!, p2 = at(s1.items, 'Second point')!;
  check('pptx: body paragraphs come out in order, below the title, with a bullet', !!p1 && !!p2 && p2.y > p1.y && p1.y > title.y && s1.items.some((i) => i.s.includes('\u2022')), p1 ? `y=${p1.y.toFixed(0)}/${p2?.y.toFixed(0)}` : '');
  const box = at(s1.items, 'Box label')!;
  check('pptx: text in a filled rectangle is centred in it', !!box && box.x > 36 && box.x < 36 + 216 && box.y > 4000000 / 12700 && box.y < (4000000 + 914400) / 12700 + 20, box ? `x=${box.x.toFixed(0)} y=${box.y.toFixed(0)}` : '');
  const grouped = at(s1.items, 'Grouped text')!;
  // the group is drawn at x = 4572000 EMU = 360 pt; child offset 0 plus a 7.2 pt inset
  check('pptx: shapes inside a group follow the group position', !!grouped && Math.abs(grouped.x - (360 + 7.2 * 2)) < 8, grouped ? `x=${grouped.x.toFixed(1)}` : '');
  check('pptx: table cells are drawn', ['Cell H1', 'Cell H2', 'Cell A1', 'Cell A2'].every((c) => !!at(s1.items, c)));
  const ops = Buffer.from((await PDFDocument.load(r.files![0].bytes)).getPage(0).node.Contents() ? await (async () => { const d = await PDFDocument.load(r.files![0].bytes); const c: any = d.getPage(0).node.Contents(); const streams = c.size ? Array.from({ length: c.size() }, (_: unknown, i: number) => d.context.lookup(c.get(i))) : [c]; return Buffer.concat(streams.map((x: any) => Buffer.from((nodeRequire('pdf-lib') as any).decodePDFRawStream(x).decode()))); })() : '').toString('latin1');
  const rgs = [...ops.matchAll(/(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) rg/g)].map((m) => [Number(m[1]), Number(m[2]), Number(m[3])]);
  const near = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]) < 0.02);
  check('pptx: a theme colour (accent 1) is resolved for the rectangle fill', rgs.some((c) => near(c, [0x44 / 255, 0x72 / 255, 0xc4 / 255])));
  check('pptx: the slide background colour is drawn', rgs.some((c) => near(c, [1, 0xf8 / 255, 0xe7 / 255])));
  check('pptx: the picture is placed on the slide', Buffer.from(ops).includes(' Do'), '');
  const s2 = await slideItems(2);
  check('pptx: the second slide has its own title', !!at(s2.items, 'Second slide title'));
  check('pptx: the notes say what is not reproduced', (r.notes || []).join(' ').includes('Charts'));
  check('pptx: a file that is not a PowerPoint file is refused clearly', (await throws(() => run('pptx-to-pdf', { files: [pf('x.pptx', new TextEncoder().encode('nope'))] }))) instanceof ToolError);
  const notPptx = await new JSZip().file('a.txt', 'hi').generateAsync({ type: 'uint8array' });
  check('pptx: a zip with no presentation is refused clearly', (await throws(() => run('pptx-to-pdf', { files: [pf('x.pptx', notPptx)] }))) instanceof ToolError);

  void PDFDocument; void StandardFonts;
  console.log(`\n${pass} passed, ${fail} failed.`);
  if (fail) {
    console.log('\nFailures:\n - ' + failures.join('\n - '));
    process.exit(1);
  }
})().catch((e) => {
  console.error('TEST CRASH', e);
  process.exit(2);
});
