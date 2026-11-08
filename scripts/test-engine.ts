/**
 * Engine smoke tests: runs every tool that does not need a browser canvas against generated PDFs.
 * Run:  npx tsx scripts/test-engine.ts
 */
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { byId, READY } from '../src/tools';
import type { PickedFile, ToolResult } from '../src/engine/types';
import { ToolError } from '../src/engine/util';

const pf = (name: string, bytes: Uint8Array, type = 'application/pdf'): PickedFile => ({ name, size: bytes.length, type, bytes: async () => bytes });

async function makePdf(pages: number, tag: string, size: [number, number] = [595.28, 841.89]): Promise<Uint8Array> {
  const d = await PDFDocument.create();
  const f = await d.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) d.addPage(size).drawText(`${tag} page ${i}`, { x: 60, y: size[1] - 80, size: 24, font: f });
  d.setTitle('Secret title');
  d.setAuthor('Jane Doe');
  return d.save();
}

let pass = 0;
let fail = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, extra = '') {
  if (ok) pass++;
  else {
    fail++;
    failures.push(`${name} ${extra}`);
  }
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`);
}

async function run(id: string, files: Record<string, PickedFile[]>, opts: Record<string, any> = {}): Promise<ToolResult> {
  const tool = byId(id)!;
  const defaults: Record<string, any> = {};
  (tool.options || []).forEach((o) => (defaults[o.key] = (o as any).default ?? ''));
  return tool.run!({ files, opts: { ...defaults, ...opts }, progress: () => {} });
}
const pages = async (b: Uint8Array) => (await PDFDocument.load(b)).getPageCount();

(async () => {
  const A = pf('a.pdf', await makePdf(5, 'A'));
  const B = pf('b.pdf', await makePdf(3, 'B'));

  // ---- join ----
  let r = await run('merge', { files: [A, B] });
  check('merge: 5+3 = 8 pages', (await pages(r.files![0].bytes)) === 8);
  r = await run('weave', { a: [A], b: [B] });
  check('weave: 8 pages', (await pages(r.files![0].bytes)) === 8);
  r = await run('split', { files: [A] }, { mode: 'ranges', ranges: '1-2, 3-5' });
  check('split ranges: 2 files (2 and 3 pages)', r.files!.length === 2 && (await pages(r.files![0].bytes)) === 2 && (await pages(r.files![1].bytes)) === 3);
  r = await run('split', { files: [A] }, { mode: 'each' });
  check('split each: 5 files', r.files!.length === 5);
  r = await run('split', { files: [A] }, { mode: 'every', n: 2 });
  check('split every 2: 3 files', r.files!.length === 3);
  r = await run('extract-pages', { files: [A] }, { pages: '2, 4' });
  check('extract 2,4: 2 pages', (await pages(r.files![0].bytes)) === 2);
  r = await run('remove-pages', { files: [A] }, { pages: '1, last' });
  check('delete 1,last: 3 pages', (await pages(r.files![0].bytes)) === 3);

  // ---- arrange ----
  r = await run('reorder', { files: [A] }, { order: '5, 1, 1' });
  check('reorder 5,1,1: 3 pages (duplicates allowed)', (await pages(r.files![0].bytes)) === 3);
  r = await run('reverse', { files: [A] });
  check('reverse: 5 pages', (await pages(r.files![0].bytes)) === 5);
  r = await run('rotate', { files: [A] }, { angle: '90', pages: '1' });
  {
    const d = await PDFDocument.load(r.files![0].bytes);
    check('rotate: page 1 is 90°, page 2 untouched', d.getPage(0).getRotation().angle === 90 && d.getPage(1).getRotation().angle === 0);
  }
  r = await run('insert-blank', { files: [A] }, { pages: '1', where: 'after', count: 2, size: 'same' });
  check('blank pages: 5+2 = 7', (await pages(r.files![0].bytes)) === 7);
  r = await run('resize', { files: [A] }, { size: 'a5' });
  {
    const d = await PDFDocument.load(r.files![0].bytes);
    const { width } = d.getPage(0).getSize();
    check('resize to A5: width ≈ 419.5', Math.abs(width - 419.53) < 1, String(width));
  }
  r = await run('crop', { files: [A] }, { unit: 'mm', top: 10, right: 10, bottom: 10, left: 10 });
  {
    const d = await PDFDocument.load(r.files![0].bytes);
    const { width } = d.getPage(0).getSize();
    check('crop 10mm: narrower than A4', width < 595.28 - 50, String(width));
  }
  r = await run('n-up', { files: [A] }, { per: '4' });
  check('4-up: 5 pages → 2 sheets', (await pages(r.files![0].bytes)) === 2);
  r = await run('repair', { files: [A] });
  check('repair: 5 pages', (await pages(r.files![0].bytes)) === 5);

  // ---- markup ----
  r = await run('page-numbers', { files: [A] }, { pos: 'bc', format: 'Page {n} of {total}' });
  check('page numbers: opens, 5 pages', (await pages(r.files![0].bytes)) === 5);
  r = await run('text-watermark', { files: [A] }, { text: 'DRAFT', mode: 'center', angle: '45' });
  check('watermark centre: opens', (await pages(r.files![0].bytes)) === 5);
  r = await run('text-watermark', { files: [A] }, { text: 'DRAFT', mode: 'tile', angle: '45' });
  check('watermark tiled: opens', (await pages(r.files![0].bytes)) === 5);
  r = await run('headers-footers', { files: [A] }, { hl: 'Header {date}', fr: '{n}/{total}' });
  check('headers/footers: opens', (await pages(r.files![0].bytes)) === 5);
  r = await run('add-text', { files: [A] }, { text: 'Approved ✓ ok', pages: 'all' });
  check('add text (non-Latin char tolerated)', (await pages(r.files![0].bytes)) === 5);

  // ---- make ----
  r = await run('text-to-pdf', {}, { source: '# Title\n\nSome **bold** text.\n\n- one\n- two\n\n> quote\n\n---\n\n```\ncode\n```\n' + 'Long paragraph. '.repeat(400), format: 'markdown' });
  check('markdown → PDF: multi-page', (await pages(r.files![0].bytes)) >= 2);

  // ---- privacy / shrink / insight ----
  r = await run('flatten', { files: [A] }, { forms: true, annots: true });
  check('flatten: opens', (await pages(r.files![0].bytes)) === 5);
  r = await run('properties', { files: [A] }, { strip: true });
  {
    const d = await PDFDocument.load(r.files![0].bytes, { updateMetadata: false });
    check('strip metadata: title and author gone', !d.getTitle() && !d.getAuthor(), `${d.getTitle()} / ${d.getAuthor()}`);
  }
  r = await run('properties', { files: [A] }, { strip: false, title: 'New title' });
  {
    const d = await PDFDocument.load(r.files![0].bytes, { updateMetadata: false });
    check('edit properties: title updated', d.getTitle() === 'New title');
  }
  r = await run('inspect', { files: [A] });
  check('inspect: report mentions 5 pages and the author', !!r.text && r.text.includes('Pages: 5') && r.text.includes('Jane Doe'));
  r = await run('compress', { files: [A] }, { level: 'lossless' });
  check('compress (gentle): opens, 5 pages', (await pages(r.files![0].bytes)) === 5);

  // ---- error handling ----
  for (const [label, fn] of [
    ['delete all pages is refused', () => run('remove-pages', { files: [A] }, { pages: 'all' })],
    ['page out of range is explained', () => run('extract-pages', { files: [A] }, { pages: '99' })],
    ['garbage range is explained', () => run('extract-pages', { files: [A] }, { pages: 'banana' })],
    ['not-a-PDF is explained', () => run('rotate', { files: [pf('x.pdf', new TextEncoder().encode('hello'))] }, { angle: '90' })],
    ['empty watermark text is refused', () => run('text-watermark', { files: [A] }, { text: '' })],
  ] as [string, () => Promise<unknown>][]) {
    try {
      await fn();
      check(label, false, 'did not throw');
    } catch (e) {
      check(label, e instanceof ToolError, e instanceof Error ? e.message.slice(0, 60) : '');
    }
  }

  const browserOnly = ['images-to-pdf', 'scan-to-pdf', 'pdf-to-images', 'extract-text', 'compress (balanced/strong/tiny)', 'restyle', 'redact', 'compare', 'summarize', 'ask', 'text-watermark image variant'];
  console.log(`\n${pass} passed, ${fail} failed.`);
  console.log(`Ready tools: ${READY.length}. Browser-only (need canvas / pdf.js / network), verify in the browser: ${browserOnly.join(', ')}`);
  if (fail) {
    console.log('\nFailures:\n - ' + failures.join('\n - '));
    process.exit(1);
  }
})().catch((e) => {
  console.error('TEST CRASH', e);
  process.exit(2);
});
