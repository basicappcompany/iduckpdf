/**
 * A minimal, valid .docx writer (a zip of XML): headings, paragraphs with bold/italic/size, indented list items, simple tables
 * and page breaks, with the page size taken from the source PDF. No library: the format is small enough to write directly.
 */
import JSZip from 'jszip';

export type DocPara = { kind: 'p'; text: string; style?: 'Normal' | 'Heading1' | 'Heading2' | 'Heading3'; bold?: boolean; italic?: boolean; size?: number; list?: boolean };
export type DocTable = { kind: 'table'; rows: string[][] };
export type DocBreak = { kind: 'pagebreak' };
export type DocBlock = DocPara | DocTable | DocBreak;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!)).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, '');

const runXml = (text: string, o: { bold?: boolean; italic?: boolean; size?: number }) =>
  `<w:r><w:rPr>${o.bold ? '<w:b/>' : ''}${o.italic ? '<w:i/>' : ''}${o.size ? `<w:sz w:val="${Math.round(o.size * 2)}"/><w:szCs w:val="${Math.round(o.size * 2)}"/>` : ''}</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;

export async function writeDocx(blocks: DocBlock[], page: { width: number; height: number }, title = ''): Promise<Uint8Array> {
  const W = Math.round(page.width * 20);
  const H = Math.round(page.height * 20);
  const margin = 1134; // 2 cm
  const usable = Math.max(2000, W - margin * 2);
  const body = blocks.map((b) => {
    if (b.kind === 'pagebreak') return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    if (b.kind === 'p') {
      const style = b.style && b.style !== 'Normal' ? `<w:pStyle w:val="${b.style}"/>` : '';
      const ind = b.list ? '<w:ind w:left="540" w:hanging="360"/>' : '';
      return `<w:p><w:pPr>${style}${ind}</w:pPr>${runXml(b.text, b)}</w:p>`;
    }
    const cols = Math.max(1, ...b.rows.map((r) => r.length));
    const cw = Math.floor(usable / cols);
    const border = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((e) => `<w:${e} w:val="single" w:sz="4" w:space="0" w:color="999999"/>`).join('');
    return `<w:tbl><w:tblPr><w:tblW w:w="${cw * cols}" w:type="dxa"/><w:tblBorders>${border}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${Array.from({ length: cols }, () => `<w:gridCol w:w="${cw}"/>`).join('')}</w:tblGrid>` +
      b.rows.map((r) => `<w:tr>${Array.from({ length: cols }, (_, i) => `<w:tc><w:tcPr><w:tcW w:w="${cw}" w:type="dxa"/></w:tcPr><w:p>${r[i] ? runXml(r[i], {}) : ''}</w:p></w:tc>`).join('')}</w:tr>`).join('') + '</w:tbl><w:p/>';
  }).join('');
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const z = new JSZip();
  z.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>');
  z.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>');
  z.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(title)}</dc:title><dc:creator>iDuckPDF</dc:creator></cp:coreProperties>`);
  z.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
  z.file('word/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>` +
    `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>` +
    [['Heading1', 40, 'heading 1', 360], ['Heading2', 32, 'heading 2', 280], ['Heading3', 26, 'heading 3', 200]].map(([id, sz, name, before]) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="${before}" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr></w:style>`).join('') + '</w:styles>');
  z.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body}<w:sectPr><w:pgSz w:w="${W}" w:h="${H}"/><w:pgMar w:top="${margin}" w:right="${margin}" w:bottom="${margin}" w:left="${margin}" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`);
  return z.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
