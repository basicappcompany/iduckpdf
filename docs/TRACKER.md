# iDuckPDF tracker

Last updated: 2026-11-11 · Status key: ✅ built and checked · 🟡 built, only partly checked · ⏳ stubbed / waiting · 🗺️ planned

**Totals:** 48 tools built (46 checked end to end, 2 AI tools checked only up to the missing-key message) · 0 on the roadmap: every announced tool is built · 22 guides · 85 pages built (78 indexable, 7 noindex) · 169 Node tests and 113 browser checks, all run in CI.

For the same picture as one visual page, with what is pending from the owner and what Claude can do alone, open `docs/status.html`.

## App features
| Feature | Status | Notes |
|---|---|---|
| Expo (React Native + web) project, statically pre-rendered web build | ✅ | `npm run export:web` builds, injects SEO tags, hydrates cleanly in Chromium |
| Home page with search bar, popular tools, categories, "New and next" | ✅ | renders; tool cards navigate |
| Sidebar (categories, community links) + mobile drawer | ✅ | empty categories are hidden |
| `Ctrl K` / `/` command palette (tools, pages, theme) | ✅ | opens, filters, Enter navigates |
| Ask the helper (keyword chat, no AI) | ✅ | matches tools, answers privacy question |
| Light / dark / system theme | ✅ | colours are CSS variables set before first paint: no flash, checked on the live site |
| Generic tool screen: drop zone, reorder, options, progress, results, ZIP, copy text | ✅ | drag-drop, run and Download tested |
| Signature pad, page placement editor, form-field editor | ✅ | draw/type/upload, drag and resize on a page preview, rotated pages; position verified against the downloaded PDF |
| Chain tools (send a result into the next tool) | ✅ | chip opens the next tool with the file already loaded |
| Recently used tools | 🟡 | |
| Feedback page and feature request page (email) | ⏳ | `mailto:` to `hello@iduckpdf.com` (live inbox); opening a real mail app untested |
| Roadmap page | ✅ | "Recently added" and an ideas list: nothing is queued |
| Settings (theme, own AI key) | 🟡 | saving a key stores it and it survives reload; no provider call tried |
| Donate page + Dodo checkout function | ⏳ | page shows a friendly "not open yet" message; function written but **off** until keys exist, see TODO §2 |
| About page, privacy policy, terms of use | ✅ | operator named (Basic App Company); analytics and OCR download disclosed |
| Android / iOS apps | 🗺️ | future scope; native stubs in place, TODO §7 |

## Deployment
| Item | Status | Notes |
|---|---|---|
| GitHub repository | ✅ | `basicappcompany/iduckpdf` (private), `main`; every change goes through a pull request |
| Cloudflare Pages deployment | ✅ | live: pages, headers, sitemap, redirects, 404, donate function (503 while off) |
| `pages.dev` kept out of search results | ✅ | `X-Robots-Tag: noindex` via `public/_headers` |
| GoDaddy nameservers → Cloudflare, custom domain `iduckpdf.com` | ✅ | live over HTTPS, indexable, canonical correct |
| `www` → apex 301 redirect, SSL Full (strict), Always Use HTTPS | ✅ | Cloudflare Redirect Rule; verified live 9 Nov |
| CI on every pull request: typecheck, 169 Node tests, build, SEO audit, browser tests | ✅ | the browser tests install Chromium and run 28 site checks and 85 tool checks, under the real Content-Security-Policy; actions are on their Node 24 releases (checkout 7, setup-node 7, wrangler-action 4) |
| Automatic deploy on merge to `main` | ✅ | Cloudflare token stored as a GitHub secret; a pull request never deploys |
| `hello@iduckpdf.com` receives mail | ✅ | Cloudflare Email Routing to the business Gmail; a Gmail filter keeps it out of Spam (first test landed in Spam); fresh inbox test pending; replying from it is TODO §1 |
| Cloudflare Web Analytics | ✅ | cookie-free page views, disclosed in the privacy policy |
| Google Search Console | ✅ | verified Domain property, sitemap submitted; indexing requested on 10 Nov for the 8 key URLs (Google may take days to list them) |
| Bing Webmaster Tools | ✅ | imported from Search Console 10 Nov; sitemap read successfully on 11 Nov, 71 URLs discovered (indexing itself still to follow) |

