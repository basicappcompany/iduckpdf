/**
 * Writes src/tools/meta.generated.json: every tool's metadata (name, options, FAQ, ...) without the run() code.
 * Pages import that small JSON; the heavy run() code is loaded lazily the first time a tool is used.
 * Runs automatically before typecheck, tests, dev server and the web export. Commit the result.
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { ALL_TOOLS } from '../src/tools/all';
import { RESERVED_ROOT_PATHS, TOOL_SLUGS } from '../src/content/toolSlugs';

// Every tool URL must contain "pdf", be unique, and not collide with another route.
{
  const seen = new Map<string, string>();
  const errs: string[] = [];
  for (const t of ALL_TOOLS) {
    const slug = TOOL_SLUGS[t.id];
    if (!slug) errs.push(`${t.id}: no slug in src/content/toolSlugs.ts`);
    else {
      if (!/pdf/.test(slug)) errs.push(`${t.id}: slug "${slug}" must contain "pdf"`);
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) errs.push(`${t.id}: slug "${slug}" must be lowercase words joined by hyphens`);
      if (RESERVED_ROOT_PATHS.includes(slug)) errs.push(`${t.id}: slug "${slug}" collides with a site route`);
      if (seen.has(slug)) errs.push(`${t.id}: slug "${slug}" is also used by ${seen.get(slug)}`);
      seen.set(slug, t.id);
    }
  }
  for (const id of Object.keys(TOOL_SLUGS)) if (!ALL_TOOLS.some((t) => t.id === id)) errs.push(`slug for unknown tool "${id}"`);
  if (errs.length) {
    console.error('[gen-tool-meta] tool URL problems:\n  - ' + errs.join('\n  - '));
    process.exit(1);
  }
}

const meta = ALL_TOOLS.map(({ run: _run, ...rest }) => rest);
const bad = JSON.stringify(meta, (_k, v) => (typeof v === 'function' ? '__FUNCTION__' : v)).includes('__FUNCTION__');
if (bad) {
  console.error('[gen-tool-meta] a tool definition contains a function outside run(). Use declarative data instead (see ShowIf).');
  process.exit(1);
}
const out = JSON.stringify(meta, null, 1) + '\n';
writeFileSync(join(__dirname, '..', 'src', 'tools', 'meta.generated.json'), out);
console.log(`[gen-tool-meta] ${meta.length} tools, ${(out.length / 1024).toFixed(1)} KB`);
