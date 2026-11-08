// The full tool definitions, WITH their run() functions. This pulls in pdf-lib, pdf.js helpers, JSZip and the AI client,
// so it is only ever loaded on demand (see loadRunner in ./index) and by the Node scripts and tests.
// The light metadata the pages need lives in meta.generated.json, produced from this file by scripts/gen-tool-meta.ts.
import type { ToolDef } from '../engine/types';
import { joinTools } from './join';
import { arrangeTools } from './arrange';
import { markupTools } from './markup';
import { convertTools } from './convert';
import { shrinkTools } from './shrink';
import { privacyTools } from './privacy';
import { insightTools } from './insight';
import { soonTools } from './soon';

export const ALL_TOOLS: ToolDef[] = [
  ...joinTools,
  ...arrangeTools,
  ...markupTools,
  ...convertTools,
  ...shrinkTools,
  ...privacyTools,
  ...insightTools,
  ...soonTools,
];