## SEO & GEO (search engines and AI assistants)
| Item | Status | Notes |
|---|---|---|
| Every page pre-rendered to real HTML (no JavaScript needed to read it) | ✅ | 85 HTML files; checked with JavaScript switched off |
| Tool URLs that contain "pdf" | ✅ | `/merge-pdf`, `/ocr-pdf`, `/pdf-to-word` ... (map in `src/content/toolSlugs.ts`); hub is `/pdf-tools`; old `/tool/<id>` and `/tools` 301 via the generated `public/_redirects`; the build fails if a slug lacks "pdf", is duplicated or collides with a route |
| Unique title, description, canonical per indexable page | ✅ | single source: `seoForPath()` in `src/lib/seoData.ts`, written into the HTML by `scripts/inject-seo.ts`; the app uses `seo-pages.json` (written by the build) when someone navigates inside it |
| Structured data | ✅ | WebApplication, HowTo, FAQPage, BreadcrumbList, Article, ItemList, CollectionPage, AboutPage, Organization (parent organisation, email), WebSite + SearchAction |
| Unique copy for all 48 tools (answer-first summary, steps, uses, FAQ) | ✅ | `src/content/toolSeo.ts` |
| 20 how-to guides + index | ✅ | `src/content/guides.ts` (11 added on 9 Nov for the new tools) |
| Crawlable links, one `<h1>` per page, visible FAQ answers | ✅ | audited |
| `sitemap.xml` (71 URLs), `robots.txt` (search + AI crawlers welcome), `llms.txt`, `llms-full.txt` | ✅ | generated from the tool/guide registries by `scripts/gen-seo.ts` |
| Roadmap pages, forms and 404 kept out of the index | ✅ | `noindex,follow`; real 404 status via `404.html` |
| Open Graph / Twitter card, icons, web manifest, security + cache headers | ✅ | `scripts/make-icons.js` |
| Automated audit | ✅ | `npm run audit`: titles, duplicates, canonicals, app bundle, sitemap, "pdf" in tool URLs, redirect targets, `seo-pages.json` |
| Bing submission, backlinks, public repo, maker links | ⏳ | need your accounts: TODO §8 |

## Quality
| Item | Status | Notes |
|---|---|---|
| Lighthouse, mobile, throttled, **live** (2026-11-09) | ✅ | performance 93 (home), 94 (tool page), 93 (guide); accessibility, best practices and SEO 100; layout shift 0 |
| First-load JavaScript | ✅ | about 333 KB gzipped (framework 294 KB + shared 39 KB). The PDF engine (about 276 KB gz) loads on the first interaction on a tool page; password, OCR and the Office converters add their own lazy chunks |
| Layout shift on phones | ✅ | width-dependent layout is CSS from the first paint, so pre-rendered pages do not jump |
| Security headers | ✅ | nosniff, referrer policy, permissions policy, frame-ancestors, and a Content-Security-Policy generated at build time (inline scripts allowed by hash, no unsafe-inline for scripts, object/frame sources none); HSTS is a Cloudflare setting (TODO §3) |
| Dependency audit | 🟡 | `npm audit`: 1 high (pdfjs-dist 3.x, mitigated: the only getDocument call sets isEvalSupported false) and moderate/critical findings in build-only tools (Expo CLI, optional canvas) that are never shipped; upgrading pdf.js to 4+ or Expo is a larger job, see TODO §9 |
| Accessibility | ✅ | main landmark, heading order, names that match visible text, contrast |

## Tools built (48)
Join & cut 6 · Arrange & repair 8 · Stamp & annotate 7 · Make & extract 16 · Shrink & restyle 2 · Privacy & cleanup 6 · Compare & ask 3. This table is the registry; `docs/status.html` has a searchable, generated copy.

| Category | Tool | URL | Status |
|---|---|---|---|
| Join & cut | Merge PDFs | `/merge-pdf` | ✅ |
| Join & cut | Weave two PDFs | `/interleave-pdf` | ✅ |
| Join & cut | Split a PDF | `/split-pdf` | ✅ |
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
| Shrink & restyle | Make it smaller | `/compress-pdf` | ✅ (falls back to the gentle result when picture mode would be bigger) |
| Shrink & restyle | Grayscale & dark mode | `/grayscale-pdf` | ✅ |
| Privacy & cleanup | Inspect a PDF | `/inspect-pdf` | ✅ |
| Privacy & cleanup | Clean & edit properties | `/edit-pdf-metadata` | ✅ |
| Privacy & cleanup | Flatten forms | `/flatten-pdf` | ✅ |
| Privacy & cleanup | Black out text | `/redact-pdf` | ✅ |
| Compare & ask | Spot the differences | `/compare-pdf` | ✅ |
| Compare & ask | Summarise with AI | `/summarize-pdf` | 🟡 key-missing path only; no provider call tried |
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
| Make & extract | JPG to PDF | `/jpg-to-pdf` | ✅ new 11 Nov, Node and browser tests (same engine as Photos to PDF, own landing page) |
| Make & extract | PDF to JPG | `/pdf-to-jpg` | ✅ new 11 Nov, browser tests (same engine as PDF to pictures, own landing page) |

