# TODO: credentials, stubs and decisions waiting on you

Anything here is deliberately stubbed so the build is never blocked on a credential.
Tick items off and update `TRACKER.md` when done.

## 1. Feedback & feature requests (email)
- [x] `hello@iduckpdf.com` (`SITE.feedbackEmail`) now forwards to basicappcompany@gmail.com through Cloudflare Email Routing (MX + SPF published 2026-11-09; the catch-all is off, so only `hello@` is accepted). The first test message landed in Spam (forwarded mail from a new domain), so a Gmail filter on basicappcompany@gmail.com now never sends `to:(hello@iduckpdf.com)` to Spam and marks it important (created 2026-11-09). Still to do: mark the first test as Not spam, send a fresh test from another account and confirm it reaches the inbox. *Optional:* the leftover `_dmarc` TXT record (p=quarantine, reports to a GoDaddy address) can become `v=DMARC1; p=none; rua=mailto:hello@iduckpdf.com`; it matters once you send as `hello@`.
- [ ] *Later:* Gmail "Send mail as" so replies come from `hello@iduckpdf.com`: create an app password at myaccount.google.com/apppasswords, then Gmail Settings → Accounts and Import → Add another email address (SMTP `smtp.gmail.com`, port 587, TLS, username basicappcompany@gmail.com, the app password). Gmail's mail is not covered by the Cloudflare SPF record, so also add `include:_spf.google.com` to the SPF TXT record or replies may land in spam.
- [ ] *Later:* replace the `mailto:` flow (`src/lib/mail.ts`) with a small serverless endpoint so people without a mail app can submit too.

## 2. Donate button (Dodo Payments)
Code is done; it stays **off** until the steps below are complete.
- [ ] Create a Dodo Payments account and use **test mode** first.
- [ ] In the dashboard, create a **one-time product with Pay What You Want enabled** (USD, minimum $1). Copy its id (`pdt_…`).
- [ ] Create an API key (Developer → API Keys).
- [ ] On the host (Cloudflare Pages → Settings → Environment variables) set:
  - `DODO_PAYMENTS_API_KEY`: secret key (never commit it, never put it in `src/`)
  - `DODO_DONATION_PRODUCT_ID`: the `pdt_…` id
  - `DODO_API_BASE`: optional; `https://test.dodopayments.com` (default). Use the live base URL when going live; confirm it in Dodo’s docs.
  - `SITE_URL`: optional; default `https://iduckpdf.com`
- [ ] Set `DONATE.enabled = true` in `src/config.ts` and redeploy.
- [ ] Test end to end with Dodo’s test card, confirm the `?thanks=1` return page shows.
- [ ] Go live: live API key + live product, switch `DODO_API_BASE`, re-test with a small real payment.
- [ ] Add rate limiting on `/api/donate` (Cloudflare WAF rule) so nobody can spam checkout sessions.
- [ ] Check Dodo’s requirements for the site (privacy policy, terms, refund wording) before taking real money. See item 4.

## 3. Hosting and domain
- [x] Cloudflare Pages project `iduckpdf` created (direct upload) and deployed. `https://iduckpdf.pages.dev` stays as a staging address and is marked `noindex` on purpose.
- [x] Code is on GitHub: `basicappcompany/iduckpdf` (private). Make it public when you are ready (Settings → Danger zone); that also helps the SEO plan in §8.
- [x] **`iduckpdf.com` is live** (2026-11-08). GoDaddy nameservers now point at Cloudflare (`bob.ns.cloudflare.com`, `deb.ns.cloudflare.com`), the apex and `www` are Pages custom domains, HTTPS works.
- [x] `www.iduckpdf.com/*` 301-redirects to `https://iduckpdf.com/$1` (Cloudflare Redirect Rule, query string kept; done 2026-11-09). SSL/TLS mode is Full (strict) and Always Use HTTPS is on.
- [ ] SSL/TLS → set to **Full**, and turn on "Always Use HTTPS" (Cloudflare dashboard).
- [x] **Automatic deploys are on** (9 Nov): the Cloudflare API token is a GitHub secret. Every pull request builds, tests (226 Node checks), audits and runs the browser tests (34 site + 96 tool checks); merging to `main` deploys. Branch protection would add a hard gate, but GitHub only offers it on private repos with a paid plan or on a public repo.
- [ ] Manual deploy any time: `npm run export:web`, then `npx wrangler pages deploy dist --project-name iduckpdf --branch main`.
- [ ] **Lockfile caveat:** this machine's npm uses a private company registry, which writes its URLs into `package-lock.json` when you add packages. GitHub's runners can't reach it. If CI starts failing at `npm ci`, replace those URLs with `https://registry.npmjs.org/` (scoped packages use `.../@scope/name/-/name-x.y.z.tgz`).
- `functions/` is deployed with the site (Pages Functions); pages are pre-rendered, so no rewrite rule is needed. Unknown URLs get `404.html` with a real 404 status. `public/_headers` sets caching and security headers.

