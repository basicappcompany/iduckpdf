# iDuckPDF tracker

Last updated: 2026-11-15 · Status key: ✅ built and checked · 🟡 built, only partly checked · ⏳ stubbed / waiting · 🗺️ planned

**Totals:** 54 tools built (49 covered by Node and/or browser tests; the 5 AI tools are checked against a fake provider, in Node and in a browser, but never against a real one) · 0 on the roadmap: every announced tool is built · 54 guides (a how-to for every tool) · 1,340 pages built (1,273 indexable and in the sitemap) in 11 locales · 278 Node tests plus 51 language checks, and 45 site + 109 tool browser checks, all run in CI; both browser suites also passed on the live site on 2026-11-15.

For the same picture as one visual page, with what is pending from the owner and what Claude can do alone, open `docs/status.html`.

## App features
| Feature | Status | Notes |
|---|---|---|
| Expo (React Native + web) project, statically pre-rendered web build | ✅ | `npm run export:web` builds, injects SEO tags, hydrates cleanly in Chromium |
| Home page with search bar, popular tools, one grid of every tool (name and benefit line, group chips, "new" badge), "New and next" | ✅ | 6 browser checks: every tool is a real link in the HTML, chips filter and mark the chosen group, badge count |
| Sidebar (categories, community links) + mobile drawer | ✅ | empty categories are hidden |
| `Ctrl K` / `/` command palette (tools, pages, theme) | ✅ | opens, filters, Enter navigates |
| Ask the helper (keyword chat, no AI) | ✅ | matches tools, answers privacy question |
| Light / dark / system theme | ✅ | colours are CSS variables set before first paint: no flash, checked on the live site |
| Generic tool screen: drop zone, reorder, options, progress, results, ZIP, copy text | ✅ | drag-drop, run and Download tested |
| Signature pad, page placement editor, form-field editor | ✅ | draw/type/upload, drag and resize on a page preview, rotated pages; position verified against the downloaded PDF |
| Chain tools (send a result into the next tool) | ✅ | chip opens the next tool with the file already loaded |
| Recently used tools | 🟡 | |
| Feedback page and feature request page | 🟡 | post to `/api/contact`, then the `iduckpdf-mailer` Worker and Cloudflare Email Service, with a `mailto:` fallback. The live endpoint answers 400 to an empty message (so its binding exists); a real message reaching the inbox is not yet confirmed (TODO §1) |
| Roadmap page | ✅ | "Recently added" and an ideas list: nothing is queued |
| Settings (theme, own AI key) | 🟡 | saving a key stores it and it survives reload; no provider call tried |
| Donate page + Dodo checkout function | ⏳ | page shows a friendly "not open yet" message; function written but **off** until keys exist, see TODO §2 |
| About page, privacy policy, terms of use | ✅ | operator named (Basic App Company); analytics and OCR download disclosed |
| Languages: English (US), English (UK), Bengali, German, Spanish, French, Hindi, Indonesian, Brazilian Portuguese, Russian, Turkish, with a flag menu | 🟡 | whole site translated (1,052 UI strings, 54 tools, 54 guides, FAQ, run-time messages per language); machine translation, no native-speaker review yet (TODO §10); legal pages stay English; the helper chat still matches English keywords only |
| Android / iOS apps | 🗺️ | future scope; native stubs in place, TODO §7 |

