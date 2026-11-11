/**
 * Tests for the AI tools (Translate a PDF, Flashcards and quiz, Pull data into Excel) and their helpers. They run in Node with a
 * FAKE AI provider: fetch is replaced, so no key, network or money is involved. The fake also records every request, which lets the
 * tests check where the text goes (only to the provider the user chose, with the user's key) and what is sent.
 * Run:  npx tsx scripts/test-ai.ts
 */
import { DOMParser as XmlDOMParser } from '@xmldom/xmldom';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { ALL_TOOLS } from '../src/tools/all';
import type { PickedFile, ToolResult } from '../src/engine/types';
import { ToolError } from '../src/engine/util';
import { chunkPages, extractJson, parseCards, parseQuiz, parseTable, toCsv } from '../src/engine/aitext';
import { readXlsx } from '../src/engine/xlsx';
import { clearAi, saveAi } from '../src/lib/ai';

(globalThis as any).DOMParser = XmlDOMParser; // the XLSX reader uses the browser's XML parser
const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!/polyfill|fetchStandardFontData/.test(String(a[0]))) warn(...a); };
const nodeRequire = eval('require') as NodeRequire;
const pdfjs = nodeRequire('pdfjs-dist/legacy/build/pdf.js');
const FONT_DIR = nodeRequire('path').join(process.cwd(), 'node_modules', 'pdfjs-dist', 'standard_fonts') + '/';
(globalThis as any).window = { pdfjsLib: pdfjs };

const byId = (id: string) => ALL_TOOLS.find((t) => t.id === id)!;
const pf = (name: string, bytes: Uint8Array, type = 'application/pdf'): PickedFile => ({ name, size: bytes.length, type, bytes: async () => bytes });
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

// ---- the fake provider ----
type Req = { url: string; headers: Record<string, string>; body: any; system: string; prompt: string };
let calls: Req[] = [];
let reply: (r: Req, n: number) => string | { status: number; message: string } = () => '';
(globalThis as any).fetch = async (url: string, init: any) => {
  const body = JSON.parse(init.body);
  const system = body.messages?.[0]?.role === 'system' ? body.messages[0].content : body.system || body.systemInstruction?.parts?.[0]?.text || '';
  const prompt = body.messages ? body.messages[body.messages.length - 1].content : body.contents?.[0]?.parts?.[0]?.text || '';
  const r: Req = { url, headers: init.headers, body, system, prompt };
  calls.push(r);
  const out = reply(r, calls.length);
  if (typeof out !== 'string') return { ok: false, status: out.status, json: async () => ({ error: { message: out.message } }) };
  const shape = url.includes('openai') ? { choices: [{ message: { content: out } }] } : url.includes('anthropic') ? { content: [{ text: out }] } : { candidates: [{ content: { parts: [{ text: out }] } }] };
  return { ok: true, status: 200, json: async () => shape };
};
const useProvider = (provider: 'openai' | 'anthropic' | 'gemini' = 'openai') => saveAi({ provider, key: 'sk-test-123', model: 'test-model' });

async function textPdf(pages: string[]): Promise<Uint8Array> {
  const d = await PDFDocument.create();
  const f = await d.embedFont(StandardFonts.Helvetica);
  for (const t of pages) {
    const p = d.addPage([400, 500]);
    t.split('\n').forEach((line, i) => p.drawText(line, { x: 30, y: 450 - i * 16, size: 11, font: f }));
  }
  return d.save();
}
async function pdfText(bytes: Uint8Array): Promise<string> {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, disableFontFace: true, standardFontDataUrl: FONT_DIR, verbosity: 0 }).promise;
  let s = '';
  for (let i = 1; i <= doc.numPages; i++) s += (await (await doc.getPage(i)).getTextContent()).items.map((it: any) => it.str).join(' ') + ' ';
  return s.replace(/\s+/g, ' ');
}
const dec = (b: Uint8Array) => new TextDecoder().decode(b);

