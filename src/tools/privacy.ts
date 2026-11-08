import { PDFDocument, PDFName } from 'pdf-lib';
import type { ToolDef } from '../engine/types';
import { PAGE_SIZES, ToolError, baseName, fmtBytes, loadDoc, needOne, parsePages, pdfOut, save } from '../engine/util';
import { canvasToBytes, getPdfjs, openPdfjs, renderPage } from '../engine/render';

function sizeLabel(w: number, h: number): string {
  const [lo, hi] = w < h ? [w, h] : [h, w];
  for (const [k, [sw, sh]] of Object.entries(PAGE_SIZES)) {
    if (Math.abs(lo - sw) < 3 && Math.abs(hi - sh) < 3) return `${k === 'letter' || k === 'legal' ? k[0].toUpperCase() + k.slice(1) : k.toUpperCase()} ${w < h ? 'portrait' : 'landscape'}`;
  }
  return `${Math.round((w / 72) * 25.4)}×${Math.round((h / 72) * 25.4)} mm`;
}

const d = (x?: Date) => (x ? x.toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '—');

export const privacyTools: ToolDef[] = [
  {
    id: 'inspect',
    name: 'Inspect a PDF',
    short: 'See what is hiding inside: metadata, size, forms.',
    desc: 'A quick report: page count and sizes, document properties, whether it has hidden metadata, annotations or form fields, and what you may want to clean before sharing.',
    category: 'privacy',
    icon: '🔬',
    keywords: ['metadata', 'info', 'properties', 'privacy check', 'author', 'details', 'audit', 'scan privacy'],
    inputs: [{ key: 'files', label: 'PDF', accept: 'pdf' }],
    runLabel: 'Inspect now',
    status: 'ready',
    async run({ files }) {
      const f = needOne(files.files);
      const bytes = await f.bytes();
      const doc = await loadDoc(f, { updateMetadata: false });
      const sizes = new Map<string, number>();
      let annots = 0;
      doc.getPages().forEach((p) => {
        const { width, height } = p.getSize();
        const k = sizeLabel(width, height);
        sizes.set(k, (sizes.get(k) || 0) + 1);
        annots += p.node.Annots()?.size() || 0;
      });
      let fields = 0;
      try {
        fields = doc.getForm().getFields().length;
      } catch {
        /* no form */
      }
      const xmp = doc.catalog.has(PDFName.of('Metadata'));
      const header = String.fromCharCode(...bytes.slice(0, 8)).replace(/[^\x20-\x7e]/g, '');
      const lines = [
        `File: ${f.name} (${fmtBytes(f.size)})`,
        `Format: ${header}`,
        `Pages: ${doc.getPageCount()}`,
        `Page sizes: ${[...sizes].map(([k, n]) => `${k} ×${n}`).join(', ')}`,
        '',
        'Document properties',
        `  Title: ${doc.getTitle() || '—'}`,
        `  Author: ${doc.getAuthor() || '—'}`,
        `  Subject: ${doc.getSubject() || '—'}`,
        `  Keywords: ${doc.getKeywords() || '—'}`,
        `  Created with: ${doc.getCreator() || '—'}`,
        `  PDF producer: ${doc.getProducer() || '—'}`,
        `  Created: ${d(doc.getCreationDate())}`,
        `  Modified: ${d(doc.getModificationDate())}`,
        '',
        `Hidden XMP metadata: ${xmp ? 'yes' : 'no'}`,
        `Annotations (comments, links…): ${annots}`,
        `Form fields: ${fields}`,
      ];
      const flags: string[] = [];
      if (doc.getAuthor()) flags.push(`The author name “${doc.getAuthor()}” is stored in the file.`);
      if (doc.getCreator() || doc.getProducer()) flags.push('The software used to create the file is recorded.');
      if (xmp) flags.push('Extra XMP metadata is embedded (it can hold more than the visible properties).');
      if (annots) flags.push(`${annots} annotation${annots === 1 ? '' : 's'} (comments, highlights or links) are present.`);
      if (fields) flags.push(`${fields} fillable form field${fields === 1 ? '' : 's'} may still hold typed answers.`);
      lines.push('', flags.length ? 'Worth cleaning before you share:' : 'Nothing notable found.', ...flags.map((x) => `  • ${x}`));
      return {
        text: lines.join('\n'),
        textName: `${baseName(f.name)}-report.txt`,
        notes: flags.length ? ['Use “Clean & edit properties” and “Flatten forms” to tidy this up.'] : undefined,
      };
    },
  },
  {
    id: 'properties',
    name: 'Clean & edit properties',
    short: 'Edit title/author, or wipe all metadata.',
    desc: 'Change a PDF’s title, author and other properties, or strip every piece of metadata before sending it on.',
    category: 'privacy',
    icon: '🧼',
    keywords: ['metadata', 'strip', 'remove author', 'anonymize', 'scrub', 'title', 'author', 'exif', 'clean'],
    inputs: [{ key: 'files', label: 'PDF', accept: 'pdf' }],
    options: [
      { key: 'strip', type: 'toggle', label: 'Remove all metadata', default: true, hint: 'Clears title, author, subject, keywords, software, dates and hidden XMP data.' },
      { key: 'title', type: 'text', label: 'Title', showIf: { key: 'strip', off: true } },
      { key: 'author', type: 'text', label: 'Author', showIf: { key: 'strip', off: true } },
      { key: 'subject', type: 'text', label: 'Subject', showIf: { key: 'strip', off: true } },
      { key: 'keywords', type: 'text', label: 'Keywords (comma-separated)', showIf: { key: 'strip', off: true } },
    ],
    runLabel: 'Apply now',
    tips: ['Blank boxes leave that property unchanged.'],
    status: 'ready',
    async run({ files, opts }) {
      const f = needOne(files.files);
      const doc = await loadDoc(f, { updateMetadata: false });
      if (opts.strip) {
        (doc.context as any).trailerInfo.Info = undefined;
        doc.catalog.delete(PDFName.of('Metadata'));
      } else {
        if (opts.title) doc.setTitle(String(opts.title));
        if (opts.author) doc.setAuthor(String(opts.author));
        if (opts.subject) doc.setSubject(String(opts.subject));
        if (opts.keywords) doc.setKeywords(String(opts.keywords).split(',').map((s) => s.trim()).filter(Boolean));
      }
      return { files: [pdfOut(`${baseName(f.name)}-${opts.strip ? 'clean' : 'edited'}.pdf`, await save(doc))], notes: [opts.strip ? 'All document metadata was removed.' : 'Properties updated.'] };
    },
  },
  {
    id: 'flatten',
    name: 'Flatten forms',
    short: 'Lock in form answers and strip comments.',
    desc: 'Turn fillable form fields into plain page content so answers can’t be edited, and optionally remove comments and highlights.',
    category: 'privacy',
    icon: '🧱',
    keywords: ['flatten', 'forms', 'fillable', 'lock', 'annotations', 'comments', 'make uneditable'],
    inputs: [{ key: 'files', label: 'PDF', accept: 'pdf' }],
    options: [
      { key: 'forms', type: 'toggle', label: 'Flatten form fields', default: true },
      { key: 'annots', type: 'toggle', label: 'Remove comments, highlights and links', default: false },
    ],
    runLabel: 'Flatten now',
    status: 'ready',
    async run({ files, opts }) {
      const f = needOne(files.files);
      const doc = await loadDoc(f);
      const notes: string[] = [];
      if (opts.forms) {
        try {
          const form = doc.getForm();
          const n = form.getFields().length;
          form.flatten();
          notes.push(n ? `Flattened ${n} form field${n === 1 ? '' : 's'}.` : 'No form fields found.');
        } catch {
          notes.push('The form fields in this file could not be flattened.');
        }
      }
      if (opts.annots) {
        let n = 0;
        doc.getPages().forEach((p) => {
          n += p.node.Annots()?.size() || 0;
          p.node.delete(PDFName.of('Annots'));
        });
        notes.push(`Removed ${n} annotation${n === 1 ? '' : 's'}.`);
      }
      return { files: [pdfOut(`${baseName(f.name)}-flattened.pdf`, await save(doc))], notes };
    },
  },
  {
    id: 'redact',
    name: 'Black out text',
    short: 'Permanently hide words, numbers or patterns.',
    desc: 'Type the words you need to hide (one per line). Pages are redrawn with black boxes over every match and saved as pictures, so the hidden text is truly gone.',
    category: 'privacy',
    icon: '⬛',
    keywords: ['redact', 'censor', 'hide', 'black out', 'sensitive', 'ssn', 'email', 'blackout', 'regex'],
    inputs: [{ key: 'files', label: 'PDF', accept: 'pdf' }],
    options: [
      { key: 'terms', type: 'textarea', label: 'Text to black out (one per line)', placeholder: 'John Smith\n555-0100' },
      { key: 'regex', type: 'toggle', label: 'Treat lines as patterns (regular expressions)', default: false },
      { key: 'matchCase', type: 'toggle', label: 'Match capitals exactly', default: false },
      { key: 'dpi', type: 'select', label: 'Quality', default: '150', options: [{ value: '110', label: 'Smaller (110 dpi)' }, { value: '150', label: 'Good (150 dpi)' }, { value: '200', label: 'Sharp (200 dpi)' }] },
    ],
    runLabel: 'Redact now',
    warn: 'Always check the result before sharing. Text split across lines, or inside images, may not be found automatically.',
    tips: ['Only PDFs with a text layer can be searched. Scans have none.', 'The result is page images, so no hidden text can be copied out of it.'],
    status: 'ready',
    async run({ files, opts, progress }) {
      const f = needOne(files.files);
      const terms = String(opts.terms || '').split('\n').map((s) => s.trim()).filter(Boolean);
      if (!terms.length) throw new ToolError('Enter at least one word or phrase to black out.');
      const flags = 'g' + (opts.matchCase ? '' : 'i');
      let regs: RegExp[];
      try {
        regs = terms.map((t) => new RegExp(opts.regex ? t : t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags));
      } catch {
        throw new ToolError('One of your patterns is not a valid regular expression.');
      }
      const lib = await getPdfjs();
      const src = await openPdfjs(await f.bytes());
      const out = await PDFDocument.create();
      const scale = Number(opts.dpi) / 72;
      let hits = 0;
      const pagesHit = new Set<number>();
      for (let i = 1; i <= src.numPages; i++) {
        const { canvas, viewport, page } = await renderPage(src, i, scale);
        const ctx = canvas.getContext('2d')!;
        const tc = await page.getTextContent();
        ctx.fillStyle = '#000';
        for (const it of tc.items as any[]) {
          const s: string = it.str;
          if (!s) continue;
          const tx = lib.Util.transform(viewport.transform, it.transform);
          const fh = Math.hypot(tx[2], tx[3]);
          const totalW = it.width * scale;
          for (const re of regs) {
            re.lastIndex = 0;
            let m: RegExpExecArray | null;
            while ((m = re.exec(s)) && m[0].length) {
              const x = tx[4] + (m.index / s.length) * totalW;
              const w = (m[0].length / s.length) * totalW;
              ctx.fillRect(x - 2, tx[5] - fh * 0.95, w + 4, fh * 1.2);
              hits++;
              pagesHit.add(i);
            }
          }
        }
        const jpg = await canvasToBytes(canvas, 'image/jpeg', 0.88);
        const img = await out.embedJpg(jpg);
        const w = viewport.width / scale;
        const h = viewport.height / scale;
        out.addPage([w, h]).drawImage(img, { x: 0, y: 0, width: w, height: h });
        progress(i / src.numPages, `Page ${i} of ${src.numPages}`);
      }
      if (!hits) return { notes: ['No matches found, so nothing was redacted. (Scans have no searchable text.)'] };
      return {
        files: [pdfOut(`${baseName(f.name)}-redacted.pdf`, await save(out))],
        notes: [`Blacked out ${hits} match${hits === 1 ? '' : 'es'} on ${pagesHit.size} page${pagesHit.size === 1 ? '' : 's'}.`, 'Open the result and check every page before you share it.'],
      };
    },
  },
];
