/**
 * Browser tests for the newer tools (password, sign, fill, OCR, Office conversions) against the BUILT site.
 *   npm run export:web, then serve dist/ (for example `npx serve dist -l 8080`), then
 *   PLAYWRIGHT_CORE=/path/to/playwright-core BASE_URL=http://localhost:8080 node scripts/e2e-tools.js
 * Test files are generated here with pdf-lib, so nothing needs to be checked in.
 */
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const engine = pw[process.env.BROWSER || 'chromium']; // BROWSER=firefox or webkit runs the same checks in another engine
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

/** A PNG made here (no image library needed): colour comes from fn(x, y) -> [r, g, b]. */
function makeFnPng(w, h, fn) {
  const zlib = require('zlib');
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const c = fn(x, y);
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2];
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
async function makeImagePdf(name, pages, fn) {
  const d = await PDFDocument.create();
  const img = await d.embedPng(makeFnPng(900, 1200, fn));
  for (let i = 0; i < pages; i++) d.addPage([595, 842]).drawImage(img, { x: 0, y: 0, width: 595, height: 842 });
  const out = path.join(TMP, name);
  fs.writeFileSync(out, await d.save());
  return out;
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

/** Text of a PDF as the site's own "Copy text out" tool reads it. */
async function textOf(page, pdfPath) {
  await useTool(page, '/pdf-to-text', [pdfPath], async () => {}, /./);
  await done(page, 30000);
  return page.locator('body').innerText();
}
/** A small solid-colour PNG, written by hand (zlib + CRC), so no image library is needed. */
function makePng(name, w, h, rgb) {
  const zlib = require('zlib');
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, (_, x) => rgb.map((v, i) => (x % 7 === 0 ? 255 - v : v))).flat())]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  const p = path.join(TMP, name);
  fs.writeFileSync(p, png);
  return p;
}
/** Pick one file per drop zone, in order, for tools that take two inputs (for example a PDF and a picture). */
async function useTool2(page, url, files, fill = async () => {}, runName = /./) {
  await page.goto(BASE + url);
  for (let i = files.length - 1; i >= 0; i--) {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: /Select file/i }).nth(i).click()]);
    await chooser.setFiles(files[i]);
    await page.waitForTimeout(300);
  }
  await fill(page);
  await page.getByRole('button', { name: runName }).last().click();
}
const imageCount = async (bytes, pageIndex) => (await pageContent(bytes, pageIndex)).match(/ Do/g)?.length || 0;
const fillPasswords = (a, b) => async (page) => {
  const boxes = page.locator('input[type=password]');
  await boxes.nth(0).fill(a);
  if (b !== undefined) await boxes.nth(1).fill(b);
};