## Deployment
| Item | Status | Notes |
|---|---|---|
| GitHub repository | ✅ | `basicappcompany/iduckpdf` (private), `main`; every change goes through a pull request |
| Cloudflare Pages deployment | ✅ | live: pages, headers, sitemap, redirects, 404, donate function (503 while off) |
| `pages.dev` kept out of search results | ✅ | `X-Robots-Tag: noindex` via `public/_headers` |
| GoDaddy nameservers → Cloudflare, custom domain `iduckpdf.com` | ✅ | live over HTTPS, indexable, canonical correct |
| `www` → apex 301 redirect, SSL Full (strict), Always Use HTTPS | ✅ | Cloudflare Redirect Rule; verified live 9 Nov |
| CI on every pull request: typecheck, 278 Node tests + 51 language checks, build, SEO audit, browser tests | ✅ | the browser tests install Chromium and run 45 site checks and 109 tool checks, under the real Content-Security-Policy; actions are on their Node 24 releases (checkout 7, setup-node 7, wrangler-action 4) |
| Automatic deploy on merge to `main` | ✅ | Cloudflare token stored as a GitHub secret; a pull request never deploys |
| `hello@iduckpdf.com` receives mail | ✅ | Cloudflare Email Routing to the business Gmail; a Gmail filter keeps it out of Spam (first test landed in Spam); fresh inbox test pending; replying from it is TODO §1 |
| Cloudflare Web Analytics | ✅ | cookie-free page views, disclosed in the privacy policy |
| Daily live health check | ✅ | GitHub Actions at 06:17 UTC runs `scripts/health-check.js`; run by hand on 15 Nov it passed 19/19 on a rerun (the first run that day showed 18/19 and I did not capture which check; the second run was clean) |
| Security audit and hardening (13-14 Nov) | ✅ | Mozilla Observatory A+ (125/100) and securityheaders.com A+ (both recorded 14 Nov in `AUDIT.md`); response headers, `/.well-known/security.txt` and `/how-it-works` verified live 15 Nov. Account-level settings are the owner's: TODO §11 |
| Google Search Console | ✅ | verified Domain property, sitemap submitted; indexing requested on 10 Nov for the 8 key URLs. Checked 14 Nov: 0 clicks and 0 impressions so far and "Processing data" on the indexing report, so nothing to report yet |
| Bing Webmaster Tools | ✅ | imported from Search Console 10 Nov; sitemap read successfully on 11 Nov, 71 URLs discovered (indexing itself still to follow) |

## SEO & GEO (search engines and AI assistants)
| Item | Status | Notes |
|---|---|---|
| Every page pre-rendered to real HTML (no JavaScript needed to read it) | ✅ | 1,340 HTML files across 11 locales; the smoke suite checks the crawler view with JavaScript off |
| Tool URLs that contain "pdf" | ✅ | `/merge-pdf`, `/ocr-pdf`, `/pdf-to-word` ... (map in `src/content/toolSlugs.ts`); hub is `/pdf-tools`; old `/tool/<id>` and `/tools` 301 via the generated `public/_redirects`; the build fails if a slug lacks "pdf", is duplicated or collides with a route |
| Unique title, description, canonical per indexable page | ✅ | single source: `seoForPath()` in `src/lib/seoData.ts`, written into the HTML by `scripts/inject-seo.ts`; the app uses `seo-pages.json` (written by the build) when someone navigates inside it |
| Structured data | ✅ | WebApplication, HowTo, FAQPage, BreadcrumbList, Article, ItemList, CollectionPage, AboutPage, Organization (parent organisation, email), WebSite + SearchAction |
| Unique copy for all 54 tools (answer-first summary, steps, uses, FAQ) | ✅ | `src/content/toolSeo.ts` |
| 54 how-to guides + index (one per tool) | ✅ | `src/content/guides.ts` |
| Compress-to-a-size, size, job and comparison pages | ✅ | six size pages (100 KB to 2 MB), job pages (email, form upload, JPG + PDF, bank statement unlock, sign on a phone, split by size, JPG to PDF under a size limit) and three comparison pages (iLovePDF, Smallpdf, no-upload options) with sources; added 13-14 Nov |
| Keyword titles and H1s, "How iDuckPDF works", family links | ✅ | every tool page leads with the searched phrase; `/how-it-works` is live; "Also from iDuck" links in the sidebar and footer |
| Crawlable links, one `<h1>` per page, visible FAQ answers | ✅ | audited |
| `sitemap.xml` (1,273 URLs, matches the live file on 15 Nov), `robots.txt` (search + AI crawlers welcome), `llms.txt`, `llms-full.txt` | ✅ | generated from the tool/guide registries by `scripts/gen-seo.ts` |
| Roadmap pages, forms and 404 kept out of the index | ✅ | `noindex,follow`; real 404 status via `404.html` |
| Open Graph / Twitter card, icons, web manifest, security + cache headers | ✅ | `scripts/make-icons.js` |
| Automated audit | ✅ | `npm run audit`: titles, duplicates, canonicals, app bundle, sitemap, "pdf" in tool URLs, redirect targets, `seo-pages.json` |
| Backlinks, public repo, maker links, posting `OUTREACH.md` | ⏳ | need your accounts: TODO §8 and §11 |

