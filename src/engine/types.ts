export type PickedFile = {
  name: string;
  size: number;
  type: string;
  bytes: () => Promise<Uint8Array>;
};

export type OutFile = { name: string; mime: string; bytes: Uint8Array };

/** Declarative so tool metadata is plain JSON: show when opts[key] equals eq, differs from ne, or (off) is falsy. */
export type ShowIf = { key: string; eq?: unknown; ne?: unknown; off?: true };
export const isShown = (c: ShowIf | undefined, o: Record<string, any>): boolean =>
  !c ? true : c.off ? !o[c.key] : 'eq' in c ? o[c.key] === c.eq : 'ne' in c ? o[c.key] !== c.ne : true;

/** Where a signature sits on a page: top-left as a fraction of the displayed page, width as a fraction of the page width. */
export type Placement = { page: number; x: number; y: number; w: number };

export type Option =
  | { key: string; type: 'text' | 'textarea' | 'number' | 'password'; label: string; placeholder?: string; default?: string | number; hint?: string; showIf?: ShowIf }
  | { key: string; type: 'select'; label: string; options: { value: string; label: string }[]; default: string; hint?: string; showIf?: ShowIf }
  | { key: string; type: 'toggle'; label: string; default: boolean; hint?: string; showIf?: ShowIf }
  /** Draw, type or upload a signature. The value is a PNG data URL with a transparent background (or '' before one exists). */
  | { key: string; type: 'signature'; label: string; hint?: string; showIf?: ShowIf }
  /** Page preview with a draggable, resizable image on it. The value is a Placement; the image comes from another option. */
  | { key: string; type: 'placement'; label: string; hint?: string; signatureKey: string; showIf?: ShowIf }
  /** The fillable fields of the chosen PDF, as inputs. The value maps field name to text, true/false or the chosen option. */
  | { key: string; type: 'formfields'; label: string; hint?: string; showIf?: ShowIf };

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
  { id: 'markup', name: 'Stamp & annotate', blurb: 'Page numbers, watermarks, headers, text, signatures and forms.', icon: '🖋️' },
  { id: 'convert', name: 'Make & extract', blurb: 'PDFs to and from images, text, Word, Excel, PowerPoint and web pages, plus OCR.', icon: '🔁' },
  { id: 'shrink', name: 'Shrink & restyle', blurb: 'Smaller files, grayscale, dark mode.', icon: '🪶' },
  { id: 'privacy', name: 'Privacy & cleanup', blurb: 'Passwords, inspect, strip metadata, flatten, redact.', icon: '🧼' },
  { id: 'insight', name: 'Compare & ask', blurb: 'Diff two PDFs, or ask questions with your own AI key.', icon: '🔎' },
  { id: 'soon', name: 'On the roadmap', blurb: 'Planned tools that need more engine work.', icon: '🛠️' },
];
