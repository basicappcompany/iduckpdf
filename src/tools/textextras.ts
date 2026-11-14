import { StandardFonts } from 'pdf-lib';
import type { ToolDef } from '../engine/types';
import { MM, ToolError, baseName, loadDoc, needOne, parsePages, pdfOut, safeText, save } from '../engine/util';
import { colorOf } from '../engine/util';
import { openPdfjs, textByPage } from '../engine/render';
import { buildLines, pagePieces } from '../engine/pdftext';
import { colorOptions, place, positions } from './markup';

const SCAN_TIP = 'A scanned PDF is really a picture, so it has no text to copy. Run it through Read scans (OCR) first.';

const STOP_WORDS = new Set('the and for are but not you all any can had her was one our out has his how its may new now old see two way who did let put say she too use of to in is it be as at by on or an if we do so no up he me my us am'.split(' '));

/** Counts for one block of text. Words are runs of letters or digits (with inner apostrophes and hyphens), so "don't" and "e-mail" are one word each. */
export function countText(text: string) {
  const words = text.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) || [];
  const sentences = (text.match(/[^.!?…]+[.!?…]+(?:\s|$)/g) || []).length;
  return { words, chars: text.length, charsNoSpaces: text.replace(/\s/g, '').length, sentences, paragraphs: text.split(/\n\s*\n/).filter((p) => p.trim()).length };
}