(async () => {
  // ================= helpers =================
  check('chunkPages: short pages are grouped under one request, each with its marker', (() => {
    const c = chunkPages(['aaa', 'bbb', 'ccc'], [0, 1, 2], 1000);
    return c.length === 1 && c[0].text === '=== Page 1 ===\naaa\n\n=== Page 2 ===\nbbb\n\n=== Page 3 ===\nccc' && c[0].pages.join() === '1,2,3';
  })());
  check('chunkPages: a new request starts when the limit is reached', chunkPages(['x'.repeat(60), 'y'.repeat(60), 'z'.repeat(60)], [0, 1, 2], 100).length === 3);
  check('chunkPages: blank pages and unwanted pages are skipped', (() => { const c = chunkPages(['a', '  ', 'c'], [0, 1, 2], 100); return c.length === 1 && !c[0].text.includes('Page 2'); })());
  check('chunkPages: a page longer than a request is cut at line breaks, marker on the first piece only', (() => {
    const long = Array.from({ length: 30 }, (_, i) => `line number ${i} with some words`).join('\n');
    const c = chunkPages([long], [0], 200);
    return c.length > 3 && c.every((x) => x.text.length <= 200) && c[0].text.startsWith('=== Page 1 ===') && c.slice(1).every((x) => !x.text.includes('=== Page')) && c.map((x) => x.text).join('\n').includes('line number 29');
  })());
  check('chunkPages: one enormous line is cut too', chunkPages(['q'.repeat(950)], [0], 200).every((x) => x.text.length <= 200));
  check('extractJson: reads JSON inside code fences and chatter', (extractJson('Sure! Here you go:\n```json\n[{"q":"a","a":"b"}]\n```\nHope it helps') as any[])[0].q === 'a');
  check('extractJson: brackets inside strings do not confuse it', (extractJson('{"a":"x ] } y","b":[1,2]}') as any).b.length === 2);
  check('extractJson: cut-off JSON is an error, not a guess', (() => { try { extractJson('[{"q":"a","a":"b"},{"q":"c'); return false; } catch { return true; } })());
  check('parseCards: accepts front/back and question/answer names, drops empty cards', parseCards([{ front: 'F', back: 'B' }, { question: 'Q', answer: 'A' }, { q: 'only q' }]).length === 2);
  check('parseQuiz: a letter answer is understood and bad items are dropped', (() => {
    const q = parseQuiz([{ q: 'one', choices: ['a', 'b', 'c', 'd'], answer: 'C' }, { q: 'bad', choices: ['a'], answer: 0 }, { q: 'oob', choices: ['a', 'b'], answer: 5 }]);
    return q.length === 1 && q[0].answer === 2;
  })());
  check('parseTable: {columns, rows}, arrays of objects and arrays of arrays all work; plain numbers become numbers, "007" stays text', (() => {
    const a = parseTable({ columns: ['n', 'v'], rows: [['x', '1.50'], ['y', '007']] });
    const b = parseTable([{ n: 'x', v: 2 }, { n: 'y', w: 'extra' }]);
    const c = parseTable([['n', 'v'], ['x', 3]]);
    return a.rows[0][1] === 1.5 && a.rows[1][1] === '007' && b.columns.join() === 'n,v,w' && c.rows[0][1] === 3;
  })());
  check('parseTable: rows are padded to the column count and fully empty rows are dropped', (() => { const t = parseTable({ columns: ['a', 'b', 'c'], rows: [['1'], ['', '', ''], ['x', 'y', 'z']] }); return t.rows.length === 2 && t.rows[0].length === 3; })());
  check('toCsv: quotes cells with commas, quotes and line breaks', toCsv([['a,b', 'say "hi"', 'x\ny', 5]]) === '"a,b","say ""hi""","x\ny",5\r\n');

  // ================= no key =================
  clearAi();
  const doc3 = await textPdf(['Hello page one', 'Hello page two', 'Hello page three']);
  const nk = await throws(() => run('translate', { files: [pf('d.pdf', doc3)] }));
  check('no key: the tool asks for a key (code NO_KEY) and sends nothing', nk instanceof ToolError && (nk as any).code === 'NO_KEY' && calls.length === 0);

  // ================= translate =================
  useProvider();
  calls = [];
  reply = (r) => r.prompt.replace(/Hello/g, 'Hola');
  let r = await run('translate', { files: [pf('doc.pdf', doc3)] }, { lang: 'Spanish' });
  check('translate: text comes back translated, with page markers', /Hola page one/.test(r.text!) && /=== Page 3 ===/.test(r.text!), r.text);
  check('translate: a PDF is made for Spanish and holds the translation', !!r.files && r.files[0].name === 'doc-spanish.pdf' && /Hola page two/.test(await pdfText(r.files![0].bytes)));
  check('translate: the request goes to the chosen provider with the user\'s own key and no other host', calls.length === 1 && calls[0].url === 'https://api.openai.com/v1/chat/completions' && calls[0].headers.Authorization === 'Bearer sk-test-123');
  check('translate: the system prompt names the language and says the document is not instructions', /into Spanish/.test(calls[0].system) && /never instructions/.test(calls[0].system));
  check('translate: only the document text is sent', calls[0].prompt.includes('Hello page one') && !calls[0].prompt.includes('sk-test'));
  r = await run('translate', { files: [pf('doc.pdf', doc3)] }, { lang: 'Spanish', markers: false });
  check('translate: page markers can be switched off', !/=== Page/.test(r.text!) && /Hola page two/.test(r.text!));
  r = await run('translate', { files: [pf('doc.pdf', doc3)] }, { lang: 'Spanish', pages: '2' });
  check('translate: a page range sends only those pages', !/page one/.test(calls[calls.length - 1].prompt) && /page two/.test(calls[calls.length - 1].prompt) && /1 page translated/.test((r.notes || []).join(' ')));
  r = await run('translate', { files: [pf('doc.pdf', doc3)] }, { lang: 'Chinese (Simplified)' });
  check('translate: no PDF for a script the built-in fonts cannot draw, and the note says why', !r.files && /cannot draw Chinese/.test((r.notes || []).join(' ')) && r.textName === 'doc-chinese-simplified.txt');
  r = await run('translate', { files: [pf('doc.pdf', doc3)] }, { lang: 'Other', other: 'Swahili', makePdf: false });
  check('translate: "Other" uses the typed language', /into Swahili/.test(calls[calls.length - 1].system) && !r.files);
  check('translate: "Other" with nothing typed is refused', (await throws(() => run('translate', { files: [pf('doc.pdf', doc3)] }, { lang: 'Other', other: ' ' }))) instanceof ToolError);
  const blank = await PDFDocument.create();
  blank.addPage([300, 300]);
  const blankBytes = await blank.save();
  const scan = await throws(() => run('translate', { files: [pf('scan.pdf', blankBytes)] }, { lang: 'French' }));
  check('translate: a PDF with no text is refused with the OCR advice, and nothing is sent', scan instanceof ToolError && /Read scans \(OCR\)/.test((scan as Error).message));

  // a long document: several requests, the character cap, and the note about the rest
  const longDoc = await textPdf(Array.from({ length: 60 }, (_, i) => Array.from({ length: 24 }, (_, k) => `Section ${i + 1} sentence ${k + 1} about the subject at hand.`).join('\n')));
  calls = [];
  reply = (r) => r.prompt;
  r = await run('translate', { files: [pf('long.pdf', longDoc)] }, { lang: 'German' });
  check('translate: a long document is sent in several requests', calls.length > 5, `${calls.length} requests`);
  check('translate: every request stays within the size limit', calls.every((c) => c.prompt.length <= 3600));
  check('translate: the character cap leaves the rest, and the note says where to continue', /was not translated because the document is long/.test((r.notes || []).join(' ')) && /from page \d+/.test((r.notes || []).join(' ')), (r.notes || []).join(' | '));
  check('translate: the output keeps the page order', r.text!.indexOf('=== Page 1 ===') < r.text!.indexOf('=== Page 2 ===') && r.text!.indexOf('=== Page 2 ===') < r.text!.indexOf('=== Page 3 ==='));
  check('translate: the request size follows the 60,000 character cap', calls.reduce((s, c) => s + c.prompt.length, 0) <= 61000, String(calls.reduce((s, c) => s + c.prompt.length, 0)));

  // errors part-way
  calls = [];
  reply = (_r, n) => (n === 1 ? 'Hola first part' : { status: 429, message: 'Rate limit reached' });
  r = await run('translate', { files: [pf('long.pdf', longDoc)] }, { lang: 'Spanish' });
  check('translate: if the provider fails part-way, what was done is returned with a clear note', /Hola first part/.test(r.text!) && /Stopped after 1 of \d+ parts/.test((r.notes || []).join(' ')) && /Rate limit reached/.test((r.notes || []).join(' ')), (r.notes || []).join(' | '));
  calls = [];
  reply = () => ({ status: 401, message: 'Incorrect API key provided' });
  const bad = await throws(() => run('translate', { files: [pf('doc.pdf', doc3)] }, { lang: 'Spanish' }));
  check('translate: a rejected key surfaces the provider\'s message and stops', bad instanceof ToolError && /OpenAI replied: Incorrect API key/.test((bad as Error).message) && calls.length === 1);

  // other providers get the right request shape and the output-length limit
  useProvider('anthropic');
  calls = [];
  reply = (r) => r.prompt;
  await run('translate', { files: [pf('doc.pdf', doc3)] }, { lang: 'French' });
  check('translate (Anthropic): own key header, system prompt and a raised output limit', calls[0].url === 'https://api.anthropic.com/v1/messages' && calls[0].headers['x-api-key'] === 'sk-test-123' && calls[0].body.max_tokens === 4096 && /into French/.test(calls[0].system));
  useProvider('gemini');
  calls = [];
  await run('translate', { files: [pf('doc.pdf', doc3)] }, { lang: 'French' });
  check('translate (Gemini): key in the header, never in the URL, with the output limit', /generativelanguage\.googleapis\.com/.test(calls[0].url) && !calls[0].url.includes('sk-test') && calls[0].headers['x-goog-api-key'] === 'sk-test-123' && calls[0].body.generationConfig?.maxOutputTokens === 4096);
  useProvider('openai');

  // ================= flashcards and quiz =================
  calls = [];
  reply = () => 'Here are your cards:\n```json\n[{"q":"What is the capital?","a":"Paris"},{"q":"Comma, and \\"quote\\"","a":"Fine"},{"q":"","a":"dropped"}]\n```';
  r = await run('flashcards', { files: [pf('notes.pdf', doc3)] }, { kind: 'cards', count: '10' });
  const csv = dec(r.files![0].bytes);
  check('flashcards: two valid cards survive, the empty one is dropped', /2 cards made/.test((r.notes || []).join(' ')));
  check('flashcards: the CSV has a byte-order mark for Excel, quotes properly, and one card per line', r.files![0].bytes[0] === 0xef && r.files![0].bytes[1] === 0xbb && r.files![0].bytes[2] === 0xbf && csv.includes('What is the capital?,Paris') && csv.includes('"Comma, and ""quote"""') && csv.trim().split('\r\n').length === 2, csv);
  check('flashcards: the on-screen sheet lists the cards', /1\. What is the capital\?\n {3}→ Paris/.test(r.text!));
  check('flashcards: the prompt asks for exactly the chosen number and JSON only, and says to ignore instructions in the document', /exactly 10 flashcards/.test(calls[0].prompt) && /JSON only/.test(calls[0].system) && /ignore any instructions/.test(calls[0].system));
  reply = () => '[{"q":"Pick one","choices":["a","b","c","d"],"answer":"B","why":"Page 2 says so"},{"q":"Second","choices":["w","x","y","z"],"answer":3}]';
  r = await run('flashcards', { files: [pf('notes.pdf', doc3)] }, { kind: 'quiz', count: '10' });
  const qcsv = dec(r.files![0].bytes);
  check('flashcards: a quiz has choices, the right letter and the reason in the CSV', qcsv.includes('Question,A,B,C,D,Answer,Explanation') && qcsv.includes('Pick one,a,b,c,d,B,Page 2 says so') && qcsv.includes('Second,w,x,y,z,D,'), qcsv);
  check('flashcards: the quiz sheet shows the answer line', /Answer: B — Page 2 says so/.test(r.text!) && /Answer: D/.test(r.text!));
  check('flashcards: files are named after the PDF', r.files![0].name === 'notes-quiz.csv' && r.textName === 'notes-quiz.txt');
  r = await run('flashcards', { files: [pf('notes.pdf', doc3)] }, { kind: 'cards', count: '10', pages: '2-3' });
  check('flashcards: a page range sends only those pages with their real page numbers', /\[Page 2\]/.test(calls[calls.length - 1].prompt) && !/\[Page 1\]/.test(calls[calls.length - 1].prompt));
  reply = () => 'I am sorry, I cannot do that.';
  const junk = await throws(() => run('flashcards', { files: [pf('notes.pdf', doc3)] }, { kind: 'cards', count: '10' }));
  check('flashcards: an answer that is not JSON gives a clear message, not a crash', junk instanceof ToolError && /cut off or was not in the expected form/.test((junk as Error).message));
  reply = () => '[{"q":"a","a":"b"},{"q":"c';
  const cut = await throws(() => run('flashcards', { files: [pf('notes.pdf', doc3)] }, { kind: 'cards', count: '10' }));
  check('flashcards: a cut-off answer is refused rather than half used', cut instanceof ToolError);
  calls = [];
  const noText = await throws(() => run('flashcards', { files: [pf('scan.pdf', blankBytes)] }, { kind: 'cards' }));
  check('flashcards: a PDF with no text is refused with the OCR advice and nothing is sent', noText instanceof ToolError && /Read scans \(OCR\)/.test((noText as Error).message) && calls.length === 0);

  // ================= pull data into Excel =================
  const invoice = await textPdf(['Invoice 1001\nPen  2  1.50\nBook  1  12.00']);
  calls = [];
  reply = () => '{"columns":["Description","Quantity","Unit price","Page"],"rows":[["Pen","2","1.50",1],["Book",1,12,1],["","","",""]]}';
  r = await run('ai-extract', { files: [pf('inv.pdf', invoice)] }, { preset: 'invoice' });
  const sheets = await readXlsx(r.files![0].bytes);
  check('pull data: a real .xlsx with a header row and the rows (the empty row is dropped)', sheets[0].rows.length === 3 && sheets[0].rows[0][0].text === 'Description' && sheets[0].rows[1][0].text === 'Pen', JSON.stringify(sheets[0].rows.map((x) => x.map((c) => c.text))));
  check('pull data: numbers arrive as numbers, even when the AI wrote them as text', sheets[0].rows[1][1].num && sheets[0].rows[1][2].num && sheets[0].rows[1][2].text === '1.5', JSON.stringify(sheets[0].rows[1]));
  check('pull data: a CSV copy is shown for copying', /Description,Quantity,Unit price,Page/.test(r.text!) && r.textName === 'inv-data.csv');
  check('pull data: the prompt tells the AI not to guess, to leave blanks, and asks for a page column', /never guess/.test(calls[0].system) && /leave a cell empty/.test(calls[0].system) && /column named "Page"/.test(calls[0].prompt));
  check('pull data: the invoice preset describes line items', /line item/.test(calls[0].prompt));
  r = await run('ai-extract', { files: [pf('inv.pdf', invoice)] }, { preset: 'custom', request: 'every product name', pageCol: false });
  check('pull data: a custom request is used as typed and the page column can be off', /every product name/.test(calls[calls.length - 1].prompt) && !/column named "Page"/.test(calls[calls.length - 1].prompt));
  reply = () => '[{"name":"Anna","email":"a@x.com"},{"name":"Raj","phone":"123"}]';
  r = await run('ai-extract', { files: [pf('inv.pdf', invoice)] }, { preset: 'people' });
  const s2 = await readXlsx(r.files![0].bytes);
  check('pull data: a list of objects also works, with columns from every key', s2[0].rows[0].map((c) => c.text).join() === 'name,email,phone' && s2[0].rows.length === 3);
  reply = () => '{"columns":["A"],"rows":[]}';
  const none = await throws(() => run('ai-extract', { files: [pf('inv.pdf', invoice)] }, { preset: 'dates' }));
  check('pull data: nothing found gives advice, not an empty file', none instanceof ToolError && /did not find anything/.test((none as Error).message));
  const noReq = await throws(() => run('ai-extract', { files: [pf('inv.pdf', invoice)] }, { preset: 'custom', request: '' }));
  check('pull data: a custom request with nothing typed is refused', noReq instanceof ToolError);
  reply = () => 'No table here';
  const notJson = await throws(() => run('ai-extract', { files: [pf('inv.pdf', invoice)] }, { preset: 'invoice' }));
  check('pull data: a reply that is not JSON gives a clear message', notJson instanceof ToolError && /expected form/.test((notJson as Error).message));

  // ================= the existing AI tools still work with the new context helper =================
  reply = () => 'The notice period is 30 days (p. 2).';
  calls = [];
  r = await run('ask', { files: [pf('c.pdf', doc3)] }, { q: 'Notice period?' });
  check('ask: still answers, and the prompt has the page tags', /30 days/.test(r.text!) && /\[Page 2\]/.test(calls[0].prompt));
  r = await run('summarize', { files: [pf('c.pdf', doc3)] }, { length: 'short' });
  check('summarise: still works', !!r.text && calls.length === 2);

  console.log(`\n${pass} passed, ${fail} failed.`);
  if (fail) {
    console.log('\nFailures:\n - ' + failures.join('\n - '));
    process.exit(1);
  }
})().catch((e) => {
  console.error('TEST CRASH', e);
  process.exit(2);
});