## 4. Pages and polish still to write
- [x] Privacy policy and terms pages are live at `/privacy` and `/terms` (copy in `src/content/legal.ts`; bump `SITE.legalUpdated` when you change them).
- [ ] Read both pages once and confirm they describe you correctly. Then confirm the contact inbox (§1). The operator name (`SITE.operator` = Basic App Company) is already on both pages, About, the footer and the structured data; change it in `src/config.ts` if the legal name differs. If you want a governing-law or jurisdiction clause, tell me which one, or have a lawyer add it: I left it out rather than guess.
- [ ] Check Dodo's own requirements for the refund wording (terms promise a refund within 14 days for mistaken tips) and change the terms if Dodo needs something different.
- [x] Duck app icons, favicon and social-share image are in place (regenerate with `npm run icons`). Still to do: a splash screen for the future mobile apps.
- [x] Analytics decided 2026-11-09: keep Cloudflare Web Analytics (cookie-free, page views only). The privacy policy discloses it. Figures: Cloudflare dashboard → Analytics & Logs → Web Analytics → iduckpdf.

## 5. Still to verify
All 51 tools are covered by Node tests and by browser tests. The first 43 also ran against the live site on 2026-11-09, and the 5 picture tools added on 2026-11-11 on that day (see `TRACKER.md`). The 5 AI tools are tested against a fake provider, never a real one: that part is yours (status page item 9.5). What is left:
- [ ] Summarise with AI and Ask your PDF with a real key for each provider (OpenAI, Anthropic, Gemini). Only the missing-key path has been tried. Model names in `src/config.ts` → `AI_DEFAULTS` may need updating. *You add a key in Settings; I cannot enter keys.*
- [ ] Re-run the older browser-only tools once on the live site: Photos to PDF, Scan to PDF, Grayscale, Black out text, Spot the differences, Logo or image stamp. (PDF to pictures, Copy text, Make it smaller, Watermark and Inspect were re-run after the bundle split, and every new tool is covered by `scripts/e2e-tools.js`.) *I can do this.*
- [x] Firefox and Safari (WebKit): both suites pass in Playwright's Firefox and WebKit builds (`BROWSER=firefox` / `webkit`).
- [ ] A real iPhone and a real Android phone: open the site, merge two PDFs, sign one with your finger, toggle dark mode. *You.*
- [ ] Mail links (`mailto:`) in a browser with a mail app configured. *You, 2 minutes.*
- [ ] Very large files on a phone (a 59 MB PDF merged and compressed fine in headless Chromium).
- [x] Visual passes in Chromium (light and dark, phone and desktop): site, signing screen, and the converted Word, HTML, Excel and PowerPoint output.
- [x] Download, "Keep going" chips, saving a key and the Roadmap page all work.

## 6. Roadmap tools (see `TRACKER.md` for status)
Done 2026-11-09: **every announced tool is built.** Nothing is queued.
- [x] Add a password, Remove a password (AES-256, `@cantoo/pdf-lib`, lazy chunk)
- [x] Sign a PDF (draw / type / upload, drag on a page preview), Fill in a form
- [x] Read scans (OCR) with Tesseract.js, self-hosted; English, Spanish, French, German, Italian, Portuguese, Dutch
- [x] Word to PDF, PDF to Word, Excel to PDF, PDF to Excel, PowerPoint to PDF, Web page to PDF: all in the browser, no server, so the "files stay on your device" promise holds. Their limits are stated on each tool page (see §9).
Ideas, not promises: more OCR languages (non-Latin scripts need larger fonts), closer Office conversions, mobile apps (§7).

