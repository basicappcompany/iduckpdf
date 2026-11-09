/**
 * Browser tests for the newer tools (password, sign, fill, OCR, Office conversions) against the BUILT site.
 *   npm run export:web, then serve dist/ (for example `npx serve dist -l 8080`), then
 *   PLAYWRIGHT_CORE=/path/to/playwright-core BASE_URL=http://localhost:8080 node scripts/e2e-tools.js
 * Test files are generated here with pdf-lib, so nothing needs to be checked in.
 */
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { PDFDocument, StandardFonts, degrees, PDFName, PDFArray, PDFRawStream, decodePDFRawStream } = require('pdf-lib');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:8080';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'duck-e2e-'));
const results = [];
const ok = (name, pass, extra = '') => {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`);
};

async function makePdf(name, pages, text) {
  const d = await PDFDocument.create();
  const f = await d.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) d.addPage([400, 500]).drawText(`${text} page ${i}`, { x: 30, y: 440, size: 20, font: f });
  const p = path.join(TMP, name);
  fs.writeFileSync(p, await d.save());
  return p;
}

/** Choose a file with the drop zone, run the tool, and return the first download (saved to TMP) */
async function useTool(page, url, files, fill = async () => {}, runName = /./) {
  await page.goto(BASE + url);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: /Select file/i }).first().click()]);
  await chooser.setFiles(files);
  await page.waitForTimeout(400);
  await fill(page);
  await page.getByRole('button', { name: runName }).last().click();
}
const done = (page, t = 30000) => page.getByText('Done!').waitFor({ timeout: t }).then(() => true).catch(() => false);
const errorText = async (page, re) => page.getByText(re).first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
async function download(page) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /^⬇️?\s*Download$|Download/ }).first().click()]);
  const out = path.join(TMP, 'dl-' + dl.suggestedFilename());
  await dl.saveAs(out);
  return out;
}
/** All content-stream operators of a page, as text. */
async function pageContent(bytes, pageIndex) {
  const doc = await PDFDocument.load(bytes);
  const c = doc.getPage(pageIndex).node.Contents();
  const streams = c instanceof PDFArray ? Array.from({ length: c.size() }, (_, i) => doc.context.lookup(c.get(i))) : [c];
  return streams.map((x) => Buffer.from(decodePDFRawStream(x).decode()).toString('latin1')).join('\n');
}
/** Where the image on a page ended up, in the page's own coordinates: the four corners of the unit square under the page's CTM. */
async function imageCorners(bytes, pageIndex) {
  const doc = await PDFDocument.load(bytes);
  const page = doc.getPage(pageIndex);
  const c = page.node.Contents();
  const streams = c instanceof PDFArray ? Array.from({ length: c.size() }, (_, i) => doc.context.lookup(c.get(i))) : [c];
  const text = streams.map((x) => Buffer.from(decodePDFRawStream(x).decode()).toString('latin1')).join('\n');
  const before = text.slice(0, text.lastIndexOf(' Do'));
  const start = before.lastIndexOf('q');
  const nums = [...before.slice(start).matchAll(/(-?[\d.]+(?:e-?\d+)?) (-?[\d.]+(?:e-?\d+)?) (-?[\d.]+(?:e-?\d+)?) (-?[\d.]+(?:e-?\d+)?) (-?[\d.]+(?:e-?\d+)?) (-?[\d.]+(?:e-?\d+)?) cm/g)].map((m) => m.slice(1, 7).map(Number));
  let ctm = [1, 0, 0, 1, 0, 0];
  const mul = (m, n) => [m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3], m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3], m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5]];
  for (const m of nums) ctm = mul(m, ctm); // each new matrix is applied before the ones already in force
  const pt = (u, v) => [ctm[0] * u + ctm[2] * v + ctm[4], ctm[1] * u + ctm[3] * v + ctm[5]];
  return [pt(0, 0), pt(1, 0), pt(1, 1), pt(0, 1)];
}
/** Convert page coordinates to displayed coordinates (top-left origin) for a page rotation. */
function displayed([px, py], r, W, H) {
  if (r === 0) return [px, H - py];
  if (r === 90) return [py, px];
  if (r === 180) return [W - px, py];
  return [H - py, W - px];
}
const drawSignature = async (page) => {
  const pad = page.locator('canvas[aria-label^="Signature drawing area"]');
  await pad.waitFor({ timeout: 8000 });
  const b = await pad.boundingBox();
  await page.mouse.move(b.x + b.width * 0.15, b.y + b.height * 0.6);
  await page.mouse.down();
  for (let i = 0; i <= 24; i++) await page.mouse.move(b.x + b.width * (0.15 + i * 0.03), b.y + b.height * (0.6 - 0.35 * Math.sin(i / 3)), { steps: 2 });
  await page.mouse.up();
  await page.getByAltText('Preview of your signature').waitFor({ timeout: 5000 });
};

const fillPasswords = (a, b) => async (page) => {
  const boxes = page.locator('input[type=password]');
  await boxes.nth(0).fill(a);
  if (b !== undefined) await boxes.nth(1).fill(b);
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1800 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message.slice(0, 160)));

  const src = await makePdf('plain.pdf', 3, 'Plain');

  // ---------- password: add, then remove ----------
  await useTool(page, '/password-protect-pdf', [src], fillPasswords('correct horse battery', 'correct horse battery'), /Add password/);
  ok('lock: runs and finishes', await done(page));
  const lockedPath = await download(page);
  const lockedBytes = fs.readFileSync(lockedPath);
  ok('lock: the downloaded file is AES-256 encrypted', lockedBytes.includes('/Encrypt') && lockedBytes.includes('/AESV3'));
  let opened = true;
  try { await PDFDocument.load(lockedBytes); } catch { opened = false; }
  ok('lock: the ordinary engine cannot open it without the password', !opened);

  await useTool(page, '/password-protect-pdf', [src], fillPasswords('abcdef', 'abcdeg'), /Add password/);
  ok('lock: a mismatched confirmation shows a clear message', await errorText(page, /do not match/));

  await useTool(page, '/unlock-pdf', [lockedPath], fillPasswords('wrong password'), /Remove password/);
  ok('unlock: a wrong password shows a clear message', await errorText(page, /password did not work/));

  await useTool(page, '/unlock-pdf', [lockedPath], fillPasswords('correct horse battery'), /Remove password/);
  ok('unlock: the right password finishes', await done(page));
  const unlockedPath = await download(page);
  const reopened = await PDFDocument.load(fs.readFileSync(unlockedPath)).catch(() => null);
  ok('unlock: the unlocked file opens without a password and has 3 pages', !!reopened && reopened.getPageCount() === 3);

  // ---------- sign: draw, place, run, and check the signature landed where it was dragged ----------
  for (const rot of [0, 90]) {
    const d = await PDFDocument.create();
    const font = await d.embedFont(StandardFonts.Helvetica);
    const pg = d.addPage([400, 500]);
    pg.drawText('Sign here please', { x: 40, y: 440, size: 22, font });
    if (rot) pg.setRotation(degrees(rot));
    const target = path.join(TMP, `sign-${rot}.pdf`);
    fs.writeFileSync(target, await d.save());

    await page.goto(BASE + '/sign-pdf');
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: /Select file/i }).first().click()]);
    await chooser.setFiles([target]);
    await page.getByAltText(/^Page 1 of your PDF/).waitFor({ timeout: 15000 });
    await drawSignature(page);
    const overlay = page.locator('[aria-label^="Your signature. Drag"]');
    await overlay.waitFor({ timeout: 5000 });
    ok(`sign (page rotated ${rot}): the page preview and the signature overlay appear`, (await overlay.count()) === 1);

    // drag the signature to the upper left area of the page
    const pageBox = await page.getByAltText(/^Page 1 of your PDF/).boundingBox();
    const ob = await overlay.boundingBox();
    await page.mouse.move(ob.x + ob.width / 2, ob.y + ob.height / 2);
    await page.mouse.down();
    await page.mouse.move(pageBox.x + pageBox.width * 0.3, pageBox.y + pageBox.height * 0.25, { steps: 8 });
    await page.mouse.up();
    const ob2 = await overlay.boundingBox();
    const fx = (ob2.x - pageBox.x) / pageBox.width; // displayed top-left of the signature, as fractions of the displayed page
    const fy = (ob2.y - pageBox.y) / pageBox.height;
    const fw = ob2.width / pageBox.width;
    ok(`sign (page rotated ${rot}): dragging moves the signature to the upper left`, fx < 0.4 && fy < 0.4 && fx >= 0 && fy >= 0, `x=${fx.toFixed(2)} y=${fy.toFixed(2)}`);

    await page.getByRole('button', { name: /Sign now/i }).last().click();
    ok(`sign (page rotated ${rot}): runs and finishes`, await done(page));
    const out = fs.readFileSync(await download(page));
    const cs = await imageCorners(out, 0);
    const W = 400, H = 500;
    const dc = cs.map((c) => displayed(c, rot, W, H));
    const Wd = rot === 90 ? H : W, Hd = rot === 90 ? W : H;
    const left = Math.min(...dc.map((c) => c[0])) / Wd, top = Math.min(...dc.map((c) => c[1])) / Hd, width = (Math.max(...dc.map((c) => c[0])) - Math.min(...dc.map((c) => c[0]))) / Wd;
    ok(`sign (page rotated ${rot}): in the PDF the signature sits where it was dragged (within 1.5% of the page)`, Math.abs(left - fx) < 0.015 && Math.abs(top - fy) < 0.015 && Math.abs(width - fw) < 0.015, `want ${fx.toFixed(3)},${fy.toFixed(3)},${fw.toFixed(3)} got ${left.toFixed(3)},${top.toFixed(3)},${width.toFixed(3)}`);
  }

  // typed and uploaded signatures, and keyboard / slider resizing
  {
    await page.goto(BASE + '/sign-pdf');
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: /Select file/i }).first().click()]);
    await chooser.setFiles([src]);
    await page.getByAltText(/^Page 1 of your PDF/).waitFor({ timeout: 15000 });
    await page.getByRole('button', { name: 'Type', exact: true }).click();
    await page.getByLabel('Your signature as text').fill('Jane Q. Public');
    await page.getByAltText('Preview of your signature').waitFor({ timeout: 5000 });
    ok('sign: a typed signature produces a preview', true);
    const overlay = page.locator('[aria-label^="Your signature. Drag"]');
    await overlay.waitFor({ timeout: 5000 });
    const w0 = (await overlay.boundingBox()).width;
    await overlay.focus();
    for (let i = 0; i < 5; i++) await page.keyboard.press('+');
    await page.waitForTimeout(150);
    ok('sign: the + key makes the signature larger', (await overlay.boundingBox()).width > w0 + 5);
    await page.getByRole('button', { name: 'Upload', exact: true }).click();
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEklEQVR4nGNgYGD4z8DAwMAAAAAaAAIAmZ2bAAAAAElFTkSuQmCC', 'base64');
    await page.locator('input[type=file][aria-label^="Choose a picture"]').setInputFiles({ name: 'sig.png', mimeType: 'image/png', buffer: png });
    ok('sign: an uploaded picture produces a preview', await page.getByAltText('Preview of your signature').waitFor({ timeout: 5000 }).then(() => true).catch(() => false));
    await page.getByRole('button', { name: /Sign now/i }).last().click();
    ok('sign: refuses nothing when a signature exists (runs)', await done(page));
    await page.goto(BASE + '/sign-pdf');
    const [c2] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: /Select file/i }).first().click()]);
    await c2.setFiles([src]);
    await page.getByRole('button', { name: /Sign now/i }).last().click();
    ok('sign: running without a signature explains what to do', await errorText(page, /Create your signature first/));
  }

  // ---------- fill: a form with text, checkbox and dropdown ----------
  {
    const d = await PDFDocument.create();
    const pg = d.addPage([400, 500]);
    const form = d.getForm();
    form.createTextField('fullname').addToPage(pg, { x: 30, y: 440, width: 220, height: 24 });
    form.createCheckBox('subscribe').addToPage(pg, { x: 30, y: 400, width: 16, height: 16 });
    const dd = form.createDropdown('country');
    dd.addOptions(['India', 'Spain', 'Japan']);
    dd.addToPage(pg, { x: 30, y: 360, width: 160, height: 24 });
    const formPath = path.join(TMP, 'form.pdf');
    fs.writeFileSync(formPath, await d.save());

    await page.goto(BASE + '/fill-pdf-form');
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: /Select file/i }).first().click()]);
    await chooser.setFiles([formPath]);
    ok('fill: the form fields are listed', await page.getByText('fullname').first().waitFor({ timeout: 15000 }).then(() => true).catch(() => false));
    await page.locator('input').filter({ hasNot: page.locator('[type=file]') }).last().fill('Jane Doe').catch(() => {});
    // the text box sits right under its label
    const box = page.getByText('fullname', { exact: true }).first().locator('xpath=following::input[1]');
    await box.fill('Jane Doe');
    await page.getByText('subscribe', { exact: true }).first().click();
    await page.getByText('Spain', { exact: true }).first().click();
    await page.getByRole('button', { name: /Fill form/i }).last().click();
    ok('fill: runs and finishes', await done(page));
    const outPath = await download(page);
    const back = await PDFDocument.load(fs.readFileSync(outPath));
    const bf = back.getForm();
    ok('fill: the downloaded PDF holds the typed text, the tick and the choice', bf.getTextField('fullname').getText() === 'Jane Doe' && bf.getCheckBox('subscribe').isChecked() && bf.getDropdown('country').getSelected()[0] === 'Spain');

    await page.goto(BASE + '/fill-pdf-form');
    const [c3] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: /Select file/i }).first().click()]);
    await c3.setFiles([src]);
    ok('fill: a PDF without fields explains itself and offers Write on a PDF', await page.getByText(/no fillable fields/i).first().waitFor({ timeout: 10000 }).then(() => true).catch(() => false));
  }

  // ---------- OCR: a scanned page made of pixels only ----------
  {
    // draw the "scan" with a canvas in the browser (a real, anti-aliased bitmap), then wrap it in a PDF
    const dataUrl = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 1400; c.height = 700;
      const x = c.getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
      x.fillStyle = '#000'; x.font = '78px Arial, Helvetica, sans-serif';
      x.fillText('Hello OCR world', 80, 200);
      x.fillText('Invoice number 2026', 80, 340);
      x.fillText('Total due 450 dollars', 80, 480);
      return c.toDataURL('image/png');
    });
    const png = Buffer.from(dataUrl.split(',')[1], 'base64');
    const pngPath = path.join(TMP, 'scan.png');
    fs.writeFileSync(pngPath, png);
    const sd = await PDFDocument.create();
    const img = await sd.embedPng(png);
    sd.addPage([700, 350]).drawImage(img, { x: 0, y: 0, width: 700, height: 350 });
    const scanPath = path.join(TMP, 'scan.pdf');
    fs.writeFileSync(scanPath, await sd.save());
    const hasWords = (text) => ['hello', 'world', 'invoice', '2026'].filter((w) => text.toLowerCase().includes(w)).length;

    await useTool(page, '/ocr-pdf', [scanPath], async (p) => { await p.getByText('Both', { exact: true }).first().click(); }, /Read the text/);
    ok('ocr: reads a scanned PDF (first run downloads the engine)', await done(page, 180000));
    const bodyText = await page.locator('body').innerText();
    ok('ocr: the recognised text contains the words that were on the page', hasWords(bodyText) >= 3, hasWords(bodyText) + ' of 4 words');
    const outPath = await download(page);
    const outBytes = fs.readFileSync(outPath);
    const od = await PDFDocument.load(outBytes);
    const content = await pageContent(outBytes, 0);
    ok('ocr: the searchable PDF still has one page and its image', od.getPageCount() === 1 && Buffer.from(outBytes).includes('/Subtype /Image'));
    ok('ocr: the text layer is invisible (text render mode 3) and holds the words', /3 Tr/.test(content) && /\bTj\b/.test(content));

    // the site's own text extractor can now read the result
    await useTool(page, '/pdf-to-text', [outPath], async () => {}, /./);
    await done(page, 30000);
    const extracted = await page.locator('body').innerText();
    ok('ocr: "Copy text out" now finds the words in the searchable PDF', hasWords(extracted) >= 3, hasWords(extracted) + ' of 4 words');

    // a scan stored on a page with a rotation flag: the text layer must land where the words are as DISPLAYED
    {
      const rd = await PDFDocument.create();
      const rimg = await rd.embedPng(png);
      const rp = rd.addPage([350, 700]);
      rp.setRotation(degrees(90));
      rp.drawImage(rimg, { x: 350, y: 0, width: 700, height: 350, rotate: degrees(90) });
      const rotPath = path.join(TMP, 'scan-rot.pdf');
      fs.writeFileSync(rotPath, await rd.save());
      await useTool(page, '/ocr-pdf', [rotPath], async () => {}, /Read the text/);
      ok('ocr: reads a scan on a rotated page', await done(page, 120000));
      const rotOut = fs.readFileSync(await download(page));
      const pos = await page.evaluate(async (b64) => {
        const lib = window.pdfjsLib;
        const doc = await lib.getDocument({ data: Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)) }).promise;
        const pg = await doc.getPage(1);
        const vp = pg.getViewport({ scale: 1 });
        const tc = await pg.getTextContent();
        const items = tc.items.filter((i) => i.str.trim()).map((i) => { const t = lib.Util.transform(vp.transform, i.transform); return { s: i.str, x: t[4], y: t[5] }; });
        return { w: vp.width, h: vp.height, items };
      }, rotOut.toString('base64'));
      const hello = pos.items.find((i) => /hello/i.test(i.s));
      const total = pos.items.find((i) => /^total/i.test(i.s));
      // displayed page is 700 x 350 points: "Hello" sits at about x=40 (of 700), baseline about y=100; "Total" is lower, same x
      ok('ocr: on a rotated page the first word is at the top-left as displayed', !!hello && Math.abs(hello.x - 40) < 25 && hello.y > 60 && hello.y < 125, hello ? `x=${hello.x.toFixed(0)} y=${hello.y.toFixed(0)}` : 'no word');
      ok('ocr: on a rotated page a later line is below the first, at the same left edge', !!hello && !!total && total.y > hello.y + 60 && Math.abs(total.x - hello.x) < 20, total ? `x=${total.x.toFixed(0)} y=${total.y.toFixed(0)}` : 'no word');
    }

    // photos instead of a PDF
    await useTool(page, '/ocr-pdf', [pngPath], async (p) => { await p.getByText('Text file', { exact: true }).first().click(); }, /Read the text/);
    ok('ocr: reads a picture and returns text', await done(page, 120000));
    const photoText = await page.locator('body').innerText();
    ok('ocr: the text from a picture contains the words', hasWords(photoText) >= 3, hasWords(photoText) + ' of 4 words');

    // a PDF that already has text is left alone
    const texty = await makePdf('texty.pdf', 2, 'This page already contains plenty of real selectable text, so no reading is needed.');
    await useTool(page, '/ocr-pdf', [texty], async () => {}, /Read the text/);
    ok('ocr: pages that already have text are skipped', (await done(page, 120000)) && /already had text/.test(await page.locator('body').innerText()));

    // mixing a PDF and a picture is refused with a clear message
    await page.goto(BASE + '/ocr-pdf');
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: /Select file/i }).first().click()]);
    await chooser.setFiles([scanPath, pngPath]);
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: /Read the text/i }).last().click();
    ok('ocr: a PDF together with a picture is refused clearly', await errorText(page, /either one PDF or some pictures/));
  }

  // ---------- (more groups are added below as tools ship) ----------

  ok('no page errors during the tool tests', problems.length === 0, problems.slice(0, 2).join(' | '));
  await browser.close();
  fs.rmSync(TMP, { recursive: true, force: true });
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('E2E CRASH', e.message); process.exit(2); });
