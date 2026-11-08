import type { PickedFile } from '../engine/types';

// A one-shot, in-memory hand-off so a tool's result can flow straight into the next tool.
let pending: PickedFile[] | null = null;

export function setHandoff(files: PickedFile[]): void {
  pending = files;
}

export function takeHandoff(): PickedFile[] | null {
  const p = pending;
  pending = null;
  return p;
}