## 7. Mobile apps (future scope)
- [ ] Apple Developer account ($99/yr) and Google Play account ($25 once), only needed when publishing.
- [ ] Implement the native files marked as stubs: `src/engine/io.native.ts`, `render.native.ts`, `imaging.native.ts`, `ui/DropZone.native.tsx`, `ui/Logo.native.tsx`.
- [ ] Add `expo-document-picker`, `expo-file-system`, `expo-sharing`, `react-native-svg`, AsyncStorage.
- [ ] Render pages through a WebView-hosted pdf.js (or a native module) so the canvas tools work.
- [ ] Set up EAS Build and store listings.

## 8. SEO & GEO: what is done, and what only you can do
Done in code (see `TRACKER.md`): every page pre-rendered to real HTML, unique titles/descriptions/canonicals, structured data (WebApplication, HowTo, FAQPage, BreadcrumbList, Article, ItemList, Organization, WebSite), sitemap, `robots.txt` that welcomes search and AI crawlers, `llms.txt` / `llms-full.txt`, Open Graph card, manifest, icons, crawlable links, 20 guides.

No code can guarantee a ranking. These steps, which need your accounts, are what actually move it:
- [ ] **Deploy on the real domain** and confirm `SITE.url` in `src/config.ts` matches the final address exactly (apex `https://iduckpdf.com` vs `www`). The www redirect and forced HTTPS are done (see §3).
- [x] **Google Search Console** (done 2026-11-08): `iduckpdf.com` is a verified Domain property (DNS TXT record in Cloudflare; **do not delete it** or verification is lost). Sitemap submitted; indexing was requested for `/`, `/tools`, `/guides`, `/tool/merge`, `/tool/compress` (those old tool addresses now 301 to the new keyword URLs). Check back in a few days: the sitemap status may read "Couldn't fetch" at first and should turn to Success; the Pages report will show indexed vs. not-yet-indexed pages. Google limits manual indexing requests to about 10 a day, so request the rest gradually (or just let the sitemap do it).
- [x] **Request indexing for the new URLs** (done 2026-11-10): Google accepted requests for `/pdf-tools`, `/merge-pdf`, `/compress-pdf`, `/split-pdf`, `/pdf-to-image`, `/ocr-pdf`, `/sign-pdf` and `/pdf-to-word`. Listing can still take days.
- [x] **Bing Webmaster Tools** (done 2026-11-10): imported from Google Search Console; the sitemap was submitted by hand (`https://iduckpdf.com/sitemap.xml`, status Processing). Checked 2026-11-11: status Success, 71 URLs discovered.
- [x] IndexNow (done 2026-11-10): `public/<key>.txt` is the ownership key (not a secret; keep it, and do not delete it). After every deploy to `main` the workflow runs `node scripts/indexnow.js`, which pings Bing and the other engines with the sitemap URLs (it skips docs-only commits). Run it by hand with `npm run indexnow -- --all`.
- [ ] **Names and trust (E-E-A-T):** put a real maker name or organisation and a real contact address on the About page, then add `sameAs` links (GitHub, X/LinkedIn, Product Hunt) to the Organization data in `src/lib/seoData.ts`. Add the privacy policy and terms pages (§4).
- [ ] **Backlinks and mentions, the main ranking driver:** publish the code on GitHub with a clear README and topics; submit to Product Hunt, AlternativeTo, and relevant "free tools" / privacy-tools lists; write a genuine Show HN or community post; link the guides from places that already rank. Do not buy links or spam communities; both backfire.
- [ ] **AI visibility:** AI assistants cite pages that search engines index and that other sites mention. After a few weeks, test real questions ("best free PDF merger that does not upload files", "how to redact a PDF properly") in ChatGPT, Gemini, Perplexity and Copilot, note whether iDuckPDF appears, and write a new guide for gaps.
- [x] **Analytics:** Cloudflare Web Analytics is on (cookie-free). Check it for search and AI referrals. If you ever add or change an analytics service, update `src/content/legal.ts` in the same change.
- [ ] **Keep content fresh:** edit `SITE.updated` in `src/config.ts` when copy changes (feeds the sitemap and "last updated" lines), add roughly one guide a month aimed at a real search query, and re-run `npm run audit` before every deploy.
- [x] **Performance:** first-load JavaScript went from 572 KB to about 333 KB gzipped (the PDF engine, password, OCR and Office code are lazy chunks; the SEO text is not bundled). Live mobile Lighthouse on 2026-11-09: performance 93 (home), 94 (tool page), 93 (guide); accessibility, best practices and SEO 100; layout shift 0. What is left is the framework (about 294 KB gzipped: React Native for Web plus the router).
- [x] Lighthouse run 2026-11-09 (see `TRACKER.md`). Re-run on the live site after each deploy: `npx lighthouse https://iduckpdf.com/ --only-categories=performance,accessibility,best-practices,seo`.
- [x] **Cloudflare Web Analytics beacon** (a `static.cloudflareinsights.com` script that Cloudflare injects at its edge): you chose to keep it, so the privacy policy now has an "Analytics" section and no longer claims "no analytics" or "no third-party loading".
- [ ] *Later, carefully:* "alternative to X" comparison pages. They rank well, but only write claims about other products that you can back up.