## Quality
| Item | Status | Notes |
|---|---|---|
| PageSpeed Insights, mobile, **live** (run 2026-11-14, recorded in `AUDIT.md`; not re-measured in this sync) | ✅ | home 100 / 100 / 100 / 100 (performance, accessibility, best practices, SEO); `/merge-pdf` and `/compress-pdf` performance 99 on the first run and 95 on a re-run (it moves a few points between runs), accessibility 96 until the green pill contrast fix (PR 51), then 100 on `/merge-pdf`. A guide page and desktop were not run. Earlier Lighthouse (9 Nov): 93 / 94 / 93, layout shift 0 |
| First-load JavaScript | ✅ | about 333 KB gzipped (framework 294 KB + shared 39 KB). The PDF engine (about 276 KB gz) loads on the first interaction on a tool page; password, OCR and the Office converters add their own lazy chunks |
| Layout shift on phones | ✅ | width-dependent layout is CSS from the first paint, so pre-rendered pages do not jump |
| Security headers | ✅ | nosniff, referrer policy, permissions policy, frame-ancestors, and a Content-Security-Policy generated at build time (inline scripts allowed by hash, no unsafe-inline for scripts, object/frame sources none); HSTS (1 year, includeSubDomains), COOP same-origin and `X-Frame-Options: DENY` are sent as headers (verified live 15 Nov) |
| Dependency audit | 🟡 | pdf.js is 6.5.438 since 13 Nov (PR 43) and the PDF libraries are pinned to exact versions. `npm audit` on 15 Nov: 4 moderate findings (for example `minimatch`), none high or critical, from the Expo build tooling; clearing them means upgrading Expo (a larger job) |
| Accessibility | ✅ | main landmark, heading order, names that match visible text, contrast |

## Tools built (54)
Join & cut 6 · Arrange & repair 8 · Stamp & annotate 8 · Make & extract 17 · Shrink & restyle 2 · Privacy & cleanup 6 · Compare & ask 7. This table is the registry; `docs/status.html` has a searchable, generated copy.

