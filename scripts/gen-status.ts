/**
 * Rewrites the generated tool table inside docs/status.html from the real tool registry, so the status page can never list a
 * tool, URL or state that is not in the code. Runs as part of `npm run meta`. The rest of the page (phases, decisions, timeline)
 * is hand-written data in that file.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { CATEGORIES } from '../src/engine/types';
import { TOOL_SLUGS } from '../src/content/toolSlugs';
import meta from '../src/tools/meta.generated.json';

const file = join(__dirname, '..', 'docs', 'status.html');
const html = readFileSync(file, 'utf8');
const START = '/* GENERATED:TOOLS:START';
const END = '/* GENERATED:TOOLS:END */';
const a = html.indexOf(START);
const b = html.indexOf(END);
if (a < 0 || b < 0 || b < a) {
  console.warn('[gen-status] markers not found in docs/status.html, skipped');
  process.exit(0);
}

const catName = (id: string) => CATEGORIES.find((c) => c.id === id)?.name ?? id;
const rows = (meta as any[]).map((t) => ({ id: t.id, name: t.name, icon: t.icon, category: catName(t.category), slug: TOOL_SLUGS[t.id] ?? t.id, status: t.status }));

const startLineEnd = html.indexOf('\n', a);
const crlf = html.includes('\r\n');
const eol = crlf ? '\r\n' : '\n';
const block = `const TOOLS_DATA = ${JSON.stringify(rows)};`;
const next = html.slice(0, startLineEnd + 1) + block + eol + html.slice(b);
if (next !== html) writeFileSync(file, next);
console.log(`[gen-status] ${rows.length} tools written to docs/status.html`);
