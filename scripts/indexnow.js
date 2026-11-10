/**
 * Tells IndexNow engines (Bing, Yandex, Seznam, Naver and others share one endpoint) which pages exist or changed.
 *   node scripts/indexnow.js [--dry-run] [--all]        (run after the site is deployed)
 *
 * Ownership is proved by a key file served from the site root: public/<key>.txt containing exactly <key>.
 * The key is not a secret. The script finds it in dist/, submits the URLs of dist/sitemap.xml, and exits 0 even when the
 * service is unreachable (a failed ping must never fail a deploy), unless the key file itself is missing.
 *
 * Unless --all is given, it skips the ping when the last commit only touched documentation, so engines are not told about
 * pages that did not change.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SITE = 'https://iduckpdf.com';
const dist = path.join(__dirname, '..', 'dist');
const dry = process.argv.includes('--dry-run');
const all = process.argv.includes('--all');

const keyFile = fs.readdirSync(dist).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) {
  console.error('IndexNow: no <key>.txt in dist (expected a 32-character hex file name from public/).');
  process.exit(1);
}
const key = keyFile.replace(/\.txt$/, '');
if (fs.readFileSync(path.join(dist, keyFile), 'utf8').trim() !== key) {
  console.error('IndexNow: the key file does not contain its own name.');
  process.exit(1);
}

if (!all) {
  try {
    const changed = execSync('git diff --name-only HEAD~1 HEAD', { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
    const docsOnly = changed.length > 0 && changed.every((f) => /^(docs\/|\.claude\/|README\.md$)/.test(f));
    if (docsOnly) {
      console.log(`IndexNow: only documentation changed (${changed.length} file(s)); nothing to ping.`);
      process.exit(0);
    }
  } catch {
    // no usable git history: ping anyway
  }
}

const sitemap = fs.readFileSync(path.join(dist, 'sitemap.xml'), 'utf8');
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => u.startsWith(SITE + '/'));
const body = { host: new URL(SITE).host, key, keyLocation: `${SITE}/${keyFile}`, urlList };

if (dry) {
  console.log(`IndexNow (dry run): would send ${urlList.length} URLs, key ${key.slice(0, 6)}..., keyLocation ${body.keyLocation}`);
  process.exit(0);
}

(async () => {
  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
    });
    // 200 and 202 mean accepted; 403 means the key file could not be verified (is it deployed yet?); 422 means a bad URL list; 429 too many requests
    console.log(`IndexNow: ${res.status} ${res.statusText} for ${urlList.length} URLs`);
    if (res.status !== 200 && res.status !== 202) console.log(`IndexNow: not accepted. ${(await res.text()).slice(0, 200)}`);
  } catch (e) {
    console.log(`IndexNow: could not reach the service (${e.message}); skipped.`);
  }
})();