## 9. Things to know about the newer tools
- **Office conversions are best-effort and run in the browser.** Word to PDF keeps text, headings, lists, tables, pictures, links and the page setup, but not headers, footers, text boxes, shapes or charts. Excel to PDF shows the saved values with their number/date/percent formats, not formulas, colours or merged cells. PowerPoint to PDF reproduces positions, shapes, pictures, tables and text, but draws charts and SmartArt as plain boxes and ignores effects. PDF to Word and PDF to Excel read text layers only and detect structure from where text sits. Standard PDF fonts cannot draw non-Latin scripts, which become "?". If you ever want exact conversions, that needs a server (and a changed privacy promise); it is deliberately not built.
- **OCR assets are vendored.** `scripts/copy-vendor.js` copies the Tesseract.js script, worker, WebAssembly core (about 22 MB across variants) and seven language files (1 to 3 MB each) from `node_modules` into `public/vendor/tesseract` on every `npm install` (git-ignored, served with long cache headers). They are downloaded only when someone uses OCR. To add a language, install its `@tesseract.js-data/<lang>` package, list it in `copy-vendor.js` and `src/engine/ocr.ts`; scripts that need glyphs outside the standard PDF fonts also need a font embedded in `src/tools/ocr.ts`.
- **Signatures are images, not certificate-based digital signatures.** The tool page says so.
- **`package-lock.json` must keep public registry URLs.** After adding a package on this machine, replace the private registry URL with `https://registry.npmjs.org/` (see §3), or CI cannot install.
- **Content-Security-Policy.** `scripts/gen-csp.ts` writes it into `dist/_headers` on every build. Scripts: same origin, WebAssembly (OCR), the two constant inline scripts by SHA-256 hash, and Cloudflare's analytics beacon. Connections: same origin, the three AI providers, Cloudflare analytics. Styles allow inline (the web UI toolkit needs it). If a future change adds an inline script or a new outside host, the browser tests report a "Refused to ..." message: extend the policy there, never by adding `unsafe-inline` to scripts (the audit forbids it).
- **HSTS** (tell browsers to use https only) is a Cloudflare setting, SSL/TLS, Edge Certificates, HTTP Strict Transport Security. Optional; turn it on once you are sure the domain will stay on https (max-age 6 months, include subdomains off at first). *Yours: I do not change security settings.*
- **Dependency audit (2026-11-09).** `npm audit` reports pdfjs-dist <= 4.1.392 (high, arbitrary script via a crafted font). We ship 3.11 and have the documented mitigation in place (`isEvalSupported: false` in `src/engine/render.ts`, the only place a PDF is opened for display). The Node tests and the browser use the same major version. Upgrading to pdf.js 4+ changes the build files (ES modules) and the viewer glue: a separate, tested piece of work. The critical `tar` and moderate `glob`/`minimatch` findings come from build tooling (Expo CLI, an optional native `canvas` module) that never reaches visitors; fixing them means upgrading Expo.
- **Live health check:** `node scripts/health-check.js` (add a URL argument to point elsewhere). To run it on a schedule you need to approve creating the schedule (status page 9.9).
