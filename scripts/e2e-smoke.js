/**
 * Browser smoke test of the BUILT site (run `npm run export:web` first, serve dist/ with `npx serve dist -l 8080`).
 * Checks what crawlers see (JavaScript off) and what people get (hydration, navigation, palette, a real merge, dark mode, phone drawer).
 * Playwright is not a project dependency yet. Point PLAYWRIGHT_CORE at any playwright-core install, e.g.
 *   PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core node scripts/e2e-smoke.js
 * The merge test needs two small PDFs at dist/_test/a.pdf and dist/_test/b.pdf (create them, then delete them again).
 */
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const BASE = process.env.BASE_URL || 'http://localhost:8080';
const results = [];
const ok = (name, pass, extra = '') => { results.push({ name, pass }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`); };

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ---- A. what a crawler sees: JavaScript OFF ----
  {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const p = await ctx.newPage();
    await p.goto(BASE + '/tool/merge');
    const title = await p.title();
    ok('no-JS: title is the Merge page title', /Merge PDF/.test(title), title);
    ok('no-JS: exactly one h1', (await p.locator('h1').count()) === 1, await p.locator('h1').first().innerText());
    ok('no-JS: meta description present', ((await p.locator('meta[name=description]').getAttribute('content')) || '').length > 60);
    ok('no-JS: canonical is /tool/merge', (await p.locator('link[rel=canonical]').getAttribute('href')) === 'https://iduckpdf.com/tool/merge');
    ok('no-JS: FAQ answer text is in the HTML', (await p.content()).includes('as many as your device has memory for'.slice(0, 20)) || (await p.content()).includes('How many PDFs can I merge at once'));
    ok('no-JS: many real <a href> links', (await p.locator('a[href^="/"]').count()) > 20, String(await p.locator('a[href^="/"]').count()));
    const ld = await p.locator('script[type="application/ld+json"]').allTextContents();
    let parsed = true; try { ld.forEach((t) => JSON.parse(t)); } catch { parsed = false; }
    ok('no-JS: JSON-LD blocks parse', parsed && ld.length >= 4, `${ld.length} blocks`);
    await p.goto(BASE + '/tool/unlock');
    ok('no-JS: roadmap tool page is noindex', (await p.locator('meta[name=robots]').getAttribute('content')).includes('noindex'));
    await ctx.close();
  }

  // ---- B-G. real browser with JavaScript ----
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message.slice(0, 160)));
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) problems.push(m.type() + ': ' + m.text().slice(0, 160)); });

  await page.goto(BASE + '/');
  await page.waitForFunction(() => Object.keys(document.getElementById('root') || {}).some((k) => k.startsWith('__react')), null, { timeout: 20000 }).catch(() => {});
  const hydrated = await page.evaluate(() => Object.keys(document.getElementById('root') || {}).some((k) => k.startsWith('__react')));
  ok('home hydrates', hydrated);
  // bundle split: the PDF engine chunk (all-*.js) must not load on pages that only list tools, but must preload on a tool page
  {
    const seen = [];
    const probe = await ctx.newPage();
    probe.on('request', (r) => seen.push(r.url()));
    await probe.goto(BASE + '/'); await probe.waitForTimeout(3500);
    const isEngine = (u) => u.includes('/_expo/static/js/web/all-');
    ok('home does not download the PDF engine chunk', !seen.some(isEngine));
    seen.length = 0;
    await probe.goto(BASE + '/tool/merge'); await probe.waitForTimeout(4500);
    ok('tool page preloads the PDF engine chunk when idle', seen.some(isEngine));
    await probe.close();
  }
  const frames = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); (function f() { n++; performance.now() - t0 < 1000 ? requestAnimationFrame(f) : res(n); })(); }));
  ok('home runs at a healthy frame rate', frames > 20, `${frames} fps`);
  ok('no console errors or warnings on load', problems.length === 0, problems.slice(0, 3).join(' | '));

  // client-side navigation must not reload the document
  await page.evaluate(() => { window.__marker = 'alive'; });
  await page.locator('a[href="/tool/split"]').first().click();
  await page.waitForURL('**/tool/split');
  ok('sidebar link navigates in-app (no full reload)', (await page.evaluate(() => window.__marker)) === 'alive');
  await page.waitForFunction(() => /Split a PDF/.test(document.title), null, { timeout: 8000 }).catch(() => {});
  ok('tab title follows the page', /Split a PDF/.test(await page.title()), await page.title());
  ok('canonical path follows the page', ((await page.locator('link[rel=canonical]').getAttribute('href')) || '').endsWith('/tool/split'));

  // palette
  await page.keyboard.press('Control+K');
  const pal = page.locator('input[placeholder^="Search tools"]');
  await pal.waitFor({ timeout: 5000 }).catch(() => {});
  ok('Ctrl+K opens the palette', await pal.isVisible().catch(() => false));
  await pal.fill('watermark');
  await page.keyboard.press('Enter');
  await page.waitForURL('**/tool/text-watermark').catch(() => {});
  ok('palette search + Enter opens the tool', page.url().endsWith('/tool/text-watermark'), page.url());

  // real merge through the UI with a native file chooser
  await page.goto(BASE + '/tool/merge');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: /Choose PDF files/i }).first().click()]);
  await chooser.setFiles(['dist/_test/a.pdf', 'dist/_test/b.pdf']);
  await page.getByText('b.pdf').first().waitFor({ timeout: 5000 }).catch(() => {});
  ok('chosen files are listed', (await page.getByText('a.pdf').count()) > 0 && (await page.getByText('b.pdf').count()) > 0);
  await page.getByRole('button', { name: /Merge now/i }).click();
  await page.getByText('Done!').waitFor({ timeout: 20000 }).catch(() => {});
  ok('merge finishes', (await page.getByText('Done!').count()) > 0);
  ok('merge reports 2 files into 6 pages', (await page.getByText(/2 files merged into 6 pages/).count()) > 0);

  // dark theme persists across reloads, no hydration complaints
  await page.evaluate(() => localStorage.setItem('duck.theme', 'dark'));
  problems.length = 0;
  await page.goto(BASE + '/about');
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark', null, { timeout: 10000 }).catch(() => {});
  ok('saved dark theme is applied after reload', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark');
  ok('no hydration errors with a saved theme', problems.filter((p) => /hydrat|did not match|#418|#423|#425/i.test(p)).length === 0, problems.slice(0, 2).join(' | '));

  // phone width: drawer instead of sidebar
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(BASE + '/');
  await page.getByRole('button', { name: /Open menu/i }).waitFor({ timeout: 8000 }).catch(() => {});
  ok('phone width shows the menu button', await page.getByRole('button', { name: /Open menu/i }).isVisible().catch(() => false));
  await page.getByRole('button', { name: /Open menu/i }).click().catch(() => {});
  ok('menu button opens the drawer', (await page.locator('a[href="/tool/merge"]').count()) > 0 && await page.getByText('All tools').first().isVisible().catch(() => false));

  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('E2E CRASH', e.message); process.exit(2); });
