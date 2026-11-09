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

(globalThis as any).DOMParser = XmlDOMParser;
const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!/polyfill|fetchStandardFontData/.test(String(a[0]))) warn(...a); }; // pdf.js chatter in Node
const nodeRequire = eval('require') as NodeRequire;
const pdfjs = nodeRequire('pdfjs-dist/legacy/build/pdf.js');
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
