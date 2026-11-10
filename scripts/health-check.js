/**
 * Live-site health check (no browser needed): node scripts/health-check.js [https://iduckpdf.com]
 * Checks every sitemap URL answers 200, the old addresses redirect, www and http redirect to the apex over https,
 * the security headers are present, robots/llms/sitemap are served, and 404s are real 404s.
 * For the full browser suites against the live site run:
 *   BASE_URL=https://iduckpdf.com PLAYWRIGHT_CORE=/path/to/playwright-core node scripts/e2e-tools.js   (and e2e-smoke.js)
 * Exit code 1 if anything fails, so it can run on a schedule.
 */
const site = (process.argv[2] || 'https://iduckpdf.com').replace(/\/$/, '');
const host = new URL(site).host;
const results = [];
const ok = (name, pass, extra = '') => {
  results.push(pass);
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`);
};
const get = (url, opts = {}) => fetch(url, { redirect: 'manual', ...opts });

(async () => {
  const sm = await (await get(site + '/sitemap.xml')).text();
  const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  ok('sitemap lists the pages', urls.length >= 60, `${urls.length} URLs`);

  let bad = [];
  let slow = [];
  const offCanon = [];
  for (let i = 0; i < urls.length; i += 8) {
    await Promise.all(
      urls.slice(i, i + 8).map(async (u) => {
        const t = Date.now();
        try {
          const r = await get(u);
          if (r.status !== 200) bad.push(`${u} -> ${r.status}`);
          else {
            // the page must name itself as canonical: a canonical that redirects or differs from the sitemap URL confuses crawlers
            const canon = ((await r.text()).match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"/) || [])[1];
            if (canon !== u) offCanon.push(`${u} -> ${canon}`);
          }
          if (Date.now() - t > 3000) slow.push(u);
        } catch (e) {
          bad.push(`${u} -> ${e.message}`);
        }
      })
    );
  }
  ok('every sitemap URL answers 200', bad.length === 0, bad.slice(0, 3).join(' | '));
  ok('every sitemap URL is its own canonical', offCanon.length === 0, offCanon.slice(0, 3).join(' | '));
  ok('no page took longer than 3 seconds', slow.length === 0, slow.slice(0, 3).join(' | '));

  const redirect = async (from, to, label) => {
    const r = await get(from);
    const loc = r.headers.get('location') ? new URL(r.headers.get('location'), from).href : '';
    ok(label, [301, 308].includes(r.status) && loc === to, `${r.status} ${loc}`);
  };
  await redirect(`${site}/tool/merge`, `${site}/merge-pdf`, 'old /tool/<id> address redirects to the keyword URL');
  await redirect(`${site}/tools`, `${site}/pdf-tools`, 'old /tools address redirects to /pdf-tools');
  if (host === 'iduckpdf.com') {
    await redirect(`https://www.iduckpdf.com/merge-pdf?x=1`, `https://iduckpdf.com/merge-pdf?x=1`, 'www redirects to the apex, keeping path and query');
    await redirect(`http://iduckpdf.com/merge-pdf`, `https://iduckpdf.com/merge-pdf`, 'http redirects to https');
  }

  const home = await get(site + '/');
  const h = (n) => home.headers.get(n) || '';
  ok('security headers on the home page', /nosniff/i.test(h('x-content-type-options')) && !!h('referrer-policy') && !!h('permissions-policy'));
  const csp = h('content-security-policy');
  ok('Content-Security-Policy present, no unsafe-inline scripts', !!csp && !/script-src[^;]*'unsafe-inline'/.test(csp), csp ? '' : 'missing');
  ok('home is not marked noindex', !/noindex/i.test(h('x-robots-tag')));

  const html = await home.text();
  ok('home has a title, a canonical and one h1', /<title[^>]*>[^<]+<\/title>/.test(html) && new RegExp(`<link[^>]*rel="canonical"[^>]*href="${site}/?"`).test(html) && (html.match(/<h1[ >]/g) || []).length === 1);

  for (const p of ['/robots.txt', '/llms.txt', '/llms-full.txt', '/manifest.webmanifest', '/seo-pages.json']) {
    const r = await get(site + p);
    ok(`${p} is served`, r.status === 200);
  }
  {
    // IndexNow key file: served at /<key>.txt and containing exactly the key (the key is the file name in public/)
    const keyFile = require('fs').readdirSync(require('path').join(__dirname, '..', 'public')).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
    const r = keyFile ? await get(site + '/' + keyFile) : null;
    ok('IndexNow key file is served and names itself', !!r && r.status === 200 && (await r.text()).trim() === keyFile.replace('.txt', ''));
  }
  const gone = await get(site + '/this-page-does-not-exist');
  ok('an unknown address is a real 404', gone.status === 404);

  const failed = results.filter((x) => !x).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error('HEALTH CHECK CRASH', e.message);
  process.exit(2);
});
