# TODO: credentials, stubs and decisions waiting on you

Anything here is deliberately stubbed so the build is never blocked on a credential.
Tick items off and update `TRACKER.md` when done.

## 1. Feedback & feature requests (email)
- [x] `hello@iduckpdf.com` (`SITE.feedbackEmail`) now forwards to basicappcompany@gmail.com through Cloudflare Email Routing (MX + SPF published 2026-11-09; the catch-all is off, so only `hello@` is accepted). Still to do: send one real test message to it and check it arrives.
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
- [ ] Add a Redirect Rule so `www.iduckpdf.com/*` 301-redirects to `https://iduckpdf.com/$1` (both serve the site today; canonical tags already point at the apex, so this is tidiness).
- [ ] SSL/TLS → set to **Full**, and turn on "Always Use HTTPS" (Cloudflare dashboard).
- [ ] **Turn on automatic deploys:** the GitHub Action (`.github/workflows/deploy.yml`) already builds, tests and audits on every push, and passes. It skips the deploy until you add one secret. Create a Cloudflare API token (profile → API Tokens → Create Custom Token → Account · Cloudflare Pages · Edit), then run `gh secret set CLOUDFLARE_API_TOKEN --repo basicappcompany/iduckpdf` and paste it. `CLOUDFLARE_ACCOUNT_ID` is already set.
- [ ] Manual deploy any time: `npm run export:web`, then `npx wrangler pages deploy dist --project-name iduckpdf --branch main`.
- [ ] **Lockfile caveat:** this machine's npm uses a private company registry, which writes its URLs into `package-lock.json` when you add packages. GitHub's runners can't reach it. If CI starts failing at `npm ci`, replace those URLs with `https://registry.npmjs.org/` (scoped packages use `.../@scope/name/-/name-x.y.z.tgz`).
- `functions/` is deployed with the site (Pages Functions); pages are pre-rendered, so no rewrite rule is needed. Unknown URLs get `404.html` with a real 404 status. `public/_headers` sets caching and security headers.

## 4. Pages and polish still to write
- [x] Privacy policy and terms pages are live at `/privacy` and `/terms` (copy in `src/content/legal.ts`; bump `SITE.legalUpdated` when you change them).
- [ ] Read both pages once and confirm they describe you correctly. Then confirm the contact inbox (§1). The operator name (`SITE.operator` = Basic App Company) is already on both pages, About, the footer and the structured data; change it in `src/config.ts` if the legal name differs. If you want a governing-law or jurisdiction clause, tell me which one, or have a lawyer add it: I left it out rather than guess.
- [ ] Check Dodo's own requirements for the refund wording (terms promise a refund within 14 days for mistaken tips) and change the terms if Dodo needs something different.
- [x] Duck app icons, favicon and social-share image are in place (regenerate with `npm run icons`). Still to do: a splash screen for the future mobile apps.
- [ ] Decide on analytics (none today, and the site sets no cookies).

## 5. Still to verify
The browser-only tools were run in Chrome and Chromium with generated files (see `TRACKER.md`). What is left:
- [ ] Summarise with AI and Ask your PDF with a real key for each provider (OpenAI, Anthropic, Gemini). Only the missing-key path has been tried. Model names in `src/config.ts` → `AI_DEFAULTS` may need updating.
- [ ] Re-run the remaining browser-only tools (Photos to PDF, Scan, Grayscale, Redact, Compare, Image stamp) once on the deployed site. PDF to pictures, Copy text, Compress, Watermark and Inspect were re-run after the bundle split.
- [x] Visual pass in Chromium, light and dark, phone and desktop width (2026-11-09): nothing broken. Still to do: Safari and Firefox, ideally on a real iPhone.
- [x] Download, “Keep going” chips, saving a key and the Roadmap page all work.
- [ ] Mail links (`mailto:`) in a browser with a mail app configured.
- [x] Large files: a 59 MB PDF merged and compressed fine in headless Chromium. Still worth a try on a phone.

## 6. Roadmap tools (see `TRACKER.md` for status)
- [ ] Phase 2: Add a password, Remove a password, OCR, Sign a PDF, Fill in a form.
- [ ] Phase 3 (server needed, only if you want a backend; copy must say files leave the device): Word↔PDF, Excel↔PDF, PowerPoint→PDF, Web page→PDF.