(async () => {
  const browser = await engine.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1800 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message.slice(0, 160)));
  page.on('console', (m) => { if (/Content.Security.Policy|Refused to/i.test(m.text())) problems.push('CSP: ' + m.text().slice(0, 200)); });

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
    await page.waitForTimeout(400); // WebKit finishes the last pointer events a moment later
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

  // ---------- Web page to PDF and Word to PDF (real DOM parser in the browser) ----------
  {
    await page.goto(BASE + '/html-to-pdf', { waitUntil: 'networkidle' }); // WebKit hydrates later: fill only after, or hydration clears the box
    await page.waitForTimeout(800);
    await page.locator('textarea').first().fill('<html><body><h1>Main Title</h1><p>Hello <b>bold</b> world with <a href="https://example.com">a link</a>.</p><ul><li>Alpha</li><li>Beta</li></ul><table><tr><th>Name</th><th>Qty</th></tr><tr><td>Apple</td><td>3</td></tr></table></body></html>');
    await page.getByRole('button', { name: /Convert to PDF/i }).last().click();
    ok('html: pasted HTML converts', await done(page));
    const htmlPdf = await download(page);
    const ht = await textOf(page, htmlPdf);
    ok('html: the PDF has the headline, paragraph, list and table text', ['Main Title', 'bold', 'Alpha', 'Beta', 'Apple'].every((w) => ht.includes(w)));

    await page.goto(BASE + '/html-to-pdf');
    await page.getByRole('button', { name: /Convert to PDF/i }).last().click();
    ok('html: nothing to convert gives a clear message', await errorText(page, /Add a saved web page/));

    const JSZip = require('jszip');
    const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
    const z = new JSZip();
    z.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>');
    z.file('word/document.xml', '<?xml version="1.0" encoding="UTF-8"?><w:document ' + NS + '><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Quarterly Report</w:t></w:r></w:p><w:p><w:r><w:t>Revenue grew steadily across all regions this quarter.</w:t></w:r></w:p><w:tbl><w:tblGrid><w:gridCol w:w="3000"/><w:gridCol w:w="3000"/></w:tblGrid><w:tr><w:tc><w:p><w:r><w:t>Region</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Growth</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>');
    z.file('word/styles.xml', '<?xml version="1.0"?><w:styles ' + NS + '><w:style w:type="paragraph" w:styleId="Heading1"><w:rPr><w:b/><w:sz w:val="40"/></w:rPr></w:style></w:styles>');
    const docxPath = path.join(TMP, 'report.docx');
    fs.writeFileSync(docxPath, await z.generateAsync({ type: 'nodebuffer' }));
    await useTool(page, '/word-to-pdf', [docxPath], async () => {}, /Convert to PDF/);
    ok('word: a .docx converts in the browser', await done(page));
    const wordPdf = await download(page);
    const wt = await textOf(page, wordPdf);
    ok('word: the PDF has the heading, paragraph and table text', ['Quarterly Report', 'Revenue grew steadily', 'Region', 'Growth'].every((w) => wt.includes(w)));

    fs.writeFileSync(path.join(TMP, 'notword.docx'), 'this is not a zip file');
    await useTool(page, '/word-to-pdf', [path.join(TMP, 'notword.docx')], async () => {}, /Convert to PDF/);
    ok('word: a file that is not a Word document gets a clear message', await errorText(page, /does not look like a \.docx/));
  }

  // ---------- Excel to PDF and PDF to Excel ----------
  {
    const JSZip2 = require('jszip');
    const x = new JSZip2();
    x.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>');
    x.file('xl/workbook.xml', '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Budget" sheetId="1" r:id="rId1"/></sheets></workbook>');
    x.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/></Relationships>');
    x.file('xl/sharedStrings.xml', '<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Category</t></si><si><t>Amount</t></si><si><t>Rent</t></si><si><t>Food</t></si></sst>');
    x.file('xl/styles.xml', '<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="164"/></cellXfs></styleSheet>');
    x.file('xl/worksheets/sheet1.xml', '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" s="1"><v>1250.5</v></c></row><row r="3"><c r="A3" t="s"><v>3</v></c><c r="B3" s="1"><v>310</v></c></row></sheetData></worksheet>');
    const xlsxPath = path.join(TMP, 'budget.xlsx');
    fs.writeFileSync(xlsxPath, await x.generateAsync({ type: 'nodebuffer' }));
    await useTool(page, '/excel-to-pdf', [xlsxPath], async () => {}, /Convert to PDF/);
    ok('excel: an .xlsx converts in the browser', await done(page));
    const xt = await textOf(page, await (async () => { await useTool(page, '/excel-to-pdf', [xlsxPath], async () => {}, /Convert to PDF/); await done(page); return download(page); })());
    ok('excel: the PDF has the sheet name, headers, rows and formatted amounts', ['Budget', 'Category', 'Amount', 'Rent', '1,250.50', 'Food', '310.00'].every((w) => xt.includes(w)));
    fs.writeFileSync(path.join(TMP, 'data.csv'), 'City;Population\nOslo;709,037\nBergen;285,911\n');
    await useTool(page, '/excel-to-pdf', [path.join(TMP, 'data.csv')], async () => {}, /Convert to PDF/);
    ok('csv: a CSV converts in the browser', await done(page));

    // PDF to Excel: build a small statement and read the workbook back
    const td = await PDFDocument.create();
    const tfont = await td.embedFont(StandardFonts.Helvetica);
    const tpg = td.addPage([595, 842]);
    const at = (t, px, py) => tpg.drawText(t, { x: px, y: py, size: 11, font: tfont });
    at('Item', 50, 740); at('Qty', 260, 740); at('Price', 360, 740);
    at('Apple', 50, 720); at('3', 268, 720); at('1,200.50', 345, 720);
    at('Pear', 50, 700); at('12', 262, 700); at('9.99', 362, 700);
    const stmtPath = path.join(TMP, 'statement.pdf');
    fs.writeFileSync(stmtPath, await td.save());
    await useTool(page, '/pdf-to-excel', [stmtPath], async () => {}, /Convert to Excel/);
    ok('pdf to excel: a PDF converts in the browser', await done(page));
    const xlsxOut = fs.readFileSync(await download(page));
    const zz = await JSZip2.loadAsync(xlsxOut);
    const sheetXml = await zz.file('xl/worksheets/sheet1.xml').async('string');
    ok('pdf to excel: the workbook has the table, with real numbers', ['Apple', 'Pear', 'Item', '<v>1200.5</v>', '<v>12</v>', '<v>9.99</v>'].every((w) => sheetXml.includes(w)), sheetXml.slice(0, 120));
    ok('pdf to excel: the workbook is a complete .xlsx (workbook, styles, content types)', !!zz.file('xl/workbook.xml') && !!zz.file('xl/styles.xml') && !!zz.file('[Content_Types].xml'));
    const blankPdf = await PDFDocument.create();
    blankPdf.addPage([300, 300]);
    const blankPath = path.join(TMP, 'blank.pdf');
    fs.writeFileSync(blankPath, await blankPdf.save());
    await useTool(page, '/pdf-to-excel', [blankPath], async () => {}, /Convert to Excel/);
    ok('pdf to excel: a PDF with no text points to OCR', await errorText(page, /Read scans \(OCR\)/));
  }

  // ---------- PDF to Word and PowerPoint to PDF ----------
  {
    const JSZip3 = require('jszip');
    const d = await PDFDocument.create();
    const bf = await d.embedFont(StandardFonts.HelveticaBold);
    const rf = await d.embedFont(StandardFonts.Helvetica);
    const dp = d.addPage([595, 842]);
    dp.drawText('Meeting Minutes', { x: 50, y: 780, size: 26, font: bf });
    dp.drawText('The team agreed on the plan for next quarter and', { x: 50, y: 740, size: 11, font: rf });
    dp.drawText('will review progress every Friday morning.', { x: 50, y: 726, size: 11, font: rf });
    dp.drawText('Owner', { x: 50, y: 680, size: 11, font: rf }); dp.drawText('Task', { x: 250, y: 680, size: 11, font: rf });
    dp.drawText('Anna', { x: 50, y: 662, size: 11, font: rf }); dp.drawText('Write the brief', { x: 250, y: 662, size: 11, font: rf });
    dp.drawText('Raj', { x: 50, y: 644, size: 11, font: rf }); dp.drawText('Book the room', { x: 250, y: 644, size: 11, font: rf });
    const minutes = path.join(TMP, 'minutes.pdf');
    fs.writeFileSync(minutes, await d.save());
    await useTool(page, '/pdf-to-word', [minutes], async () => {}, /Convert to Word/);
    ok('pdf to word: a PDF converts in the browser', await done(page));
    const docxOut = fs.readFileSync(await download(page));
    const dzip = await JSZip3.loadAsync(docxOut);
    const dxml = await dzip.file('word/document.xml').async('string');
    ok('pdf to word: the .docx has a heading, the paragraph joined up, and a table', /Heading1/.test(dxml) && dxml.includes('Meeting Minutes') && dxml.includes('will review progress every Friday') && /<w:tbl>/.test(dxml) && dxml.includes('Write the brief'));
    const docxPath = path.join(TMP, 'minutes.docx');
    fs.writeFileSync(docxPath, docxOut);
    await useTool(page, '/word-to-pdf', [docxPath], async () => {}, /Convert to PDF/);
    ok('pdf to word: the result opens again as a Word document (round trip in the browser)', await done(page));

    const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
    const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    const rels = (items) => '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + items.map(([id, ty, tg]) => '<Relationship Id="' + id + '" Type="' + REL + '/' + ty + '" Target="' + tg + '"/>').join('') + '</Relationships>';
    const z = new JSZip3();
    z.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>');
    z.file('ppt/presentation.xml', '<?xml version="1.0"?><p:presentation ' + NS + '><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/></p:presentation>');
    z.file('ppt/_rels/presentation.xml.rels', rels([['rId1', 'slide', 'slides/slide1.xml'], ['rId2', 'theme', 'theme/theme1.xml']]));
    z.file('ppt/theme/theme1.xml', '<?xml version="1.0"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:themeElements><a:clrScheme name="t"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F3864"/></a:dk2><a:lt2><a:srgbClr val="EEEEEE"/></a:lt2><a:accent1><a:srgbClr val="ED7D31"/></a:accent1></a:clrScheme></a:themeElements></a:theme>');
    z.file('ppt/slides/slide1.xml', '<?xml version="1.0"?><p:sld ' + NS + '><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="T"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="800000" y="600000"/><a:ext cx="10000000" cy="1000000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="4000" b="1"/><a:t>Launch Plan</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="B"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="800000" y="2000000"/><a:ext cx="4000000" cy="1200000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></p:spPr><p:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:r><a:rPr sz="2400"/><a:t>Phase one ships in May</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>');
    const pptxPath = path.join(TMP, 'deck.pptx');
    fs.writeFileSync(pptxPath, await z.generateAsync({ type: 'nodebuffer' }));
    await useTool(page, '/powerpoint-to-pdf', [pptxPath], async () => {}, /Convert to PDF/);
    ok('pptx: a .pptx converts in the browser', await done(page));
    const slidePdf = await download(page);
    const slidePages = await PDFDocument.load(fs.readFileSync(slidePdf));
    const sp = slidePages.getPage(0).getSize();
    ok('pptx: the PDF page is the slide size (16:9, 960 x 540 pt)', slidePages.getPageCount() === 1 && Math.abs(sp.width - 960) < 1 && Math.abs(sp.height - 540) < 1, sp.width + 'x' + sp.height);
    const st = await textOf(page, slidePdf);
    ok('pptx: the slide text is in the PDF', st.includes('Launch Plan') && st.includes('Phase one ships in May'));
    fs.writeFileSync(path.join(TMP, 'bad.pptx'), 'not a zip');
    await useTool(page, '/powerpoint-to-pdf', [path.join(TMP, 'bad.pptx')], async () => {}, /Convert to PDF/);
    ok('pptx: a file that is not a PowerPoint file gets a clear message', await errorText(page, /does not look like a \.pptx/));
  }

  // ---------- the older tools: pictures to PDF, scan, grayscale, redact, compare, logo stamp ----------
  {
    const red = makePng('red.png', 120, 80, [200, 30, 30]);
    const blue = makePng('blue.png', 60, 90, [30, 40, 200]);

    await useTool(page, '/image-to-pdf', [red, blue], async () => {}, /Make PDF/);
    ok('photos to PDF: finishes', await done(page));
    const photosBytes = fs.readFileSync(await download(page));
    const photosDoc = await PDFDocument.load(photosBytes);
    ok('photos to PDF: one page per picture, each with its picture', photosDoc.getPageCount() === 2 && (await imageCount(photosBytes, 0)) >= 1 && (await imageCount(photosBytes, 1)) >= 1);

    await useTool(page, '/scan-to-pdf', [red], async () => {}, /Make PDF/);
    ok('scan to PDF: finishes', await done(page));
    const scanDoc = await PDFDocument.load(fs.readFileSync(await download(page)));
    ok('scan to PDF: a one-page PDF', scanDoc.getPageCount() === 1);

    const coloured = await (async () => {
      const d = await PDFDocument.create();
      const f = await d.embedFont(StandardFonts.Helvetica);
      for (let i = 1; i <= 2; i++) {
        const pg = d.addPage([400, 300]);
        pg.drawRectangle({ x: 20, y: 150, width: 200, height: 100, color: require('pdf-lib').rgb(0.9, 0.1, 0.1) });
        pg.drawText('Account SECRET-4412 confidential on page ' + i, { x: 30, y: 100, size: 14, font: f });
      }
      const p = path.join(TMP, 'coloured.pdf');
      fs.writeFileSync(p, await d.save());
      return p;
    })();

    await useTool(page, '/grayscale-pdf', [coloured], async () => {}, /Restyle now/);
    ok('grayscale: finishes', await done(page, 60000));
    const grayBytes = fs.readFileSync(await download(page));
    const grayDoc = await PDFDocument.load(grayBytes);
    ok('grayscale: both pages kept, each redrawn as a picture', grayDoc.getPageCount() === 2 && (await imageCount(grayBytes, 0)) >= 1);

    await useTool(page, '/redact-pdf', [coloured], async () => {}, /Redact now/);
    ok('redact: asking for nothing shows a clear message', await errorText(page, /at least one word/));

    await useTool(page, '/redact-pdf', [coloured], async (p) => { await p.locator('textarea').first().fill('SECRET-4412'); }, /Redact now/);
    ok('redact: finishes', await done(page, 60000));
    const redactedPath = await download(page);
    const redactedBytes = fs.readFileSync(redactedPath);
    ok('redact: pages are pictures with no text left in the file', !Buffer.from(redactedBytes).toString('latin1').includes('SECRET') && (await imageCount(redactedBytes, 0)) >= 1);
    const leftover = await textOf(page, redactedPath);
    ok('redact: the site own text reader finds nothing of the hidden word', !/SECRET-4412/.test(leftover));

    const v1 = await makePdf('v1.pdf', 2, 'Alpha');
    const v2 = await (async () => {
      const d = await PDFDocument.create();
      const f = await d.embedFont(StandardFonts.Helvetica);
      d.addPage([400, 500]).drawText('Alpha page 1', { x: 30, y: 440, size: 20, font: f });
      d.addPage([400, 500]).drawText('Omega page 2 changed', { x: 30, y: 440, size: 20, font: f });
      const p = path.join(TMP, 'v2.pdf');
      fs.writeFileSync(p, await d.save());
      return p;
    })();
    await useTool2(page, '/compare-pdf', [v1, v2], async () => {}, /Compare now/);
    ok('compare: finishes', await done(page));
    const cmp = await page.locator('body').innerText();
    ok('compare: lists the removed and the added line on page 2 and leaves page 1 alone', /Page 2/.test(cmp) && /Alpha page 2/.test(cmp) && /Omega page 2 changed/.test(cmp) && !/=== Page 1 ===/.test(cmp));

    await useTool2(page, '/add-logo-to-pdf', [src, red], async () => {}, /Place now/);
    ok('logo stamp: finishes', await done(page));
    const logoBytes = fs.readFileSync(await download(page));
    const logoDoc = await PDFDocument.load(logoBytes);
    const corners = (await imageCount(logoBytes, 0)) >= 1 ? await imageCorners(logoBytes, 0) : null;
    const inside = !!corners && corners.every(([x, y]) => x >= -1 && x <= 401 && y >= -1 && y <= 501);
    ok('logo stamp: 3 pages kept, the picture sits inside the first page', logoDoc.getPageCount() === 3 && inside);
  }

  // ---------- picture tools: extract pictures, PDF to PowerPoint, PDF to JPG, JPG to PDF, merge PDFs and pictures ----------
  {
    const JSZip4 = require('jszip');
    const zlib = require('zlib');
    const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
    const crc = (b) => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
    const chunk = (t, body) => { const o = Buffer.alloc(12 + body.length); o.writeUInt32BE(body.length, 0); o.write(t, 4, 'latin1'); body.copy(o, 8); o.writeUInt32BE(crc(o.subarray(4, 8 + body.length)), 8 + body.length); return o; };
    const makePng = (w, h) => {
      const raw = Buffer.alloc((w * 3 + 1) * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * (w * 3 + 1) + 1 + x * 3; raw[i] = x * 4; raw[i + 1] = y * 4; raw[i + 2] = 120; }
      const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
      return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
    };
    const pngPath = path.join(TMP, 'photo.png');
    fs.writeFileSync(pngPath, makePng(64, 64));
    const d = await PDFDocument.create();
    const hf = await d.embedFont(StandardFonts.HelveticaBold);
    const img = await d.embedPng(makePng(64, 64));
    const pa = d.addPage([595, 842]);
    pa.drawText('Annual Report', { x: 50, y: 780, size: 26, font: hf });
    pa.drawImage(img, { x: 50, y: 500, width: 128, height: 128 });
    d.addPage([595, 842]).drawText('Second page', { x: 50, y: 780, size: 20, font: hf });
    const pics = path.join(TMP, 'pics.pdf');
    fs.writeFileSync(pics, await d.save());

    await useTool(page, '/extract-images-from-pdf', [pics], async () => {}, /Extract pictures/);
    ok('extract pictures: a PDF with a picture runs in the browser', await done(page));
    const ex = fs.readFileSync(await download(page));
    ok('extract pictures: the picture comes out as a PNG file', ex[0] === 0x89 && ex[1] === 0x50);
    await useTool(page, '/extract-images-from-pdf', [await makePdf('textonly.pdf', 1, 'Words')], async () => {}, /Extract pictures/);
    ok('extract pictures: a PDF with no pictures gets advice, not a blank result', await errorText(page, /No pictures could be extracted/));

    await useTool(page, '/pdf-to-powerpoint', [pics], async () => {}, /Convert to PowerPoint/);
    ok('pdf to powerpoint: exact look converts in the browser', await done(page));
    const pz = await JSZip4.loadAsync(fs.readFileSync(await download(page)));
    const jpg = await pz.file('ppt/media/image1.jpg').async('uint8array');
    ok('pdf to powerpoint: exact look gives one picture slide per page', !!pz.file('ppt/slides/slide2.xml') && jpg[0] === 0xff && jpg[1] === 0xd8);
    await useTool(page, '/pdf-to-powerpoint', [pics], async (p) => { await p.getByText('Editable text (text in boxes)').first().click(); }, /Convert to PowerPoint/);
    ok('pdf to powerpoint: editable text converts in the browser', await done(page));
    const tz = await JSZip4.loadAsync(fs.readFileSync(await download(page)));
    const sx = await tz.file('ppt/slides/slide1.xml').async('string');
    ok('pdf to powerpoint: editable text puts the words in text boxes', sx.includes('<a:t>Annual Report</a:t>') && !tz.file('ppt/media/image1.jpg'));

    await useTool(page, '/pdf-to-jpg', [pics], async () => {}, /Convert to JPG/);
    ok('pdf to jpg: a PDF converts in the browser', await done(page));
    const jz = await JSZip4.loadAsync(fs.readFileSync(await download(page)));
    const jnames = Object.keys(jz.files);
    const j0 = await jz.file(jnames[0]).async('uint8array');
    ok('pdf to jpg: one JPG per page in a ZIP', jnames.length === 2 && jnames.every((n) => n.endsWith('.jpg')) && j0[0] === 0xff && j0[1] === 0xd8, jnames.join(', '));

    await useTool(page, '/jpg-to-pdf', [pngPath], async () => {}, /Make PDF/);
    ok('jpg to pdf: a picture becomes a PDF in the browser', await done(page));
    ok('jpg to pdf: the result is a one-page PDF', (await PDFDocument.load(fs.readFileSync(await download(page)))).getPageCount() === 1);

    await useTool(page, '/merge-pdf-and-images', [pics, pngPath], async () => {}, /Merge now/);
    ok('merge pdf and pictures: a PDF and a picture merge in the browser', await done(page));
    ok('merge pdf and pictures: 2 PDF pages + 1 picture = 3 pages', (await PDFDocument.load(fs.readFileSync(await download(page)))).getPageCount() === 3);
  }

  // ---------- AI tools, against a FAKE provider: the key is seeded in the page and the provider URLs are intercepted ----------
  {
    const JSZip5 = require('jszip');
    const sent = [];
    let answer = () => '';
    const ctx5 = await browser.newContext({ acceptDownloads: true });
    await ctx5.addInitScript(() => { try { localStorage.setItem('duck.ai', JSON.stringify({ provider: 'openai', key: 'sk-fake-key', model: 'fake-model' })); } catch {} });
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
    await ctx5.route('https://api.openai.com/**', async (route) => {
      const req = route.request();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      const body = JSON.parse(req.postData() || '{}');
      sent.push({ auth: req.headers()['authorization'], system: body.messages[0].content, prompt: body.messages[body.messages.length - 1].content });
      await route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ choices: [{ message: { content: answer(body) } }] }) });
    });
    const aiPage = await ctx5.newPage();
    const aiProblems = [];
    aiPage.on('pageerror', (e) => aiProblems.push(e.message));
    aiPage.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) aiProblems.push(m.text()); });
    const doc = await makePdf('aidoc.pdf', 2, 'Hello');

    answer = (b) => b.messages[b.messages.length - 1].content.replace(/Hello/g, 'Hola');
    await useTool(aiPage, '/translate-pdf', [doc], async () => {}, /Translate$/);
    ok('translate: runs in the browser against the fake provider', await done(aiPage));
    ok('translate: the key went to the provider and the text was sent', sent.length === 1 && sent[0].auth === 'Bearer sk-fake-key' && /Hello page 1/.test(sent[0].prompt), JSON.stringify(sent[0] || {}).slice(0, 120));
    ok('translate: the translation is shown on the page', await aiPage.getByText(/Hola page 1/).first().waitFor({ timeout: 5000 }).then(() => true).catch(() => false));
    const tpdf = await download(aiPage);
    ok('translate: a PDF is offered for Spanish', (await PDFDocument.load(fs.readFileSync(tpdf))).getPageCount() >= 1);

    answer = () => '[{"q":"Greeting?","a":"Hello"},{"q":"Page?","a":"Two"}]';
    await useTool(aiPage, '/pdf-to-flashcards', [doc], async () => {}, /Make study material/);
    ok('flashcards: runs in the browser against the fake provider', await done(aiPage));
    const csvPath = await download(aiPage);
    ok('flashcards: the CSV has the cards', /Greeting\?,Hello/.test(fs.readFileSync(csvPath, 'utf8')));

    answer = () => '{"columns":["Item","Qty","Page"],"rows":[["Pen","2",1],["Book",1,2]]}';
    await useTool(aiPage, '/extract-data-from-pdf', [doc], async () => {}, /Pull out the data/);
    ok('pull data: runs in the browser against the fake provider', await done(aiPage));
    const xz = await JSZip5.loadAsync(fs.readFileSync(await download(aiPage)));
    const sheet = await xz.file('xl/worksheets/sheet1.xml').async('string');
    ok('pull data: the workbook has the rows, numbers as numbers', sheet.includes('<v>2</v>') && /Pen/.test(sheet) && /Item/.test(sheet));

    // an unusable answer must give a clear message
    answer = () => 'sorry, no';
    await useTool(aiPage, '/extract-data-from-pdf', [doc], async () => {}, /Pull out the data/);
    ok('pull data: an unusable AI answer gives a clear message', await errorText(aiPage, /cut off or was not in the expected form/));

    const noKey = await browser.newContext();
    const np = await noKey.newPage();
    await useTool(np, '/translate-pdf', [doc], async () => {}, /Translate$/);
    ok('translate: without a key the tool says so and offers Settings', await errorText(np, /Add your own API key in Settings/) && (await np.getByRole('link', { name: /Open Settings/ }).count()) > 0);
    ok('no page errors in the AI tool tests', aiProblems.length === 0, aiProblems.slice(0, 2).join(' | '));
    await noKey.close();
    await ctx5.close();
  }

  // ---------- landing pages: the compress-to-a-size pages and the keyword H1 ----------
  {
    await page.goto(BASE + '/compress-pdf');
    ok('tool page: the H1 is the searched phrase', (await page.locator('h1').first().innerText()).trim() === 'Compress PDF');
    await page.goto(BASE + '/compress-pdf-to-100kb');
    ok('size page: H1 and the 100 KB target is preset', (await page.locator('h1').first().innerText()).includes('Compress PDF to 100 KB') && (await page.getByText('Under 100 KB').count()) > 0);
    // smooth artwork can reach the target; noise cannot, and the tool must say so
    const smooth = await makeImagePdf('smooth.pdf', 2, (x, y) => [(x >> 2) & 255, (y >> 2) & 255, 128]);
    await useTool(page, '/compress-pdf-to-100kb', [smooth], async () => {}, /Shrink now/);
    ok('size page: a smooth scan is brought under 100 KB', await done(page, 90000));
    const small = await download(page);
    ok('size page: the result really is under 100 KB', fs.statSync(small).size <= 100 * 1024, String(fs.statSync(small).size));
    const noise = await makeImagePdf('noise.pdf', 12, () => [Math.random() * 256, Math.random() * 256, Math.random() * 256]);
    await useTool(page, '/compress-pdf-to-100kb', [noise], async () => {}, /Shrink now/);
    const finished = await done(page, 170000);
    const reported = finished && (await page.getByText(/could not get under/i).first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false));
    ok('size page: an unreachable target is reported honestly', reported, finished ? (await page.locator('body').innerText()).replace(/\s+/g, ' ').match(/Done!.{0,300}/)?.[0] : 'did not finish');
    await page.goto(BASE + '/iduckpdf-vs-ilovepdf');
    ok('comparison page: table, sources and date are in the page', (await page.locator('table').count()) === 1 && (await page.getByText('Sources').count()) > 0 && (await page.getByText(/Last reviewed 2026-/).count()) > 0);
  }

  // ---------- text extras: word counter, Bates numbering, PDF to Markdown ----------
  {
    const src = await makePdf('extras.pdf', 2, 'Hello brave new world');
    await useTool(page, '/pdf-word-counter', [src], async () => {}, /Count now/);
    ok('word counter: finishes and shows the counts', (await done(page)) && (await page.getByText(/Words: \d+/).first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false)));
    await useTool(page, '/bates-numbering-pdf', [src], async () => {}, /Add numbers/);
    ok('bates: finishes and says which numbers were stamped', (await done(page)) && (await page.getByText(/CASE-000001 to CASE-000002/).first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false)));
    const stamped = await download(page);
    ok('bates: the downloaded PDF has two pages', (await PDFDocument.load(fs.readFileSync(stamped))).getPageCount() === 2);
    await useTool(page, '/pdf-to-markdown', [src], async () => {}, /Convert now/);
    ok('markdown: finishes and shows the text', (await done(page)) && (await page.getByText(/Hello brave new world/).first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false)));
  }

  // ---------- (more groups are added below as tools ship) ----------

  // the Content-Security-Policy is really in force: an injected inline script must be blocked (set by the server from _headers)
  {
    const before = problems.length;
    await page.goto(BASE + '/');
    const blocked = await page.evaluate(() => new Promise((resolve) => {
      const el = document.createElement('script');
      el.textContent = 'window.__cspRan = 1';
      document.head.appendChild(el);
      setTimeout(() => resolve(!window.__cspRan), 150);
    }));
    ok('CSP: an injected inline script is blocked', blocked);
    problems.splice(before); // that violation was on purpose
  }

  ok('no page errors during the tool tests', problems.length === 0, problems.slice(0, 2).join(' | '));
  await browser.close();
  fs.rmSync(TMP, { recursive: true, force: true });
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('E2E CRASH', e.stack || e.message); process.exit(2); });