| Category | Tool | URL | Status |
|---|---|---|---|
| Join & cut | Merge PDFs | `/merge-pdf` | ✅ |
| Join & cut | Weave two PDFs | `/interleave-pdf` | ✅ |
| Join & cut | Split a PDF | `/split-pdf` | ✅ (also splits to a maximum file size, page `/split-pdf-by-size`) |
| Join & cut | Pull out pages | `/extract-pdf-pages` | ✅ |
| Join & cut | Delete pages | `/remove-pdf-pages` | ✅ |
| Arrange & repair | Reorder pages | `/reorder-pdf-pages` | ✅ |
| Arrange & repair | Flip page order | `/reverse-pdf-pages` | ✅ |
| Arrange & repair | Rotate pages | `/rotate-pdf` | ✅ |
| Arrange & repair | Add blank pages | `/add-blank-page-to-pdf` | ✅ |
| Arrange & repair | Change page size | `/resize-pdf` | ✅ |
| Arrange & repair | Trim margins | `/crop-pdf` | ✅ |
| Arrange & repair | Print several per sheet | `/multiple-pages-per-sheet-pdf` | ✅ |
| Arrange & repair | Repair a PDF | `/repair-pdf` | ✅ |
| Stamp & annotate | Number the pages | `/add-page-numbers-to-pdf` | ✅ |
| Stamp & annotate | Text watermark | `/add-watermark-to-pdf` | ✅ |
| Stamp & annotate | Logo or image stamp | `/add-logo-to-pdf` | ✅ |
| Stamp & annotate | Headers & footers | `/add-header-and-footer-to-pdf` | ✅ |
| Stamp & annotate | Write on a PDF | `/add-text-to-pdf` | ✅ |
| Make & extract | Photos to PDF | `/image-to-pdf` | ✅ |
| Make & extract | Scan to PDF | `/scan-to-pdf` | ✅ |
| Make & extract | Text or Markdown to PDF | `/text-to-pdf` | ✅ |
| Make & extract | PDF to pictures | `/pdf-to-image` | ✅ |
| Make & extract | Copy text out | `/pdf-to-text` | ✅ |
| Shrink & restyle | Make it smaller | `/compress-pdf` | ✅ (falls back to the gentle result when picture mode would be bigger; also compresses to a target size) |
| Shrink & restyle | Grayscale & dark mode | `/grayscale-pdf` | ✅ |
| Privacy & cleanup | Inspect a PDF | `/inspect-pdf` | ✅ |
| Privacy & cleanup | Clean & edit properties | `/edit-pdf-metadata` | ✅ |
| Privacy & cleanup | Flatten forms | `/flatten-pdf` | ✅ |
| Privacy & cleanup | Black out text | `/redact-pdf` | ✅ |
| Compare & ask | Spot the differences | `/compare-pdf` | ✅ |
| Compare & ask | Summarise with AI | `/summarize-pdf` | 🟡 fake-provider tests (Node); no real provider call tried |
| Compare & ask | Translate a PDF | `/translate-pdf` | 🟡 new 11 Nov, fake-provider tests in Node and in a browser; no real provider call tried |
| Compare & ask | Flashcards and quiz | `/pdf-to-flashcards` | 🟡 new 11 Nov, fake-provider tests in Node and in a browser; no real provider call tried |
| Compare & ask | Pull data into Excel | `/extract-data-from-pdf` | 🟡 new 11 Nov, fake-provider tests in Node and in a browser; no real provider call tried |
| Compare & ask | Ask your PDF | `/chat-with-pdf` | 🟡 key-missing path only; no provider call tried |
| Privacy & cleanup | Add a password | `/password-protect-pdf` | ✅ new 9 Nov, Node and browser tests |
| Privacy & cleanup | Remove a password | `/unlock-pdf` | ✅ new 9 Nov, Node and browser tests |
| Stamp & annotate | Sign a PDF | `/sign-pdf` | ✅ new 9 Nov, Node and browser tests |
| Stamp & annotate | Fill in a form | `/fill-pdf-form` | ✅ new 9 Nov, Node and browser tests |
| Make & extract | Read scans (OCR) | `/ocr-pdf` | ✅ new 9 Nov, Node and browser tests |
| Make & extract | Word to PDF | `/word-to-pdf` | ✅ new 9 Nov, Node and browser tests |
| Make & extract | Web page to PDF | `/html-to-pdf` | ✅ new 9 Nov, Node and browser tests |
| Make & extract | Excel to PDF | `/excel-to-pdf` | ✅ new 9 Nov, Node and browser tests |
| Make & extract | PDF to Excel | `/pdf-to-excel` | ✅ new 9 Nov, Node and browser tests |
| Make & extract | PDF to Word | `/pdf-to-word` | ✅ new 9 Nov, Node and browser tests |
| Make & extract | PowerPoint to PDF | `/powerpoint-to-pdf` | ✅ new 9 Nov, Node and browser tests |
| Join & cut | Merge PDFs and pictures | `/merge-pdf-and-images` | ✅ new 11 Nov, Node and browser tests |
| Make & extract | Extract pictures | `/extract-images-from-pdf` | ✅ new 11 Nov, Node and browser tests (JPEGs byte for byte, PNG for the rest) |
| Make & extract | PDF to PowerPoint | `/pdf-to-powerpoint` | ✅ new 11 Nov, Node (writer read back) and browser tests; exact-look and editable-text modes |
| Make & extract | JPG to PDF | `/jpg-to-pdf` | ✅ new 11 Nov, Node and browser tests (same engine as Photos to PDF, own landing page; option to stay under a size limit, page `/jpg-to-pdf-under-size-limit`) |
| Make & extract | PDF to JPG | `/pdf-to-jpg` | ✅ new 11 Nov, browser tests (same engine as PDF to pictures, own landing page) |
| Compare & ask | Count the words | `/pdf-word-counter` | ✅ new 14 Nov, Node and browser tests |
| Stamp & annotate | Bates numbering | `/bates-numbering-pdf` | ✅ new 14 Nov, Node and browser tests |
| Make & extract | PDF to Markdown | `/pdf-to-markdown` | ✅ new 14 Nov, Node and browser tests |

Known limits (stated on each tool page): the Office conversions run in the browser, so layout is simplified: Word to PDF does not reproduce headers, footers, text boxes or charts; Excel to PDF shows values, not formulas, colours or merged cells; PowerPoint to PDF draws charts and SmartArt as plain boxes; PDF to Word and PDF to Excel read text layers only (scans need OCR first) and detect structure heuristically; standard PDF fonts mean non-Latin scripts become "?"; OCR covers English, Spanish, French, German, Italian, Portuguese and Dutch.

