import type { ToolDef } from '../engine/types';

const soon = (t: Pick<ToolDef, 'id' | 'name' | 'short' | 'desc' | 'icon' | 'keywords' | 'phase' | 'reason'>): ToolDef => ({
  ...t,
  category: 'soon',
  inputs: [],
  status: 'soon',
});

export const soonTools: ToolDef[] = [
  soon({ id: 'ocr', name: 'Read scans (OCR)', short: 'Make scanned pages searchable and copyable.', desc: 'Recognise text in scanned PDFs and photos.', icon: '👁️', keywords: ['ocr', 'scan', 'recognise', 'searchable', 'image to text'], phase: 2, reason: 'Needs an in-browser OCR engine and language packs, which are large downloads.' }),
  soon({ id: 'word-to-pdf', name: 'Word to PDF', short: 'Convert .docx documents to PDF.', desc: 'Turn Word documents into PDFs with layout preserved.', icon: '📄', keywords: ['word', 'docx', 'doc', 'microsoft'], phase: 3, reason: 'Accurate conversion needs a document engine that does not run well in a browser. It would run on a server, and we would tell you clearly when a file leaves your device.' }),
  soon({ id: 'pdf-to-word', name: 'PDF to Word', short: 'Get an editable .docx from a PDF.', desc: 'Convert a PDF into an editable Word document.', icon: '📝', keywords: ['word', 'docx', 'editable', 'convert to word'], phase: 3, reason: 'Needs server-side layout analysis. Planned with a clear notice that files are sent to be converted.' }),
  soon({ id: 'excel-to-pdf', name: 'Excel to PDF', short: 'Spreadsheets to tidy PDFs.', desc: 'Convert .xlsx and .csv files into PDFs.', icon: '📊', keywords: ['excel', 'xlsx', 'csv', 'spreadsheet'], phase: 3, reason: 'Needs a spreadsheet layout engine, so it would run on a server.' }),
  soon({ id: 'pdf-to-excel', name: 'PDF to Excel', short: 'Pull tables out into a spreadsheet.', desc: 'Extract tables from a PDF into .xlsx.', icon: '📈', keywords: ['table', 'excel', 'xlsx', 'extract table'], phase: 3, reason: 'Table detection is hard to do reliably in the browser. Planned on a server.' }),
  soon({ id: 'pptx-to-pdf', name: 'PowerPoint to PDF', short: 'Slides to PDF.', desc: 'Turn .pptx presentations into PDFs.', icon: '📽️', keywords: ['powerpoint', 'pptx', 'slides', 'presentation'], phase: 3, reason: 'Needs a presentation renderer, so it would run on a server.' }),
  soon({ id: 'html-to-pdf', name: 'Web page to PDF', short: 'Turn HTML or a web page into a PDF.', desc: 'Print HTML into a PDF with styling intact.', icon: '🌐', keywords: ['html', 'web page', 'website', 'print'], phase: 3, reason: 'Needs a full browser engine to lay out pages, so it would run on a server.' }),
];
