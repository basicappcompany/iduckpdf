import type { ToolDef } from '../engine/types';

const soon = (t: Pick<ToolDef, 'id' | 'name' | 'short' | 'desc' | 'icon' | 'keywords' | 'phase' | 'reason'>): ToolDef => ({
  ...t,
  category: 'soon',
  inputs: [],
  status: 'soon',
});

export const soonTools: ToolDef[] = [
  soon({ id: 'pdf-to-word', name: 'PDF to Word', short: 'Get an editable .docx from a PDF.', desc: 'Convert a PDF into an editable Word document.', icon: '📝', keywords: ['word', 'docx', 'editable', 'convert to word'], phase: 3, reason: 'Needs server-side layout analysis. Planned with a clear notice that files are sent to be converted.' }),
  soon({ id: 'pptx-to-pdf', name: 'PowerPoint to PDF', short: 'Slides to PDF.', desc: 'Turn .pptx presentations into PDFs.', icon: '📽️', keywords: ['powerpoint', 'pptx', 'slides', 'presentation'], phase: 3, reason: 'Needs a presentation renderer, so it would run on a server.' }),
];