Known limits (stated on each tool page): the Office conversions run in the browser, so layout is simplified: Word to PDF does not reproduce headers, footers, text boxes or charts; Excel to PDF shows values, not formulas, colours or merged cells; PowerPoint to PDF draws charts and SmartArt as plain boxes; PDF to Word and PDF to Excel read text layers only (scans need OCR first) and detect structure heuristically; standard PDF fonts mean non-Latin scripts become "?"; OCR covers English, Spanish, French, German, Italian, Portuguese and Dutch.

## Roadmap
Nothing is queued: every announced tool is built. Ideas on the list (not promises): more OCR languages (needs larger fonts), closer Word/Excel/PowerPoint conversions, Android and iPhone apps.

## How the checks were done
- `npm run test:engine`: 169 checks in Node: 73 on the PDF engine, signing geometry and every non-canvas tool, 70 on the Office and web conversions (Word, HTML, Excel, PowerPoint, PDF to Word, PDF to Excel) using hand-built files read back with pdf.js, and 26 on the picture tools (extraction is checked pixel for pixel and byte for byte; the PowerPoint writer is read back by the PowerPoint to PDF reader).
- `npm run audit`: crawler-style audit of the built site (85 pages, 78 indexable). All checks pass.
- `scripts/e2e-smoke.js` (headless Chromium via Playwright): 28 checks: crawler view with JavaScript off, hydration, no layout shift or theme flash, the PDF engine loads only after interaction, navigation, palette, a real merge, saved theme, phone drawer.
- `scripts/e2e-tools.js`: 85 checks in a real browser (13 new for the picture tools and PDF to PowerPoint on 11 Nov), including the older tools (Photos to PDF, Scan to PDF, Grayscale, Redact, Compare, Logo stamp) and a check that the Content-Security-Policy blocks an injected script: password protect and unlock, draw/type/upload a signature and drag it (position read back from the downloaded PDF, normal and rotated page), fill a form, OCR of a scan and of a picture (searchable PDF re-read by the site's own text tool, rotated page), and every conversion with the downloads opened and checked.
- Both browser suites also ran against the live site on 2026-11-09: 57/57 and 28/28. Every one of the 43 tool URLs answers 200 and is in the sitemap; the old URLs redirect.
- `npm run typecheck`: clean. All of the above run on every pull request in CI.
- Visual passes in Chromium (light and dark, phone and desktop): signing screen, converted Word, HTML, Excel and PowerPoint output rendered and looked at.
- Live-site health check: `node scripts/health-check.js` (every sitemap URL answers 200 and is its own canonical, redirects, www and http, headers, robots/llms/sitemap, real 404, the IndexNow key file).
- IndexNow: `scripts/indexnow.js` runs after each deploy to `main` (skips docs-only commits) and pings Bing and the other IndexNow engines; the key file is `public/<key>.txt`.
- Found by it on 2026-11-09 and fixed: the guides index was in the sitemap and its canonical as `/guides`, but the host redirects that to `/guides/`; it is now `/guides/` everywhere.
- **Firefox and WebKit:** both browser suites (28 + 72) pass in Firefox and in WebKit as well as Chromium (`BROWSER=firefox` / `webkit`).
- **Not checked:** a real Safari on a Mac or iPhone (WebKit is the same engine, but not the same build), a real phone, real AI provider calls, and a mail app actually opening from the `mailto:` links.
- Bugs found and fixed on the way (most recent first): plain PowerPoint text boxes inheriting body bullets; decrypted PDFs keeping a stale encryption entry; drawing pad ink invisible in dark mode; layout shift and theme flash on pre-rendered pages; stretched last-row cards; a custom `+html.tsx` that removed the app bundle.
- Tooling quirk: the browser automation tool's Chrome sometimes stops producing animation frames. Playwright is the reliable check.
