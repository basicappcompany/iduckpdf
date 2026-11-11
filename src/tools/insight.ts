import type { ToolDef } from '../engine/types';
import { ToolError, baseName, needOne } from '../engine/util';
import { textByPage } from '../engine/render';
import { askAI, buildContext } from '../lib/ai';

function lcsDiff(a: string[], b: string[]): { t: ' ' | '-' | '+'; s: string }[] {
  const n = a.length;
  const m = b.length;
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: { t: ' ' | '-' | '+'; s: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ t: ' ', s: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ t: '-', s: a[i++] });
    else out.push({ t: '+', s: b[j++] });
  }
  while (i < n) out.push({ t: '-', s: a[i++] });
  while (j < m) out.push({ t: '+', s: b[j++] });
  return out;
}

const AI_WARN = 'Text from your PDF is sent straight to the AI provider you chose in Settings, using your own API key. It does not pass through iDuckPDF’s servers.';

export const insightTools: ToolDef[] = [
  {
    id: 'compare',
    name: 'Spot the differences',
    short: 'Compare the text of two PDFs.',
    desc: 'Pick an old and a new version of a document and get a page-by-page list of lines that were removed or added.',
    category: 'insight',
    icon: '🆚',
    keywords: ['diff', 'compare', 'difference', 'versions', 'changes', 'redline', 'what changed'],
    inputs: [
      { key: 'a', label: 'Original version', accept: 'pdf' },
      { key: 'b', label: 'New version', accept: 'pdf' },
    ],
    runLabel: 'Compare now',
    tips: ['Compares text only. Layout and image changes are not detected.'],
    status: 'ready',
    async run({ files, progress }) {
      const fa = needOne(files.a, 'the original PDF');
      const fb = needOne(files.b, 'the new PDF');
      const pa = await textByPage(await fa.bytes(), (i, n) => progress((i / n) * 0.5));
      const pb = await textByPage(await fb.bytes(), (i, n) => progress(0.5 + (i / n) * 0.5));
      const n = Math.max(pa.length, pb.length);
      const lines = (s?: string) => (s || '').split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 1200);
      const out: string[] = [`Original: ${fa.name} (${pa.length} pages)`, `New:      ${fb.name} (${pb.length} pages)`, ''];
      let changedPages = 0;
      let added = 0;
      let removed = 0;
      for (let i = 0; i < n; i++) {
        const diff = lcsDiff(lines(pa[i]), lines(pb[i])).filter((d) => d.t !== ' ');
        if (!diff.length) continue;
        changedPages++;
        out.push(`=== Page ${i + 1} ===`);
        for (const d of diff) {
          out.push(`${d.t} ${d.s}`);
          d.t === '+' ? added++ : removed++;
        }
        out.push('');
      }
      if (!changedPages) return { notes: ['No differences in text were found.'] };
      out.push(`Summary: ${changedPages} page${changedPages === 1 ? '' : 's'} changed, ${added} line${added === 1 ? '' : 's'} added, ${removed} removed.`);
      return { text: out.join('\n'), textName: 'comparison.txt', notes: [`${changedPages} page${changedPages === 1 ? ' differs' : 's differ'}.`] };
    },
  },
  {
    id: 'summarize',
    name: 'Summarise with AI',
    short: 'A short summary of a long PDF (your own AI key).',
    desc: 'Get the gist of a long document in seconds. You bring your own API key from OpenAI, Anthropic or Google, set once in Settings.',
    category: 'insight',
    icon: '✨',
    keywords: ['summary', 'summarize', 'tldr', 'ai', 'gist', 'key points', 'abstract'],
    inputs: [{ key: 'files', label: 'PDF', accept: 'pdf' }],
    options: [
      { key: 'length', type: 'select', label: 'Length', default: 'medium', options: [{ value: 'short', label: 'Short (3–5 bullets)' }, { value: 'medium', label: 'Medium' }, { value: 'long', label: 'Detailed' }] },
      { key: 'lang', type: 'text', label: 'Answer language (blank = same as document)' },
    ],
    warn: AI_WARN,
    runLabel: 'Summarise',
    status: 'ready',
    async run({ files, opts, progress }) {
      const f = needOne(files.files);
      const pages = await textByPage(await f.bytes(), (i, n) => progress((i / n) * 0.6));
      const { text, truncated } = buildContext(pages);
      if (!text.trim()) throw new ToolError('This PDF has no selectable text, so there is nothing to summarise. Scans have no text layer: run them through Read scans (OCR) first.');
      const len = { short: 'Write 3 to 5 short bullet points.', medium: 'Write a clear summary of about 150 to 250 words, then list the key points as bullets.', long: 'Write a detailed structured summary with headings and bullet points.' }[opts.length as string];
      progress(0.7, 'Asking the AI…');
      const ans = await askAI(
        'You summarise documents faithfully. Never invent facts that are not in the document.',
        `${len}${opts.lang ? ` Answer in ${opts.lang}.` : ''}\n\nDocument:\n${text}`,
      );
      return { text: ans, textName: `${baseName(f.name)}-summary.txt`, notes: truncated ? ['The document was long, so only the first part was summarised.'] : undefined };
    },
  },
  {
    id: 'ask',
    name: 'Ask your PDF',
    short: 'Ask a question, get an answer with page references.',
    desc: 'Ask anything about a document and get an answer that points to the pages it came from. Uses your own AI key from Settings.',
    category: 'insight',
    icon: '💬',
    keywords: ['chat', 'question', 'ask', 'ai', 'q&a', 'find', 'search document', 'explain'],
    inputs: [{ key: 'files', label: 'PDF', accept: 'pdf' }],
    options: [{ key: 'q', type: 'textarea', label: 'Your question', placeholder: 'e.g. What is the notice period in this contract?' }],
    warn: AI_WARN,
    runLabel: 'Ask',
    status: 'ready',
    async run({ files, opts, progress }) {
      const f = needOne(files.files);
      const q = String(opts.q || '').trim();
      if (!q) throw new ToolError('Type your question first.');
      const pages = await textByPage(await f.bytes(), (i, n) => progress((i / n) * 0.6));
      const { text, truncated } = buildContext(pages);
      if (!text.trim()) throw new ToolError('This PDF has no selectable text to search.');
      progress(0.7, 'Asking the AI…');
      const ans = await askAI(
        'Answer only from the document provided. Cite page numbers like (p. 3). If the answer is not in the document, say so plainly.',
        `Question: ${q}\n\nDocument:\n${text}`,
      );
      return { text: ans, textName: `${baseName(f.name)}-answer.txt`, notes: truncated ? ['The document was long, so only the first part was searched.'] : undefined };
    },
  },
];
