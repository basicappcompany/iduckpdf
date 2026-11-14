# iDuckPDF outreach: 20 places to get mentioned

Nothing here has been posted. Each entry has a draft in plain, honest wording. Before posting anywhere, read that place's current rules (they change), post from your own account, disclose that you made the site, and never ask for upvotes. Reply to every comment. One place per day is plenty.

Facts you can rely on in every draft: free, no sign-up, no watermark, no ads; 51 tools; almost everything runs in the browser (files are not uploaded), except the 5 AI tools which send text to the provider you pick with your own key; Office conversions use a simplified layout; OCR covers 7 Latin-script languages; made by Basic App Company.

Short pitch (reuse): "iDuckPDF is a free PDF toolbox that runs in your browser: merge, split, compress to a size, sign, OCR, Word/Excel conversions and more. No sign-up, no watermark, no ads, and your files are not uploaded (the AI tools are the exception and use your own key)."

## Directories and launch sites

1. **AlternativeTo** (alternativeto.net): add iDuckPDF as an alternative to iLovePDF and Smallpdf. Draft description: the short pitch plus "Honest limits: Office conversions are simplified, no desktop or mobile app yet." Tags: pdf, privacy, web.
2. **Product Hunt**: launch page. Tagline: "Free PDF tools that never upload your file". First comment: why you built it (private documents), what runs locally, the known limits, and a request for feature ideas. Pick a weekday, and be ready to answer comments all day.
3. **Hacker News, Show HN**: title "Show HN: iDuckPDF, 51 PDF tools that run in your browser (no upload)". Draft: a few lines on the engines (pdf-lib, pdf.js, Tesseract.js in WebAssembly, own Office converters), how to verify in the Network tab that nothing is uploaded, and the limits. Expect technical questions.
4. **Indie Hackers**: product page and a short "what I built and why" post with honest numbers once you have them.
5. **Slant / SaaSHub / Futurepedia-style directories**: submit the short pitch; use the "free, no sign-up" angle. Skip any directory that asks for payment.
6. **Open-source-style "awesome" lists on GitHub**: only if the repo is made public (currently private, so it cannot be listed). Candidate lists to check: awesome lists for PDF tools and for privacy-respecting software. Open a pull request following each list's contribution rules; if the project is not open source, most lists will decline it.
7. **PrivacyTools-style and "privacy-friendly alternatives" lists**: only submit if the list accepts closed-source web apps. Draft: emphasise local processing and the Network-tab check, and state the AI exception plainly.

## Reddit (read each subreddit's rules and self-promotion limits first)

8. **r/InternetIsBeautiful**: allows interesting sites with a link post and no begging. Draft title: "A PDF toolbox that runs entirely in your browser tab". Add a one-line comment about what is not uploaded.
9. **r/privacy** and **r/PrivacyTools-type communities**: often restrict self-promotion; consider commenting helpfully on "which PDF site is safe" threads instead, with a disclosure ("I made one that runs locally") rather than posting a standalone ad.
10. **r/SideProject**: designed for this. Draft: what it does, the tech, what you learned, what feedback you want.
11. **r/webdev** (Showoff Saturday style threads if available): focus on the engineering: running pdf.js and Tesseract in WebAssembly, the CSP without inline scripts, pre-rendering a React Native (Expo) web app.
12. **r/software and r/freesoftware**: check whether free web tools are allowed; post only if so.
13. **r/Entrepreneur or r/EntrepreneurRideAlong**: only in the weekly share threads they provide, not as new posts.

## India-focused places (a good fit for the compress-to-100/200/500 KB and e-Aadhaar pages)

14. **Student and exam-prep communities** (for example subreddits and Telegram or Discord groups for competitive exams and college admissions): answer real questions like "how do I get my PDF under 200 KB" with the Compress PDF to 200 KB page and a disclosure. Do not drop links unprompted.
15. **Quora India**: write real answers to "how to reduce PDF size to 100 KB / 200 KB" questions, link the matching page, state that you made it, and explain when the target cannot be reached.
16. **r/developersIndia and r/IndiaTech** (check rules): a "Show" or "I built" post focused on a free, no-upload tool for common government-form PDF problems.
17. **YouTube or Instagram creators who explain government forms**: a short, polite email offering the tool for their audience, with no payment and no pressure. Draft: "Many viewers ask how to get a PDF under 200 KB for a form. This free tool does it in the browser without uploading anything. It is yours to mention or ignore."

## Communities for makers and writers

18. **dev.to or Hashnode article**: "How we run OCR and PDF editing in the browser without uploading files" (pdf.js 6 as a self-hosted ES module, WASM decoders, strict CSP). Link the site at the end.
19. **Mastodon / Bluesky / X**: a short thread with a screen recording of compressing a PDF to a target size and the Network tab showing no upload.
20. **Newsletters and roundups that cover free tools** (for example small "tool of the week" newsletters): email the editor three lines: what it is, who it helps, and one verifiable claim (the Network-tab check). Offer to answer questions; never offer payment for coverage.

## What to prepare first

- A 30-second screen recording of compressing a scan to a size target, with the browser's Network tab visible.
- A public page or repo explaining the engines, if you decide to open the source (some lists require it).
- Search Console and Bing set up (see AUDIT.md) so you can watch what traffic arrives.
