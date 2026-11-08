# iDuckPDF

Free PDF tools in the browser: join, cut, arrange, mark up, shrink, clean and compare PDFs.
Built with **Expo (React Native + react-native-web)**, so one codebase serves the website today and can become the Android / iOS apps later.

- Tool engine: [`pdf-lib`](https://pdf-lib.js.org) for editing, [`pdf.js`](https://mozilla.github.io/pdf.js/) for rendering and text.
- Most tools run entirely in the browser tab. The two AI tools call the provider the user configures, with the user's own key.
- Status and open items: [`docs/TRACKER.md`](docs/TRACKER.md) and [`docs/TODO.md`](docs/TODO.md).
- Earlier HTML prototypes live in [`prototype/`](prototype/).

## Run it
```bash
npm install                  # also copies pdf.js into public/vendor
npm run web                  # dev server (needs a few GB of free RAM)
npm run export:web           # production build: seo files -> static export -> SEO tag injection -> dist/
npm run audit                # crawler-style SEO audit of dist/ (run after export:web)
npm run typecheck             # also regenerates src/tools/meta.generated.json
npm run meta                  # regenerate the light tool metadata (run after editing anything in src/tools/)
npm run test:engine          # PDF engine tests in Node, no browser needed
npm run icons                # regenerate the duck icons and social card (outputs are committed)
```
Preview `dist/` with `npx serve dist -l 8080`. Do **not** use `serve -s` (single-page fallback): it answers every URL with the home page and hides the per-page HTML. The browser smoke test is `npm run e2e` (needs `PLAYWRIGHT_CORE`, see the script header).

### How SEO works here
- `output: "static"` pre-renders every route (tools and guides via `generateStaticParams`).
- Expo's `<Head>` is dropped during static export and a custom `+html.tsx` removes the app bundle, so neither is used. Instead `src/lib/seoData.ts` (`seoForPath`) is the single source for each page's title, description, canonical, robots rule and JSON-LD, and `scripts/inject-seo.ts` writes them into every HTML file after the build.
- `src/content/` holds the tool copy and guides. `scripts/gen-seo.ts` builds `sitemap.xml`, `llms.txt` and `llms-full.txt` from the same registries, so they cannot drift.
- Links must be real anchors: use `Btn`/`Chip`/`ToolCard`/`LinkCard` with `to=`, never a bare `router.push`.

## Deploy
Hosted on Cloudflare Pages (project `iduckpdf`, direct upload). After `npm run export:web` and `npm run audit`:
```bash
npx wrangler pages deploy dist --project-name iduckpdf --branch main
```
Sign in once with `npx wrangler login`. `functions/` is bundled automatically. Pushes to `main` also run `.github/workflows/deploy.yml` (typecheck, engine tests, build, SEO audit, then deploy once the `CLOUDFLARE_API_TOKEN` secret exists). Domain and DNS notes are in `docs/TODO.md` §3.

## Layout
```
src/app/        screens (Expo Router): home, tools, tool/[id], guides, chat, feedback, request, donate, roadmap, settings, about
src/tools/      one file per category; each tool is a small definition + run() function; index.ts is the registry
src/engine/     shared PDF helpers, file I/O, pdf.js + canvas helpers (*.native.ts are stubs for the future apps)
src/ui/         themed building blocks, tool screen, sidebar shell
src/content/    tool SEO copy, guides, home FAQ (plain TS, also read by the build scripts)
src/lib/        theme, command palette, storage, AI client, mail helper, SEO data
functions/      Cloudflare Pages Function: POST /api/donate (Dodo Payments checkout)
scripts/        gen-seo, gen-tool-meta, inject-seo, audit-seo, make-icons, test-engine, e2e-smoke
public/         robots.txt, manifest, _headers, icons, og.png, llms files (generated), pdf.js (copied)
```

## Adding a tool
Add a `ToolDef` to a file in `src/tools/` (inputs, options, `run`). It appears in the sidebar, palette, home page, helper and search automatically.
