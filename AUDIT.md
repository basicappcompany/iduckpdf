# iDuckPDF security, SEO and growth audit

Started 2026-11-14. Status words: **fixed** (changed and verified), **already fine** (checked, nothing to do), **needs you** (only the account owner can do it), **open** (not done yet; see "Where I stopped").

Rules followed: no passwords typed, no accounts created, nothing bought. I did not change account-level security settings (GitHub, Cloudflare, GoDaddy); those are click-by-click steps under "Needs you". No existing URL was changed or removed.

## Baseline (2026-11-13, before any change)

| Check | Result |
| --- | --- |
| Mozilla Observatory | **B+ (80/100)**, 11 of 12 tests passed. The one failure is `style-src 'unsafe-inline'` (the web UI toolkit writes inline `style` attributes). |
| securityheaders.com | Could not be scanned from the command line (Cloudflare challenge on their side). Open <https://securityheaders.com/?q=iduckpdf.com&followRedirects=on> and note the grade; response headers at baseline had CSP, X-Frame-Options, nosniff, Referrer-Policy and Permissions-Policy, but no HSTS and no COOP. |
| TLS | 1.3 works, 1.1 refused. HTTP redirects (301) to HTTPS. |
| DNSSEC | Off (no DS record at the registry). |

## Part A: security

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| 1 | Baseline grades | fixed | See table above. Re-run recorded at the end of this file. |
| 2 | pdf.js version | **open** | Site uses pdfjs-dist **3.11.174** (the last pre-4.x line). It is affected by CVE-2024-4367 (fixed in 4.2.67) unless `isEvalSupported` is false. The mitigation was already in place (`src/engine/render.ts` passes `isEvalSupported: false`; the CSP also forbids `eval`, so the bug cannot run code either way). Upgrade to the current 5.x line is queued as its own pull request because the library changed from a classic script to an ES module build and needs a full retest. Other PDF libraries: pdf-lib 1.17.1, @cantoo/pdf-lib 2.11.1, tesseract.js 7, jszip 3.10.1, fflate 0.8.3. |
| 3 | Outside code | already fine | The built site loads **no** script, WASM file, font or stylesheet from another host. pdf.js, the OCR engine and the 7 OCR language files are copied from `node_modules` into `/vendor` (39 MB, versions pinned by `package-lock.json`). The only third-party script is Cloudflare Web Analytics, which Cloudflare injects at the edge (`static.cloudflareinsights.com`, allowed in the CSP). It cannot carry an integrity hash because Cloudflare serves it. |
| 4 | Headers | fixed | `public/_headers` and `scripts/gen-csp.ts`: `frame-ancestors 'none'` and `X-Frame-Options: DENY` (was `self`), `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `Cross-Origin-Opener-Policy: same-origin`, `Permissions-Policy` now turns off camera, microphone, geolocation and payment everywhere and allows the camera only on `/scan-to-pdf` and its language versions, `upgrade-insecure-requests`. Already present and kept: `default-src 'self'`, `script-src 'self' 'wasm-unsafe-eval'` plus two SHA-256 hashes (no `unsafe-inline`, no `unsafe-eval`), `worker-src 'self' blob:`, `img-src 'self' blob: data:`, `base-uri 'self'`, nosniff, Referrer-Policy. `connect-src` is `'self'` plus exactly api.openai.com, api.anthropic.com, generativelanguage.googleapis.com and cloudflareinsights.com. Note: the scan page picks photos with the phone's own camera app (file input with `capture`), so it needs no `getUserMedia`; the camera permission is allowed there only to match your request. |
| 5 | Tools that leave the browser | fixed | See "Data flows" below. Every AI tool page already shows a warning before starting; the privacy page names Cloudflare (hosting and email), Cloudflare Web Analytics, the three AI providers, Dodo Payments. A new page, **How iDuckPDF works** (`/how-it-works`), states it in plain words. |
| 6 | Bring-your-own AI key | fixed | Stored only in `localStorage` (`duck.ai`), read by `src/lib/ai.ts`, sent only in the request header to the provider chosen (OpenAI `Authorization`, Anthropic `x-api-key`, Google `x-goog-api-key`), never in a URL, never logged (`console` is only called with caught error objects, never keys), and not in analytics (Cloudflare Web Analytics sees page loads only). "Remove key" in Settings deletes it. Added a visible warning under the key field: "Shared computer? Remove your key when you are done." (translated into all 10 languages). |
| 7 | Code review | see below | |
| 8 | Forms and helper chat | already fine | `/api/contact` (Pages Function) validates length, strips control characters from the subject, has a honeypot field, and hands the message to the `iduckpdf-mailer` Worker through a service binding (no public address). No API keys or secrets are in the code: the only secrets are Cloudflare bindings and the Dodo key, set in the dashboard. The helper chat (`/chat`) runs entirely in the browser (keyword matching), no server. Turnstile: not added. Spam today is limited to the honeypot, and the Worker sends only to your own verified inbox, so the worst case is junk in that inbox. Tell me if you want Turnstile (free, one site key from you). Git history scan: see below. |
| 9 | GitHub settings | needs you | See "Needs you". |
| 10 | Cloudflare settings | needs you | See "Needs you". Email: the domain **does** use email (Cloudflare Email Routing MX records, SPF `v=spf1 include:_spf.mx.cloudflare.net ~all`, DMARC `p=quarantine`), so I left SPF and DMARC alone as instructed. |
| 11 | DNSSEC | needs you | Off today. Steps below. |
| 12 | security.txt | fixed | `/.well-known/security.txt` (contact `hello@iduckpdf.com`, expires 2027-11-13). Re-run of grades: see end of file. |

### 7. Code review details

| Item | Status | Evidence |
| --- | --- | --- |
| Web page / text to PDF cannot run scripts | already fine | The HTML tool parses with `DOMParser.parseFromString` (an inert document: scripts never run, nothing is attached to the page) and its own walker skips `script`, `style`, `iframe`, `object`, `embed`, `svg` and more (`src/engine/html.ts`). The output is drawn into a PDF, never inserted into the page. Text and Markdown are rendered by the same drawing code. The CSP also blocks inline scripts (tested in `e2e-tools.js`: "an injected inline script is blocked"). |
| Names, metadata, form values, extracted text never use `innerHTML` | already fine | The whole source has **zero** uses of `innerHTML`, `dangerouslySetInnerHTML`, `document.write` or `eval`. React renders every value as text. |
| Redaction truly deletes text | already fine | The redact tool redraws each page with black boxes and **saves pages as pictures**, so no text layer survives. Test `e2e-tools.js`: the output contains no `SECRET` string, has an image per page, and iDuckPDF's own text reader finds nothing. |
| "Wipe metadata" removes it | already fine | Test `test-engine.ts`: after the tool, title and author are empty. |
| Passwords never stored or sent | already fine | Passwords live only in component state and are passed to the local engine; no `fetch`, storage or log touches them (grep: the only `fetch` calls are the AI providers, `/api/contact`, `/api/donate`, and the SEO JSON). |
| Large or damaged files fail kindly | already fine | `openPdfjs` and the loaders turn parse errors into "This PDF could not be opened. It may be damaged. Try the Repair tool." |

### Data flows (item 5)

| Tool(s) | Where the file/text goes | Encrypted | Kept | Limits |
| --- | --- | --- | --- | --- |
| Every PDF, image, Office, OCR, sign, redact, password tool (46 of 51) | Nowhere. Processed in the browser tab. | n/a | Until the tab closes | Device memory only |
| Summarize, Chat with PDF, Translate, Flashcards, Extract data (5 AI tools) | The text of the PDF (page text only, capped at about 90,000 characters per request) goes from the browser straight to the provider the user chose: OpenAI, Anthropic or Google, using the user's own key | HTTPS | Per the provider's own policy (not ours) | Provider limits and the user's key |
| Feedback and Request forms | `/api/contact` on iduckpdf.com, then the `iduckpdf-mailer` Worker, then Cloudflare Email Service to the team inbox | HTTPS | In the inbox only; nothing is stored by the site | Subject 200 chars, body 5,000 chars |
| Donate (switched off until keys exist) | `/api/donate`, then Dodo Payments checkout | HTTPS | Dodo's records | n/a |

Servers we run: two Pages Functions (`/api/contact`, `/api/donate`) and one Worker (`iduckpdf-mailer`, no public address). Size limits exist on the message fields. **Rate limiting: none beyond Cloudflare's own edge protections**; adding a Cloudflare rate-limiting rule on `/api/contact` is in "Needs you". No file contents ever reach any of them, so there is nothing to log.

## Needs you (account settings I did not touch)

1. **GitHub** (basicappcompany/iduckpdf): Settings, Code security: turn on Dependabot alerts, Dependabot security updates, secret scanning and push protection. Settings, Branches: protect `main` (block force pushes and deletion). The repo being private on the free plan may block secret scanning and branch protection; if so they need a paid plan or a public repo, and I did not upgrade anything. Check 2FA at github.com/settings/security.
2. **Cloudflare** (zone iduckpdf.com): SSL/TLS, Edge Certificates: Always Use HTTPS on, Minimum TLS Version 1.2, TLS 1.3 on, Automatic HTTPS Rewrites on. Security, Bots: Bot Fight Mode on. Optional: Security, WAF, Rate limiting rule for `/api/contact` (for example 5 requests per minute per IP). Also Security, Bots: make sure "Block AI bots" is **off** (Part B), and Caching, Crawler Hints on.
3. **DNSSEC**: Cloudflare, DNS, Settings, DNSSEC, Enable. Copy the DS record fields (key tag, algorithm, digest type, digest) into GoDaddy: My Products, the domain, DNS, DNSSEC. Wait a few minutes, confirm <https://iduckpdf.com> loads, and check at <https://dnsviz.net/d/iduckpdf.com/dnssec/>. If the site breaks, delete the DS record at GoDaddy first.
4. **GoDaddy**: confirm Domain Lock is on and Auto-renew is on for iduckpdf.com.
5. Confirm `hello@iduckpdf.com` is a mailbox you read (it is the contact in `security.txt`).

## Part B: SEO, AEO and GEO

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| 3 | Keywords in titles and H1 | fixed | All 51 tool pages: `<title>` rewritten to lead with the searched phrase, H1 is now the phrase ("Compress PDF"). The friendly name ("Make it smaller") stays on cards and in the sidebar, and appears above the H1 as a tag. Full list in "Title and H1 changes" below. Every title is 60 characters or less including the site name, every description is 155 or less, all unique (enforced by `npm run audit`). |
| 4 | Readable without JavaScript | already fine | The site is pre-rendered. Checked the raw HTML of all 51 tool pages: H1, quick answer, steps, tips, FAQs and related links are all present, plus WebApplication, HowTo, FAQPage and BreadcrumbList JSON-LD. |
| 5 | Answer-first content | fixed | Quick answer under the H1 (already there), numbered steps, FAQs (already there), related-tool links (already there). Added a visible "Good to know" heading over the tips list, and renamed "Last updated" to "Last reviewed". |
| 6 | Structured data | fixed | Tool pages: WebApplication (now `operatingSystem: "Any"`), FAQPage, HowTo, BreadcrumbList. Home: Organization, WebSite, plus a new Basic App Company Organization with `sameAs` to iDuckIMG, iDuckCalculator and iDuckConvert. Guides: Article with dates. Rich Results Test: needs a browser session; open **open** below. |
| 7 | Turkish and the other languages | already fine | `npm run test:engine` includes a completeness check: every live language (10) is fully translated, has its own URL, and the pages carry hreflang for every language plus x-default. Not-live languages have no pages. |
| 8 | Family links | fixed | New "Also from iDuck" block (iDuckIMG, iDuckCalculator, iDuckConvert) in the sidebar and footer, real `<a>` links. |
| 9 | Trust | fixed | New `/how-it-works` page. "Last reviewed" on every tool page. About already names Basic App Company and the contact address. |
| 2 | robots.txt and AI crawlers | already fine | Explicit Allow groups for GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, Claude-User, PerplexityBot, Google-Extended, Applebot-Extended, Bingbot and more; sitemap named. Cloudflare dashboard AI-bot settings: **needs you** (item 2 above). |
| 10 | llms.txt | already fine | `/llms.txt` lists all 51 tools with one-line answers plus the guides; now also lists the new pages. |

### Title and H1 changes (English; other languages keep their own translated names)

Titles are shown without the " | iDuckPDF" suffix.

| Tool | Old title | New title | Old H1 | New H1 |
| --- | --- | --- | --- | --- |
| merge | Merge PDF Files Online, Free | Merge PDF: Combine PDF Files Online, Free | Merge PDFs | Merge PDF |
| weave | Interleave Two PDFs (Double-Sided Scans) | Interleave PDF: Merge Two PDFs Page by Page | Weave two PDFs | Interleave PDF |
| split | Split a PDF into Separate Files | Split PDF: Separate Pages into Files, Free | Split a PDF | Split PDF |
| extract-pages | Extract Pages from a PDF | Extract Pages from PDF Online, Free | Pull out pages | Extract pages from PDF |
| remove-pages | Delete Pages from a PDF | Delete Pages from PDF Online, Free | Delete pages | Delete pages from PDF |
| reorder | Reorder PDF Pages | Reorder PDF Pages Online, Free | Reorder pages | Reorder PDF pages |
| reverse | Reverse PDF Page Order | Reverse PDF Page Order Online, Free | Flip page order | Reverse PDF page order |
| rotate | Rotate PDF Pages Online | Rotate PDF Pages Online, Free | Rotate pages | Rotate PDF |
| insert-blank | Insert Blank Pages into a PDF | Add Blank Page to PDF Online, Free | Add blank pages | Add blank page to PDF |
| resize | Resize PDF Pages to A4 or Letter | Resize PDF Pages to A4 or Letter, Free | Change page size | Resize PDF |
| crop | Crop PDF Margins | Crop PDF Margins Online, Free | Trim margins | Crop PDF |
| n-up | Print Multiple PDF Pages Per Sheet | Multiple Pages per Sheet PDF (N-up), Free | Print several per sheet | Multiple pages per sheet PDF |
| repair | Repair a Damaged PDF | Repair PDF: Fix a Damaged File, Free | Repair a PDF | Repair PDF |
| page-numbers | Add Page Numbers to a PDF | Add Page Numbers to PDF Online, Free | Number the pages | Add page numbers to PDF |
| text-watermark | Add a Text Watermark to a PDF | Add Watermark to PDF Online, Free | Text watermark | Add watermark to PDF |
| image-watermark | Add a Logo or Image to a PDF | Add Logo or Image to PDF, Free | Logo or image stamp | Add logo to PDF |
| headers-footers | Add Headers and Footers to a PDF | Add Header and Footer to PDF, Free | Headers & footers | Add header and footer to PDF |
| add-text | Write Text on a PDF | Add Text to PDF Online, Free | Write on a PDF | Add text to PDF |
| images-to-pdf | Convert Images to PDF (JPG, PNG, WebP) | Image to PDF: JPG, PNG, WebP, Free | Photos to PDF | Image to PDF |
| scan-to-pdf | Scan Documents to PDF with Your Phone | Scan to PDF with Your Phone Camera | Scan to PDF | Scan to PDF |
| text-to-pdf | Convert Text or Markdown to PDF | Text to PDF and Markdown to PDF, Free | Text or Markdown to PDF | Text to PDF |
| pdf-to-images | Convert PDF to JPG or PNG Images | PDF to Image: Save Pages as JPG or PNG | PDF to pictures | PDF to image |
| extract-text | Extract Text from a PDF | PDF to Text: Extract Text from PDF, Free | Copy text out | PDF to text |
| compress | Compress a PDF to a Smaller Size | Compress PDF: Reduce File Size Online, Free | Make it smaller | Compress PDF |
| restyle | Convert PDF to Grayscale or Dark Mode | Grayscale PDF and Dark Mode PDF, Free | Grayscale & dark mode | Grayscale PDF |
| inspect | Inspect a PDF: Metadata and Privacy Check | Inspect PDF: Metadata and Privacy Check | Inspect a PDF | Inspect PDF |
| properties | Remove Metadata from a PDF or Edit Properties | Edit PDF Metadata or Remove It, Free | Clean & edit properties | Edit PDF metadata |
| flatten | Flatten PDF Forms and Remove Annotations | Flatten PDF: Lock Forms, Remove Annotations | Flatten forms | Flatten PDF |
| redact | Redact a PDF: Black Out Text Permanently | Redact PDF: Black Out Text Permanently | Black out text | Redact PDF |
| compare | Compare Two PDFs: See What Changed | Compare PDF: See What Changed | Spot the differences | Compare PDF |
| summarize | Summarise a PDF with AI (Bring Your Own Key) | Summarize PDF with AI (Your Own Key) | Summarise with AI | Summarize PDF with AI |
| ask | Ask Questions About a PDF with AI | Chat with PDF: Ask Questions with AI | Ask your PDF | Chat with PDF |
| lock | Password Protect a PDF (AES-256), Free | Password Protect PDF (AES-256), Free | Add a password | Password protect PDF |
| unlock | Remove a PDF Password (If You Know It), Free | Unlock PDF: Remove a Password You Know | Remove a password | Unlock PDF |
| sign | Sign a PDF Online: Draw, Type or Upload, Free | Sign PDF Online: Draw, Type or Upload | Sign a PDF | Sign PDF |
| fill | Fill in a PDF Form Online, Free | Fill PDF Form Online, Free | Fill in a form | Fill PDF form |
| ocr | OCR a PDF: Make Scans Searchable, Free | OCR PDF: Make Scans Searchable, Free | Read scans (OCR) | OCR PDF |
| word-to-pdf | Word to PDF Converter (.docx), Free | Word to PDF Converter (.docx), Free | Word to PDF | Word to PDF |
| html-to-pdf | HTML to PDF: Convert a Web Page, Free | HTML to PDF: Convert a Web Page, Free | Web page to PDF | HTML to PDF |
| excel-to-pdf | Excel to PDF Converter (.xlsx, CSV), Free | Excel to PDF Converter (.xlsx, CSV), Free | Excel to PDF | Excel to PDF |
| pdf-to-excel | PDF to Excel Converter: Extract Tables, Free | PDF to Excel Converter: Extract Tables | PDF to Excel | PDF to Excel |
| pdf-to-word | PDF to Word Converter (.docx), Free | PDF to Word Converter (.docx), Free | PDF to Word | PDF to Word |
| pptx-to-pdf | PowerPoint to PDF Converter (.pptx), Free | PowerPoint to PDF Converter (.pptx), Free | PowerPoint to PDF | PowerPoint to PDF |
| extract-images | Extract Images from a PDF, Free | Extract Images from PDF, Free | Extract pictures | Extract images from PDF |
| pdf-to-pptx | Convert PDF to PowerPoint (PPTX), Free | PDF to PowerPoint Converter (PPTX), Free | PDF to PowerPoint | PDF to PowerPoint |
| merge-pdf-images | Merge PDF and Images into One PDF | Merge PDF and Images into One PDF | Merge PDFs and pictures | Merge PDF and images |
| jpg-to-pdf | Convert JPG to PDF, Free | JPG to PDF Converter, Free | JPG to PDF | JPG to PDF |
| pdf-to-jpg | Convert PDF to JPG, Free | PDF to JPG Converter, Free | PDF to JPG | PDF to JPG |
| translate | Translate a PDF with Your Own AI Key | Translate PDF with Your Own AI Key | Translate a PDF | Translate PDF |
| flashcards | Make Flashcards or a Quiz from a PDF | PDF to Flashcards and Quiz with AI | Flashcards and quiz | PDF to flashcards |
| ai-extract | Pull Data from a PDF into Excel with AI | Extract Data from PDF to Excel with AI | Pull data into Excel | Extract data from PDF |

## Where I stopped

See the bottom of this file (updated at each hand-off).
