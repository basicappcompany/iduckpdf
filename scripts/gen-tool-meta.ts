/**
 * Writes src/tools/meta.generated.json: every tool's metadata (name, options, FAQ, ...) without the run() code.
 * Pages import that small JSON; the heavy run() code is loaded lazily the first time a tool is used.
 * Runs automatically before typecheck, tests, dev server and the web export. Commit the result.
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { ALL_TOOLS } from '../src/tools/all';

const meta = ALL_TOOLS.map(({ run: _run, ...rest }) => rest);
const bad = JSON.stringify(meta, (_k, v) => (typeof v === 'function' ? '__FUNCTION__' : v)).includes('__FUNCTION__');
if (bad) {
  console.error('[gen-tool-meta] a tool definition contains a function outside run(). Use declarative data instead (see ShowIf).');
  process.exit(1);
}
const out = JSON.stringify(meta, null, 1) + '\n';
writeFileSync(join(__dirname, '..', 'src', 'tools', 'meta.generated.json'), out);
console.log(`[gen-tool-meta] ${meta.length} tools, ${(out.length / 1024).toFixed(1)} KB`);