export const textExtraTools: ToolDef[] = [
  {
    id: 'word-count',
    name: 'Count the words',
    short: 'Words, characters and reading time.',
    desc: 'Count the words, characters, sentences and pages in a PDF, with an estimated reading time and the most common words.',
    category: 'insight',
    icon: '🧮',
    keywords: ['word count', 'count words', 'characters', 'reading time', 'how many words', 'statistics', 'word counter'],
    inputs: [{ key: 'files', label: 'PDF', accept: 'pdf' }],
    options: [{ key: 'pages', type: 'text', label: 'Pages (blank = all)' }],
    runLabel: 'Count now',
    tips: [SCAN_TIP],
    status: 'ready',
    async run({ files, opts, progress }) {
      const f = needOne(files.files);
      const pages = await textByPage(await f.bytes(), (i, n) => progress(i / n));
      const idx = parsePages(opts.pages, pages.length);
      const text = idx.map((i) => pages[i]).join('\n\n');
      const c = countText(text);
      if (!c.words.length) return { notes: ['No selectable text was found. This PDF is probably a scan.'] };
      const freq = new Map<string, number>();
      for (const w of c.words) {
        const k = w.toLowerCase();
        if (k.length > 2 && !STOP_WORDS.has(k) && !/^\d+$/.test(k)) freq.set(k, (freq.get(k) || 0) + 1);
      }
      const top = [...freq].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10);
      const minutes = c.words.length / 238; // typical silent reading speed for adults
      const lines = [
        `File: ${f.name}`,
        `Pages counted: ${idx.length} of ${pages.length}`,
        `Words: ${c.words.length.toLocaleString()}`,
        `Characters (with spaces): ${c.chars.toLocaleString()}`,
        `Characters (without spaces): ${c.charsNoSpaces.toLocaleString()}`,
        `Sentences: ${c.sentences.toLocaleString()}`,
        `Paragraphs: ${c.paragraphs.toLocaleString()}`,
        `Words per page (average): ${Math.round(c.words.length / idx.length).toLocaleString()}`,
        `Estimated reading time: ${minutes < 1 ? 'under a minute' : `${Math.round(minutes)} min`} (at about 238 words per minute)`,
        '',
        'Most common words:',
        ...top.map(([w, n]) => `  ${w}: ${n}`),
      ];
      return { text: lines.join('\n'), textName: `${baseName(f.name)}-word-count.txt`, notes: [`${c.words.length.toLocaleString()} words on ${idx.length} page${idx.length === 1 ? '' : 's'}.`] };
    },
  },
  {
    id: 'bates',
    name: 'Bates numbering',
    short: 'Stamp a running ID on every page.',
    desc: 'Stamp every page with a running prefix and number (for example CASE-000123), the way legal and audit teams label documents.',
    category: 'markup',
    icon: '🏷️',
    keywords: ['bates', 'bates numbering', 'bates stamp', 'legal', 'discovery', 'document id', 'running number', 'prefix'],
    inputs: [{ key: 'files', label: 'PDF', accept: 'pdf' }],
    options: [
      { key: 'prefix', type: 'text', label: 'Prefix', default: 'CASE-', placeholder: 'e.g. CASE-' },
      { key: 'start', type: 'number', label: 'First number', default: 1 },
      { key: 'digits', type: 'number', label: 'Digits (zero padding)', default: 6 },
      { key: 'pos', type: 'select', label: 'Position', default: 'br', options: positions },
      { key: 'size', type: 'number', label: 'Font size', default: 10 },
      { key: 'color', type: 'select', label: 'Colour', default: 'black', options: colorOptions },
      { key: 'pages', type: 'text', label: 'Only these pages (blank = all)', placeholder: 'e.g. 2-last' },
    ],
    runLabel: 'Add numbers',
    status: 'ready',
    async run({ files, opts }) {
      const f = needOne(files.files);
      const doc = await loadDoc(f);
      const font = await doc.embedFont(StandardFonts.Courier);
      const idx = parsePages(opts.pages, doc.getPageCount());
      const size = Math.max(4, Number(opts.size) || 10);
      const digits = Math.min(12, Math.max(1, Math.floor(Number(opts.digits) || 6)));
      const start = Math.floor(Number(opts.start));
      if (!Number.isFinite(start) || start < 0) throw new ToolError('The first number must be 0 or more.');
      const prefix = String(opts.prefix ?? '');
      let first = '';
      let last = '';
      idx.forEach((i, k) => {
        const p = doc.getPage(i);
        const { width, height } = p.getSize();
        const label = safeText(font, `${prefix}${String(start + k).padStart(digits, '0')}`);
        if (!k) first = label;
        last = label;
        const w = font.widthOfTextAtSize(label, size);
        const { x, y } = place(String(opts.pos || 'br'), width, height, w, size, 10 * MM);
        p.drawText(label, { x, y, size, font, color: colorOf(String(opts.color || 'black')) });
      });
      return { files: [pdfOut(`${baseName(f.name)}-bates.pdf`, await save(doc))], notes: [`Stamped ${idx.length} page${idx.length === 1 ? '' : 's'}: ${first} to ${last}.`] };
    },
  },
  {
    id: 'pdf-to-markdown',
    name: 'PDF to Markdown',
    short: 'Turn a PDF into Markdown text.',
    desc: 'Convert the text of a PDF into Markdown with headings, lists and paragraphs, ready for notes, wikis and AI tools.',
    category: 'convert',
    icon: '⬇️',
    keywords: ['markdown', 'md', 'pdf to markdown', 'pdf to md', 'text', 'notes', 'llm', 'convert to text'],
    inputs: [{ key: 'files', label: 'PDF', accept: 'pdf' }],
    options: [{ key: 'pages', type: 'text', label: 'Pages (blank = all)' }],
    runLabel: 'Convert now',
    tips: [SCAN_TIP],
    status: 'ready',
    async run({ files, opts, progress }) {
      const f = needOne(files.files);
      const doc = await openPdfjs(await f.bytes());
      const idx = parsePages(opts.pages, doc.numPages);
      const out: string[] = [];
      let headings = 0;
      for (let k = 0; k < idx.length; k++) {
        const page = await doc.getPage(idx[k] + 1);
        const { pieces } = await pagePieces(page);
        const lines = buildLines(pieces);
        const body = (() => {
          const hs = lines.map((l) => l.h).filter((h) => h > 0).sort((a, b) => a - b);
          return hs.length ? hs[Math.floor(hs.length / 2)] : 10;
        })();
        let para: string[] = [];
        let prevY = -1e9;
        let prevH = body;
        const flush = () => {
          if (para.length) out.push(para.join(' ').replace(/(\w)- (\w)/g, '$1$2').replace(/\s+/g, ' ').trim());
          para = [];
        };
        for (const l of lines) {
          const text = l.cells.map((c) => c.text).join(' ').replace(/\s+/g, ' ').trim();
          if (!text) continue;
          const gap = l.y - prevY;
          const ratio = l.h / body;
          const short = text.length < 90;
          const level = short && ratio >= 1.9 ? 1 : short && ratio >= 1.4 ? 2 : short && (ratio >= 1.12 || (l.bold && ratio >= 0.98 && text.length < 60 && !/[.,;:]$/.test(text))) ? 3 : 0;
          const bullet = /^[•▪◦●‣∙·\-–—*]\s+/.test(text);
          const numbered = /^\(?\d{1,3}[.)]\s+\S/.test(text);
          if (level) {
            flush();
            out.push(`${'#'.repeat(level)} ${text}`);
            headings++;
          } else if (bullet || numbered) {
            flush();
            para.push(bullet ? `- ${text.replace(/^[•▪◦●‣∙·\-–—*]\s+/, '')}` : text);
            flush();
          } else {
            if (para.length && gap > Math.max(prevH, l.h) * 1.7) flush();
            para.push(text);
          }
          prevY = l.y;
          prevH = l.h;
        }
        flush();
        progress((k + 1) / idx.length);
        if (k < idx.length - 1) out.push('');
      }
      // blank line between blocks, but keep list items together
      const md = out
        .reduce<string[]>((acc, block, i) => {
          if (!block && !acc.length) return acc;
          const prev = out[i - 1];
          const tight = block.startsWith('- ') && prev && prev.startsWith('- ');
          acc.push(acc.length && !tight ? '\n' + block : block);
          return acc;
        }, [])
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      if (!md) return { notes: ['No selectable text was found. This PDF is probably a scan.'] };
      return { text: md, textName: `${baseName(f.name)}.md`, notes: [`${md.length.toLocaleString()} characters of Markdown from ${idx.length} page${idx.length === 1 ? '' : 's'}${headings ? `, ${headings} heading${headings === 1 ? '' : 's'} found` : ''}. Check the result: headings and lists are guessed from font size and position.`] };
    },
  },
];
