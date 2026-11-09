/**
 * Titles and descriptions of the guides, without their text. The footer, the home page and the guides list need only this, so
 * the full guide text (src/content/guides.ts) stays out of the first load of every other page. The JSON is written by
 * scripts/gen-tool-meta.ts from guides.ts and committed, like the tool metadata.
 */
import index from './guides.index.json';

export type GuideIndexEntry = { slug: string; title: string; description: string; tool: string };
export const GUIDE_INDEX = index as GuideIndexEntry[];
