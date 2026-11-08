export type PickedFile = {
  name: string;
  size: number;
  type: string;
  bytes: () => Promise<Uint8Array>;
};

export type OutFile = { name: string; mime: string; bytes: Uint8Array };

export type Option =
  | { key: string; type: 'text' | 'textarea' | 'number' | 'password'; label: string; placeholder?: string; default?: string | number; hint?: string; showIf?: (o: Record<string, any>) => boolean }
  | { key: string; type: 'select'; label: string; options: { value: string; label: string }[]; default: string; hint?: string; showIf?: (o: Record<string, any>) => boolean }
  | { key: string; type: 'toggle'; label: string; default: boolean; hint?: string; showIf?: (o: Record<string, any>) => boolean };

export type InputSlot = {
  key: string;
  label: string;
  accept: 'pdf' | 'image' | 'any';
  multiple?: boolean;
  min?: number;
  hint?: string;
  camera?: boolean;
};

export type ToolResult = {
  files?: OutFile[];
  text?: string;
  textName?: string;
  notes?: string[];
};

export type ToolCtx = {
  files: Record<string, PickedFile[]>;
  opts: Record<string, any>;
  progress: (fraction: number, label?: string) => void;
};

export type CategoryId = 'join' | 'arrange' | 'markup' | 'convert' | 'shrink' | 'privacy' | 'insight' | 'soon';

export type ToolDef = {
  id: string;
  name: string;
  short: string; // card text
  desc: string; // page intro
  category: CategoryId;
  icon: string;
  keywords: string[];
  inputs: InputSlot[];
  options?: Option[];
  run?: (ctx: ToolCtx) => Promise<ToolResult>;
  runLabel?: string;
  tips?: string[];
  faq?: { q: string; a: string }[];
  warn?: string; // shown above the form (e.g. data leaves the browser)
  status: 'ready' | 'soon';
  phase?: 2 | 3;
  reason?: string; // why it is not here yet
};

export const CATEGORIES: { id: CategoryId; name: string; blurb: string; icon: string }[] = [
  { id: 'join', name: 'Join & cut', blurb: 'Merge files, split them, pull pages out.', icon: '✂️' },
  { id: 'arrange', name: 'Arrange & repair', blurb: 'Reorder, rotate, resize, crop and fix pages.', icon: '🗂️' },
  { id: 'markup', name: 'Stamp & annotate', blurb: 'Page numbers, watermarks, headers and text.', icon: '🖋️' },
  { id: 'convert', name: 'Make & extract', blurb: 'PDFs to and from images, text and Markdown.', icon: '🔁' },
  { id: 'shrink', name: 'Shrink & restyle', blurb: 'Smaller files, grayscale, dark mode.', icon: '🪶' },
  { id: 'privacy', name: 'Privacy & cleanup', blurb: 'Inspect, strip metadata, flatten, redact.', icon: '🧼' },
  { id: 'insight', name: 'Compare & ask', blurb: 'Diff two PDFs, or ask questions with your own AI key.', icon: '🔎' },
  { id: 'soon', name: 'On the roadmap', blurb: 'Planned tools that need more engine work.', icon: '🛠️' },
];
