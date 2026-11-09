import type { ToolDef } from '../engine/types';

const soon = (t: Pick<ToolDef, 'id' | 'name' | 'short' | 'desc' | 'icon' | 'keywords' | 'phase' | 'reason'>): ToolDef => ({
  ...t,
  category: 'soon',
  inputs: [],
  status: 'soon',
});

export const soonTools: ToolDef[] = [
];
