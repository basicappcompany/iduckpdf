# TODO: credentials, stubs and decisions waiting on you

Anything here is deliberately stubbed so the build is never blocked on a credential.
Tick items off and update `TRACKER.md` when done.

## 1. Feedback & feature requests (email)
- [ ] Set the real inbox in `src/config.ts` → `SITE.feedbackEmail` (currently the placeholder `hello@iduckpdf.com`).
- [ ] Make sure that address actually receives mail (domain email / forwarding).
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

## 3. Hosting
- [ ] Create a Cloudflare Pages project from this repo. Build command: `npm run export:web`. Output directory: `dist`.
- [ ] `functions/` is picked up automatically (Pages Functions). Pages are pre-rendered, so no rewrite rule is needed; unknown URLs get `404.html` with a real 404 status. `public/_headers` sets caching and security headers.
- [ ] Point `iduckpdf.com` at the project.

## 4. Pages and polish still to write
- [ ] Privacy policy and terms pages (needed for donations and good practice).
- [x] Duck app icons, favicon and social-share image are in place (regenerate with `npm run icons`). Still to do: a splash screen for the future mobile apps.
- [ ] Decide on analytics (none today, and the site sets no cookies).

## 5. Still to verify
The browser-only tools were run in Chrome with generated files (see `TRACKER.md`). What is left:
- [ ] Summarise with AI and Ask your PDF with a real key for each provider (OpenAI, Anthropic, Gemini). Only the missing-key path has been tried. Model names in `src/config.ts` → `AI_DEFAULTS` may need updating.
- [ ] Re-run the browser-only tools (Photos to PDF, Scan, PDF to pictures, Copy text, Compress, Grayscale, Redact, Compare, Image stamp) once on the deployed site. They share the verified engine, but they were last exercised before the switch to pre-rendered pages.
- [ ] A **visual pass** in Chrome, Safari and Firefox, light and dark, phone width (sidebar drawer) and desktop width. Nobody has looked at the pages yet; screenshots timed out during testing.
- [ ] Click “Download” and confirm the saved files open; click a “Keep going with this file” chip; save a key in Settings; open the Roadmap page.
- [ ] Mail links (`mailto:`) in a browser with a mail app configured.
- [ ] Large-file behaviour (50–200 MB PDFs).

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
- [ ] **Google Search Console**: add `iduckpdf.com` as a Domain property (DNS TXT), submit `https://iduckpdf.com/sitemap.xml`, then use URL Inspection → Request indexing for the home page and a few tool pages.
- [ ] **Bing Webmaster Tools**: import from Search Console (one click) and submit the sitemap. This matters most for AI visibility: Bing feeds ChatGPT search, Copilot and others.
- [ ] *Optional:* IndexNow (instant pings to Bing and others when pages change) once the site is live.
- [ ] **Names and trust (E-E-A-T):** put a real maker name or organisation and a real contact address on the About page, then add `sameAs` links (GitHub, X/LinkedIn, Product Hunt) to the Organization data in `src/lib/seoData.ts`. Add the privacy policy and terms pages (§4).
- [ ] **Backlinks and mentions, the main ranking driver:** publish the code on GitHub with a clear README and topics; submit to Product Hunt, AlternativeTo, and relevant "free tools" / privacy-tools lists; write a genuine Show HN or community post; link the guides from places that already rank. Do not buy links or spam communities; both backfire.
- [ ] **AI visibility:** AI assistants cite pages that search engines index and that other sites mention. After a few weeks, test real questions ("best free PDF merger that does not upload files", "how to redact a PDF properly") in ChatGPT, Gemini, Perplexity and Copilot, note whether iDuckPDF appears, and write a new guide for gaps.
- [ ] **Analytics:** add cookie-free analytics (e.g. Cloudflare Web Analytics) to see search and AI referrals. Revisit the privacy wording if you add any.
- [ ] **Keep content fresh:** edit `SITE.updated` in `src/config.ts` when copy changes (feeds the sitemap and "last updated" lines), add roughly one guide a month aimed at a real search query, and re-run `npm run audit` before every deploy.
- [ ] **Performance (affects ranking):** run Lighthouse on the live site. The first JavaScript bundle is about 1 MB because every tool ships on every page. Splitting tool code so each page loads only what it needs is the next speed win.
- [ ] *Later, carefully:* "alternative to X" comparison pages. They rank well, but only write claims about other products that you can back up.
