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
import { secureTools } from './secure';
import { signTools } from './sign';
import { ocrTools } from './ocr';
import { officeTools } from './office';
import { sheetTools } from './sheets';
import { slideTools } from './slides';
import { extraTools } from './extras';
import { textExtraTools } from './textextras';
import { aiTools } from './aitools';
import { soonTools } from './soon';

// Re-exported so the UI can reach JSZip through the lazy engine chunk instead of pulling it into the first load.
export { zipFiles } from '../engine/zip';
export { listFormFields } from './sign';

export const ALL_TOOLS: ToolDef[] = [
  ...joinTools,
  ...arrangeTools,
  ...markupTools,
  ...convertTools,
  ...shrinkTools,
  ...privacyTools,
  ...insightTools,
  ...secureTools,
  ...signTools,
  ...ocrTools,
  ...officeTools,
  ...sheetTools,
  ...slideTools,
  ...extraTools,
  ...textExtraTools,
  ...aiTools,
  ...soonTools,
];
