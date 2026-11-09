---
name: docs-sync
description: End-of-day (or on request) sync of iDuckPDF's docs and status page with what actually shipped and was verified. Use when the user says "docs-sync", "update the docs", "sync the docs", or at the end of a work session.
---

# docs-sync for iDuckPDF

Bring `docs/status.html`, `docs/TRACKER.md`, `docs/TODO.md` and `README.md` in line with reality, in one pull request. Never write a claim you have not verified in this session or in the repo.

## 1. Work out what changed
- `git log --oneline main` since the last "Docs" commit, plus `gh pr list --repo basicappcompany/iduckpdf --state merged --limit 20`.
- Things done outside the repo that the user or you did in the dashboards (Cloudflare, Gmail, Search Console, Bing, Dodo). Take these from the conversation, not from guesses.
- Anything still open or newly discovered (a failed attempt, a quota, a decision waiting on the user).

## 2. Re-measure what the docs quote
Do not copy numbers from old docs. Re-read them from the source:
- Tool count and categories: `src/tools/meta.generated.json` (`npm run meta` regenerates it and the tool table in `docs/status.html`).
- Guides: `src/content/guides.index.json`. Pages / indexable / sitemap URLs: run `npm run export:web` then `npm run audit`.
- Tests: `npm run test:engine` (Node checks) and `node scripts/e2e-smoke.js`, `node scripts/e2e-tools.js` (need `PLAYWRIGHT_CORE` set to a playwright-core path locally; CI installs its own). Quote the real pass counts.
- Performance: only quote Lighthouse numbers measured this session, and say they are live and mobile.
- Live checks when relevant: `curl -sI` for redirects and status codes; `BASE_URL=https://iduckpdf.com node scripts/e2e-tools.js` for the live suites.

## 3. Update, in this order
1. `docs/status.html`: the `PHASES` array (set each item's state `done | todo | waiting | later`, owner `me | you | both | none | external`, `when`, honest `note`, and numbered `steps` for anything the owner must do), then `DECISIONS`, `TIMELINE` (newest entry last), `SCORECARD`, and `VERIFIED`. Add new items rather than stretching old ones. The tool table between the `GENERATED:TOOLS` markers is rewritten by `npm run status`; never hand-edit it.
2. `docs/TRACKER.md`: totals line, feature/deployment/SEO/quality tables, "How the checks were done", known limits.
3. `docs/TODO.md`: tick or add checkboxes, keep owner-only steps concrete.
4. `README.md`: only if commands, layout, the stack or the release flow changed.
5. Sweep stale values everywhere: `grep -rn` for old counts (tools, guides, pages, tests, "planned", "coming soon", old URLs) across `README.md docs src scripts public/*.txt .github`. Anything that now disagrees gets fixed, unasked.

## 4. Verify
- `npm run typecheck`, `npm run export:web`, `npm run audit` (copy or `llms` changes alter pages).
- Open `docs/status.html` in Playwright (light and dark, phone and desktop): every item renders, the "needs you" and "I can do" counts equal their cards, the tool table row count equals the registry, no console errors, no horizontal overflow.

## 5. Ship it (the repo's workflow rules apply)
- Never push to `main`. New branch (for example `docs-sync-YYYY-MM-DD`), commit, push, open a PR, wait for green CI, squash-merge, delete the branch, pull `main`, confirm the deploy run succeeded.
- Repo files use CRLF line endings: when scripting edits, normalise `\n` and write the original endings back. Write helper scripts to a file with the Write tool instead of nested quotes in the shell.
- Commit and PR bodies end with the attribution lines the harness gives for the session.
- `package-lock.json` must keep public registry URLs (`https://registry.npmjs.org/`).

## 6. Report
List what changed in the docs, the verified numbers, and what is still waiting on the user, split into "needs you" and "I can do". Say plainly what was not checked. Update the project memory file `iduckpdf-project-decisions.md` only with facts that matter to later sessions.

## Boundaries
- Do not mark an item done on the user's word alone if it can be checked (a redirect, a deploy, a page); check it. If it cannot be checked (a mail landing in the inbox, a real phone), say so and leave the item open with the exact next step.
- Do not enter passwords, keys or tokens anywhere, and do not change DNS or security settings: list them as owner steps.
