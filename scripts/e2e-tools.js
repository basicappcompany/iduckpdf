/**
 * Browser tests for the newer tools (password, sign, fill, OCR, Office conversions) against the BUILT site.
 *   npm run export:web, then serve dist/ (for example `npx serve dist -l 8080`), then
 *   PLAYWRIGHT_CORE=/path/to/playwright-core BASE_URL=http://localhost:8080 node scripts/e2e-tools.js
 * Test files are generated here with pdf-lib, so nothing needs to be checked in.
 */
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { PDFDocument, StandardFonts } = require('pdf-lib');
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
const fillPasswords = (a, b) => async (page) => {
  const boxes = page.locator('input[type=password]');
  await boxes.nth(0).fill(a);
  if (b !== undefined) await boxes.nth(1).fill(b);
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
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

  // ---------- (more groups are added below as tools ship) ----------

  ok('no page errors during the tool tests', problems.length === 0, problems.slice(0, 2).join(' | '));
  await browser.close();
  fs.rmSync(TMP, { recursive: true, force: true });
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('E2E CRASH', e.message); process.exit(2); });