## 7. Mobile apps (future scope)
- [ ] Apple Developer account ($99/yr) and Google Play account ($25 once), only needed when publishing.
- [ ] Implement the native files marked as stubs: `src/engine/io.native.ts`, `render.native.ts`, `imaging.native.ts`, `ui/DropZone.native.tsx`, `ui/Logo.native.tsx`.
- [ ] Add `expo-document-picker`, `expo-file-system`, `expo-sharing`, `react-native-svg`, AsyncStorage.
- [ ] Render pages through a WebView-hosted pdf.js (or a native module) so the canvas tools work.
- [ ] Set up EAS Build and store listings.

## 8. SEO & GEO: what is done, and what only you can do
Done in code (see `TRACKER.md`): every page pre-rendered to real HTML, unique titles/descriptions/canonicals, structured data (WebApplication, HowTo, FAQPage, BreadcrumbList, Article, ItemList, Organization, WebSite), sitemap, `robots.txt` that welcomes search and AI crawlers, `llms.txt` / `llms-full.txt`, Open Graph card, manifest, icons, crawlable links, 9 guides.

No code can guarantee a ranking. These steps, which need your accounts, are what actually move it:
- [ ] **Deploy on the real domain** and confirm `SITE.url` in `src/config.ts` matches the final address exactly (apex `https://iduckpdf.com` vs `www`). Redirect the other one to it and force HTTPS.
- [x] **Google Search Console** (done 2026-11-08): `iduckpdf.com` is a verified Domain property (DNS TXT record in Cloudflare; **do not delete it** or verification is lost). Sitemap submitted; indexing requested for `/`, `/tools`, `/guides`, `/tool/merge`, `/tool/compress`. Check back in a few days: the sitemap status may read "Couldn't fetch" at first and should turn to Success; the Pages report will show indexed vs. not-yet-indexed pages. Google limits manual indexing requests to about 10 a day, so request the rest gradually (or just let the sitemap do it).
- [ ] **Bing Webmaster Tools** (next, 5 minutes): sign in at bing.com/webmasters, choose **Import from Google Search Console**, and approve. It copies the verified site and the sitemap. This matters most for AI visibility: Bing feeds ChatGPT search, Copilot and others.
- [ ] *Optional:* IndexNow (instant pings to Bing and others when pages change) once the site is live.
- [ ] **Names and trust (E-E-A-T):** put a real maker name or organisation and a real contact address on the About page, then add `sameAs` links (GitHub, X/LinkedIn, Product Hunt) to the Organization data in `src/lib/seoData.ts`. Add the privacy policy and terms pages (§4).
- [ ] **Backlinks and mentions, the main ranking driver:** publish the code on GitHub with a clear README and topics; submit to Product Hunt, AlternativeTo, and relevant "free tools" / privacy-tools lists; write a genuine Show HN or community post; link the guides from places that already rank. Do not buy links or spam communities; both backfire.
- [ ] **AI visibility:** AI assistants cite pages that search engines index and that other sites mention. After a few weeks, test real questions ("best free PDF merger that does not upload files", "how to redact a PDF properly") in ChatGPT, Gemini, Perplexity and Copilot, note whether iDuckPDF appears, and write a new guide for gaps.
- [ ] **Analytics:** add cookie-free analytics (e.g. Cloudflare Web Analytics) to see search and AI referrals. Revisit the privacy wording if you add any.
- [ ] **Keep content fresh:** edit `SITE.updated` in `src/config.ts` when copy changes (feeds the sitemap and "last updated" lines), add roughly one guide a month aimed at a real search query, and re-run `npm run audit` before every deploy.
- [x] **Performance:** the PDF engine and tool code are now a lazy chunk, so first-load JavaScript dropped from 572 KB to 366 KB gzipped. What is left is the framework (about 294 KB gzipped, React Native for Web plus the router).
- [ ] Run Lighthouse on the live site after deploying and note the scores here.
- [ ] *Later, carefully:* "alternative to X" comparison pages. They rank well, but only write claims about other products that you can back up.