## Roadmap
Nothing is queued: every announced tool is built. Ideas (not promises): more OCR languages (needs larger fonts), closer Word/Excel/PowerPoint conversions, Android and iPhone apps. Gaps seen at competitors and not built: PDF/A, EPUB/ODT/RTF to PDF, marketplace label croppers, a PDF highlighter (the public roadmap page still shows only the first three ideas).

## How the checks were done
- `npm run test:engine` (re-run 2026-11-15): 278 checks in Node: 73 on the PDF engine, signing geometry and every non-canvas tool, 70 on the Office and web conversions (hand-built files read back with pdf.js), 45 on the picture tools and later additions (extraction is checked pixel for pixel and byte for byte; the PowerPoint writer is read back by the PowerPoint to PDF reader), 57 on the AI tools against a fake provider, 22 on the donate function against a fake Dodo, 11 on the contact function against a fake mailer; plus 51 language checks (routes, hreflang, search and helper in other languages, catalogs complete for 54 tools and 54 guides).
- `npm run audit` (2026-11-15): crawler-style audit of the built site: 1,340 pages, 1,273 indexable, sitemap lists 1,273. All checks pass; 4 warnings (a 72-character Indonesian home title, and no visible steps on the two comparison pages and the no-upload page, which are not how-tos).
- `scripts/e2e-smoke.js` (headless Chromium via Playwright, 2026-11-15): 45 checks: crawler view with JavaScript off, hydration, no layout shift or theme flash, the PDF engine loads only after interaction, navigation, palette, a real merge, saved theme, phone drawer and header, no sideways scrolling at 360 and 390 px.
- `scripts/e2e-tools.js` (2026-11-15): 109 checks in a real browser, including every conversion with the downloads opened and read back, the signature position read back from the downloaded PDF, OCR, the redaction leaving no text, the newer tools (word counter, Bates, Markdown, split by size, JPG to PDF under a size limit), the AI tools with the provider URL intercepted, and a check that the Content-Security-Policy blocks an injected script.
- Both browser suites ran against the live site on 2026-11-15 and passed: 45/45 and 109/109 (on 2026-11-09 they were 28/28 and 57/57). The sitemap on the live site has 1,273 URLs; `www`, `http://` and the old `/tool/<id>` addresses answer 301.
- `npm run typecheck`: clean. All of the above run on every pull request in CI.
- Visual passes in Chromium (light and dark, phone and desktop): signing screen, converted Word, HTML, Excel and PowerPoint output rendered and looked at.
- Live-site health check: `node scripts/health-check.js` (every sitemap URL answers 200 and is its own canonical, redirects, www and http, headers, robots/llms/sitemap, real 404, the IndexNow key file).
- IndexNow: `scripts/indexnow.js` runs after each deploy to `main` (skips docs-only commits) and pings Bing and the other IndexNow engines; the key file is `public/<key>.txt`.
- Found by it on 2026-11-09 and fixed: the guides index was in the sitemap and its canonical as `/guides`, but the host redirects that to `/guides/`; it is now `/guides/` everywhere.
- **Firefox and WebKit:** both browser suites passed in Firefox and in WebKit as well as Chromium on 2026-11-09 (28 + 72); not re-run in this sync, so the 11 newest tools have only been run in Chromium here (`BROWSER=firefox` / `webkit`).
- **Not checked:** a real Safari on a Mac or iPhone, a real phone, real AI provider calls, a mail app opening from the `mailto:` links, a real contact-form message arriving in the inbox, the PageSpeed numbers (quoted from 14 Nov, not re-run), and Bing Webmaster Tools since 11 Nov.
- Bugs found and fixed on the way (most recent first): plain PowerPoint text boxes inheriting body bullets; decrypted PDFs keeping a stale encryption entry; drawing pad ink invisible in dark mode; layout shift and theme flash on pre-rendered pages; stretched last-row cards; a custom `+html.tsx` that removed the app bundle.
- Tooling quirk: the browser automation tool's Chrome sometimes stops producing animation frames. Playwright is the reliable check.
