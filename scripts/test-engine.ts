/**
 * Engine smoke tests: runs every tool that does not need a browser canvas against generated PDFs.
 * Run:  npx tsx scripts/test-engine.ts
 */
import { PDFDict, PDFDocument, PDFName, StandardFonts, degrees } from 'pdf-lib';
import { corners, placeImage } from '../src/engine/placement';
import { ALL_TOOLS } from '../src/tools/all';

const READY = ALL_TOOLS.filter((t) => t.status === 'ready');
const byId = (id: string) => ALL_TOOLS.find((t) => t.id === id);
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

  // ---- passwords (AES-256 through @cantoo/pdf-lib) ----
  {
    const has = (b: Uint8Array, needle: string) => Buffer.from(b).includes(needle);
    const lock = await run('lock', { files: [A] }, { password: 'correct horse', confirm: 'correct horse' });
    const locked = lock.files![0].bytes;
    check('lock: the output is encrypted', has(locked, '/Encrypt') && has(locked, '/AESV3'));
    let refused = false;
    try {
      await PDFDocument.load(locked);
    } catch {
      refused = true;
    }
    check('lock: the ordinary engine cannot open it without the password', refused);
    const lockedFile = pf('a-protected.pdf', locked);
    let ur = await run('unlock', { files: [lockedFile] }, { password: 'correct horse' });
    check('unlock: right password gives back 5 readable pages', (await pages(ur.files![0].bytes)) === 5 && !has(ur.files![0].bytes, '/Encrypt'));
    try {
      await run('unlock', { files: [lockedFile] }, { password: 'wrong' });
      check('unlock: a wrong password is refused', false, 'did not throw');
    } catch (e) {
      check('unlock: a wrong password is refused', e instanceof ToolError && (e as any).code === 'wrong-password', e instanceof Error ? e.message.slice(0, 50) : '');
    }
    try {
      await run('unlock', { files: [lockedFile] }, { password: '' });
      check('unlock: a missing password is refused', false, 'did not throw');
    } catch (e) {
      check('unlock: a missing password is refused', e instanceof ToolError);
    }
    ur = await run('unlock', { files: [A] }, { password: '' });
    check('unlock: an unprotected PDF comes back unchanged with a note', ur.files![0].bytes.length === (await A.bytes()).length && (ur.notes || []).join(' ').includes('no password'));
    for (const [label, opts] of [
      ['lock: empty password is refused', { password: '', confirm: '' }],
      ['lock: mismatched confirmation is refused', { password: 'abcdef', confirm: 'abcdeg' }],
      ['lock: a 3-character password is refused', { password: 'abc', confirm: 'abc' }],
    ] as [string, Record<string, any>][]) {
      try {
        await run('lock', { files: [A] }, opts);
        check(label, false, 'did not throw');
      } catch (e) {
        check(label, e instanceof ToolError, e instanceof Error ? e.message.slice(0, 50) : '');
      }
    }
    try {
      await run('lock', { files: [lockedFile] }, { password: 'another one', confirm: 'another one' });
      check('lock: an already protected PDF is refused with advice', false, 'did not throw');
    } catch (e) {
      check('lock: an already protected PDF is refused with advice', e instanceof ToolError && /already has a password/.test((e as Error).message));
    }
    // a PDF that opens freely but forbids copying: an empty password lifts the restriction
    const { PDFDocument: P2 } = await import('@cantoo/pdf-lib');
    const restricted = await P2.create();
    restricted.addPage([300, 300]);
    restricted.encrypt({ userPassword: '', ownerPassword: 'owner-secret', permissions: { copying: false, printing: false } });
    const rb = await restricted.save();
    ur = await run('unlock', { files: [pf('restricted.pdf', rb)] }, { password: '' });
    check('unlock: lifts restrictions on a PDF that opens without a password', !has(ur.files![0].bytes, '/Encrypt') && (await pages(ur.files![0].bytes)) === 1);
  }

  // ---- sign: geometry, then the tool ----
  {
    const crop = { x: 0, y: 0, width: 400, height: 600 };
    const inside = (c: [number, number][], b = crop) => c.every(([x, y]) => x >= b.x - 0.01 && x <= b.x + b.width + 0.01 && y >= b.y - 0.01 && y <= b.y + b.height + 0.01);
    // the image's displayed top-left corner is local corner (0, height); at x=y=0 it must land on the displayed top-left of the page
    const expectTopLeft: Record<number, [number, number]> = { 0: [0, 600], 90: [0, 0], 180: [400, 0], 270: [400, 600] };
    for (const r of [0, 90, 180, 270]) {
      const p = placeImage(crop, r, { x: 0, y: 0, w: 0.25 }, 2);
      const tl = corners(p)[3];
      check(`placement: rotation ${r}, top-left lands on the displayed top-left corner`, Math.abs(tl[0] - expectTopLeft[r][0]) < 0.01 && Math.abs(tl[1] - expectTopLeft[r][1]) < 0.01, tl.map((v) => v.toFixed(1)).join(','));
      const q = placeImage(crop, r, { x: 5, y: 5, w: 0.3 }, 2); // far off the page: must be pulled back inside
      check(`placement: rotation ${r}, an off-page position is clamped inside the page`, inside(corners(q)));
      const w = placeImage({ x: 50, y: 30, width: 400, height: 600 }, r, { x: 0.4, y: 0.4, w: 0.2 }, 3);
      check(`placement: rotation ${r}, respects a crop box that does not start at 0,0`, inside(corners(w), { x: 50, y: 30, width: 400, height: 600 }));
    }

    const sharp = (await import('sharp')).default;
    const png = await sharp({ create: { width: 200, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } }).png().toBuffer();
    const sigUrl = 'data:image/png;base64,' + png.toString('base64');
    const two = await PDFDocument.create();
    two.addPage([400, 600]);
    const rotated = two.addPage([400, 600]);
    rotated.setRotation(degrees(90));
    const twoBytes = await two.save();
    const images = (doc: PDFDocument, i: number) => {
      const xo = doc.getPage(i).node.Resources()?.lookupMaybe(PDFName.of('XObject'), PDFDict);
      return xo ? xo.keys().length : 0;
    };
    let sr = await run('sign', { files: [pf('two.pdf', twoBytes)] }, { signature: sigUrl, placement: { page: 2, x: 0.5, y: 0.8, w: 0.3 }, applyTo: 'this' });
    let sd = await PDFDocument.load(sr.files![0].bytes);
    check('sign: one page signed, the other left alone', images(sd, 1) === 1 && images(sd, 0) === 0);
    sr = await run('sign', { files: [pf('two.pdf', twoBytes)] }, { signature: sigUrl, placement: { page: 1, x: 0.1, y: 0.1, w: 0.2 }, applyTo: 'all' });
    sd = await PDFDocument.load(sr.files![0].bytes);
    check('sign: "every page" signs both pages', images(sd, 0) === 1 && images(sd, 1) === 1);
    sr = await run('sign', { files: [pf('two.pdf', twoBytes)] }, { signature: sigUrl, placement: { page: 1, x: 0.1, y: 0.1, w: 0.2 }, applyTo: 'last' });
    sd = await PDFDocument.load(sr.files![0].bytes);
    check('sign: "last page" signs only the last page', images(sd, 1) === 1 && images(sd, 0) === 0);
    check('sign: page count is unchanged', sd.getPageCount() === 2);
    try {
      await run('sign', { files: [pf('two.pdf', twoBytes)] }, { signature: '', placement: { page: 1, x: 0, y: 0, w: 0.3 } });
      check('sign: no signature is refused', false, 'did not throw');
    } catch (e) {
      check('sign: no signature is refused', e instanceof ToolError, e instanceof Error ? e.message.slice(0, 50) : '');
    }
  }

  // ---- fill: a form with every field kind ----
  {
    const d = await PDFDocument.create();
    const page = d.addPage([400, 600]);
    const form = d.getForm();
    form.createTextField('name').addToPage(page, { x: 20, y: 540, width: 200, height: 22 });
    form.createCheckBox('agree').addToPage(page, { x: 20, y: 500, width: 16, height: 16 });
    const dd = form.createDropdown('country');
    dd.addOptions(['India', 'Spain', 'Japan']);
    dd.addToPage(page, { x: 20, y: 460, width: 150, height: 22 });
    const rg = form.createRadioGroup('plan');
    rg.addOptionToPage('free', page, { x: 20, y: 420, width: 16, height: 16 });
    rg.addOptionToPage('pro', page, { x: 60, y: 420, width: 16, height: 16 });
    const formBytes = await d.save();
    const { listFormFields } = await import('../src/tools/sign');
    const fields = await listFormFields(formBytes);
    check('fill: lists text, checkbox, dropdown and radio fields', fields.map((x) => x.kind).sort().join() === 'checkbox,dropdown,radio,text', fields.map((x) => x.kind).join());
    check('fill: dropdown and radio options are listed', (fields.find((x) => x.name === 'country')?.options || []).length === 3 && (fields.find((x) => x.name === 'plan')?.options || []).join() === 'free,pro');
    const fr = await run('fill', { files: [pf('form.pdf', formBytes)] }, { fields: { name: 'Jane Doe', agree: true, country: 'Spain', plan: 'pro' } });
    const back = await PDFDocument.load(fr.files![0].bytes);
    const bf = back.getForm();
    check('fill: text, checkbox, dropdown and radio values are saved', bf.getTextField('name').getText() === 'Jane Doe' && bf.getCheckBox('agree').isChecked() && bf.getDropdown('country').getSelected()[0] === 'Spain' && bf.getRadioGroup('plan').getSelected() === 'pro');
    const flat = await run('fill', { files: [pf('form.pdf', formBytes)] }, { fields: { name: 'Jane Doe' }, flatten: true });
    check('fill: "make permanent" removes the fields', (await PDFDocument.load(flat.files![0].bytes)).getForm().getFields().length === 0);
    try {
      await run('fill', { files: [A] }, { fields: { x: 'y' } });
      check('fill: a PDF with no fields is refused with advice', false, 'did not throw');
    } catch (e) {
      check('fill: a PDF with no fields is refused with advice', e instanceof ToolError && /no fillable fields/.test((e as Error).message));
    }
    try {
      await run('fill', { files: [pf('form.pdf', formBytes)] }, { fields: { name: 'caf\u{1F600}' } });
      check('fill: a character the font cannot show gets a clear message', false, 'did not throw');
    } catch (e) {
      check('fill: a character the font cannot show gets a clear message', e instanceof ToolError || /encode|WinAnsi/i.test(String(e)), e instanceof Error ? e.message.slice(0, 60) : '');
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
