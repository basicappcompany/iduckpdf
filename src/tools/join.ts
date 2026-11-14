import { PDFDocument } from 'pdf-lib';
import type { OutFile, ToolDef } from '../engine/types';
import { ToolError, baseName, fmtBytes, loadDoc, needOne, parseGroups, parsePages, pdfOut, save } from '../engine/util';

export const joinTools: ToolDef[] = [
  {
    id: 'merge',
    name: 'Merge PDFs',
    short: 'Stitch several PDFs into one file.',
    desc: 'Add your PDFs, put them in the order you want, and download a single combined file.',
    category: 'join',
    icon: '🧩',
    keywords: ['combine', 'join', 'append', 'concatenate', 'stitch', 'one file'],
    inputs: [{ key: 'files', label: 'PDFs to merge', accept: 'pdf', multiple: true, min: 2, hint: 'Use the arrows to change the order.' }],
    runLabel: 'Merge now',
    tips: ['Files are joined top to bottom, exactly as listed.', 'Want to interleave pages instead? Try “Weave two PDFs”.'],
    faq: [
      { q: 'Is there a limit on how many files I can merge?', a: 'Not one we set. The practical limit is your device’s memory, so very large batches may be slow.' },
      { q: 'Will bookmarks and links survive?', a: 'Page content is kept. Bookmarks and document-level links from the originals are not carried over.' },
    ],
    status: 'ready',
    async run({ files, progress }) {
      const list = files.files;
      const out = await PDFDocument.create();
      let pages = 0;
      for (let i = 0; i < list.length; i++) {
        const src = await loadDoc(list[i]);
        const copied = await out.copyPages(src, src.getPageIndices());
        copied.forEach((p) => out.addPage(p));
        pages += copied.length;
        progress((i + 1) / list.length, `Added ${list[i].name}`);
      }
      return { files: [pdfOut('merged.pdf', await save(out))], notes: [`${list.length} files merged into ${pages} pages.`] };
    },
  },
  {
    id: 'weave',
    name: 'Weave two PDFs',
    short: 'Interleave pages, handy for double-sided scans.',
    desc: 'Alternate pages from two PDFs: A1, B1, A2, B2… Perfect when your scanner did fronts and backs separately.',
    category: 'join',
    icon: '🪢',
    keywords: ['interleave', 'alternate', 'mix', 'duplex', 'fronts', 'backs', 'double sided'],
    inputs: [
      { key: 'a', label: 'First PDF (front sides)', accept: 'pdf' },
      { key: 'b', label: 'Second PDF (back sides)', accept: 'pdf' },
    ],
    options: [{ key: 'reverseB', type: 'toggle', label: 'Second file is in reverse order', default: true, hint: 'Most sheet-fed scanners give you the backs last-to-first.' }],
    runLabel: 'Weave now',
    faq: [{ q: 'The two files have different page counts.', a: 'Pages are woven until one file runs out; the leftover pages of the longer file go at the end.' }],
    status: 'ready',
    async run({ files, opts }) {
      const a = await loadDoc(needOne(files.a, 'the first PDF'));
      const b = await loadDoc(needOne(files.b, 'the second PDF'));
      const out = await PDFDocument.create();
      const ap = await out.copyPages(a, a.getPageIndices());
      let bi = b.getPageIndices();
      if (opts.reverseB) bi = bi.reverse();
      const bp = await out.copyPages(b, bi);
      const n = Math.max(ap.length, bp.length);
      for (let i = 0; i < n; i++) {
        if (ap[i]) out.addPage(ap[i]);
        if (bp[i]) out.addPage(bp[i]);
      }
      return { files: [pdfOut('woven.pdf', await save(out))], notes: [`${ap.length + bp.length} pages woven together.`] };
    },
  },
  {
    id: 'split',
    name: 'Split a PDF',
    short: 'Cut one PDF into several, by range or size.',
    desc: 'Break a PDF into separate files: custom ranges, every N pages, or one file per page.',
    category: 'join',
    icon: '✂️',
    keywords: ['separate', 'divide', 'cut', 'chapters', 'pieces', 'ranges'],
    inputs: [{ key: 'files', label: 'PDF to split', accept: 'pdf' }],
    options: [
      {
        key: 'mode',
        type: 'select',
        label: 'How to split',
        default: 'ranges',
        options: [
          { value: 'ranges', label: 'By ranges' },
          { value: 'every', label: 'Every N pages' },
          { value: 'each', label: 'One file per page' },
          { value: 'size', label: 'By file size' },
        ],
      },
      { key: 'ranges', type: 'text', label: 'Ranges', placeholder: 'e.g. 1-3, 4, 5-', hint: 'Each comma-separated range becomes its own file.', showIf: { key: 'mode', eq: 'ranges' } },
      { key: 'n', type: 'number', label: 'Pages per file', default: 5, showIf: { key: 'mode', eq: 'every' } },
      { key: 'mb', type: 'number', label: 'Largest file size (MB)', default: 5, hint: 'Each file stays under this size when it can. One very large page may be bigger on its own.', showIf: { key: 'mode', eq: 'size' } },
    ],
    runLabel: 'Split now',
    tips: ['Several outputs? Use “Download all (ZIP)” on the results.'],
    status: 'ready',
    async run({ files, opts, progress }) {
      const f = needOne(files.files);
      const src = await loadDoc(f);
      const total = src.getPageCount();
      let groups: number[][];
      let label: (g: number[], i: number) => string;
      let sizeNotes: string[] = [];
      let prebuilt: Uint8Array[] | null = null;
      if (opts.mode === 'size') {
        const limit = Math.max(0.05, Number(opts.mb) || 5) * 1024 * 1024;
        const build = async (idx: number[]) => {
          const d = await PDFDocument.create();
          (await d.copyPages(src, idx)).forEach((p) => d.addPage(p));
          return save(d);
        };
        // estimate each page on its own (shared fonts are counted again, so this over-estimates), pack greedily, then check the real size
        const est: number[] = [];
        for (let i = 0; i < total; i++) {
          est.push((await build([i])).length);
          progress(((i + 1) / total) * 0.4);
        }
        const packed: number[][] = [];
        let cur: number[] = [];
        let sum = 0;
        for (let i = 0; i < total; i++) {
          if (cur.length && sum + est[i] > limit * 1.6) { packed.push(cur); cur = []; sum = 0; }
          cur.push(i);
          sum += est[i];
        }
        if (cur.length) packed.push(cur);
        groups = [];
        prebuilt = [];
        const fit = async (idx: number[]): Promise<void> => {
          const bytes = await build(idx);
          if (bytes.length <= limit || idx.length === 1) {
            groups.push(idx);
            prebuilt!.push(bytes);
            if (bytes.length > limit) sizeNotes.push(`Page ${idx[0] + 1} alone is ${fmtBytes(bytes.length)}, over the limit. Compress the PDF first if it must be smaller.`);
            return;
          }
          const half = Math.ceil(idx.length / 2);
          await fit(idx.slice(0, half));
          await fit(idx.slice(half));
        };
        for (let g = 0; g < packed.length; g++) {
          await fit(packed[g]);
          progress(0.4 + ((g + 1) / packed.length) * 0.6);
        }
        // merge neighbours back together while they still fit, so the parts are as few as possible
        for (let i = 0; i + 1 < groups.length; ) {
          if (prebuilt[i].length + prebuilt[i + 1].length < limit * 1.1) {
            const both = [...groups[i], ...groups[i + 1]];
            const bytes = await build(both);
            if (bytes.length <= limit) { groups.splice(i, 2, both); prebuilt.splice(i, 2, bytes); continue; }
          }
          i++;
        }
        label = (g) => (g.length === 1 ? `page-${g[0] + 1}` : `pages-${g[0] + 1}-${g[g.length - 1] + 1}`);
      } else if (opts.mode === 'each') {
        groups = src.getPageIndices().map((i) => [i]);
        label = (g) => `page-${g[0] + 1}`;
      } else if (opts.mode === 'every') {
        const n = Math.max(1, Math.floor(Number(opts.n) || 1));
        groups = [];
        for (let i = 0; i < total; i += n) groups.push(src.getPageIndices().slice(i, i + n));
        label = (g) => (g.length === 1 ? `page-${g[0] + 1}` : `pages-${g[0] + 1}-${g[g.length - 1] + 1}`);
      } else {
        groups = parseGroups(String(opts.ranges || ''), total);
        label = (g, i) => `part-${i + 1}`;
      }
      if (groups.length > 400) throw new ToolError('That would create more than 400 files. Pick bigger chunks.');
      const out: OutFile[] = [];
      if (prebuilt) {
        groups.forEach((g, i) => out.push(pdfOut(`${baseName(f.name)}-${label(g, i)}.pdf`, prebuilt![i])));
        return { files: out, notes: [`Created ${out.length} file${out.length === 1 ? '' : 's'} from ${total} pages, each under ${opts.mb || 5} MB.`, ...sizeNotes] };
      }
      for (let i = 0; i < groups.length; i++) {
        const d = await PDFDocument.create();
        (await d.copyPages(src, groups[i])).forEach((p) => d.addPage(p));
        out.push(pdfOut(`${baseName(f.name)}-${label(groups[i], i)}.pdf`, await save(d)));
        progress((i + 1) / groups.length);
      }
      return { files: out, notes: [`Created ${out.length} file${out.length === 1 ? '' : 's'} from ${total} pages.`] };
    },
  },
  {
    id: 'extract-pages',
    name: 'Pull out pages',
    short: 'Keep only the pages you pick.',
    desc: 'Type the pages you want and get a new PDF containing just those, in the order you typed them.',
    category: 'join',
    icon: '🧲',
    keywords: ['extract', 'keep', 'select', 'subset', 'pick pages'],
    inputs: [{ key: 'files', label: 'PDF', accept: 'pdf' }],
    options: [{ key: 'pages', type: 'text', label: 'Pages to keep', placeholder: 'e.g. 2, 4-6, last', hint: 'Also works: odd, even, first, last.' }],
    runLabel: 'Extract now',
    status: 'ready',
    async run({ files, opts }) {
      const f = needOne(files.files);
      const src = await loadDoc(f);
      const idx = parsePages(opts.pages, src.getPageCount(), { blank: 'error', unique: false });
      const out = await PDFDocument.create();
      (await out.copyPages(src, idx)).forEach((p) => out.addPage(p));
      return { files: [pdfOut(`${baseName(f.name)}-selected.pdf`, await save(out))], notes: [`Kept ${idx.length} of ${src.getPageCount()} pages.`] };
    },
  },
  {
    id: 'remove-pages',
    name: 'Delete pages',
    short: 'Drop the pages you do not need.',
    desc: 'List the pages to throw away and download what is left.',
    category: 'join',
    icon: '🗑️',
    keywords: ['remove', 'delete', 'discard', 'drop', 'get rid'],
    inputs: [{ key: 'files', label: 'PDF', accept: 'pdf' }],
    options: [{ key: 'pages', type: 'text', label: 'Pages to delete', placeholder: 'e.g. 2, 5-7', hint: 'Also works: odd, even, last.' }],
    runLabel: 'Delete now',
    status: 'ready',
    async run({ files, opts }) {
      const f = needOne(files.files);
      const doc = await loadDoc(f);
      const total = doc.getPageCount();
      const drop = parsePages(opts.pages, total, { blank: 'error' });
      if (drop.length >= total) throw new ToolError('That would delete every page. Leave at least one.');
      [...drop].sort((a, b) => b - a).forEach((i) => doc.removePage(i));
      return { files: [pdfOut(`${baseName(f.name)}-trimmed.pdf`, await save(doc))], notes: [`Deleted ${drop.length} page${drop.length === 1 ? '' : 's'}; ${doc.getPageCount()} remain.`] };
    },
  },
];
