// Browser file handling. (io.native.ts replaces this on iOS/Android — future scope.)
import type { PickedFile } from './types';
import { toBlob } from './util';

export type PickOpts = { accept: 'pdf' | 'image' | 'any'; multiple?: boolean; camera?: boolean };

const ACCEPT = { pdf: 'application/pdf,.pdf', image: 'image/*', any: '*/*' } as const;

export function wrapFile(f: File): PickedFile {
  return { name: f.name, size: f.size, type: f.type, bytes: async () => new Uint8Array(await f.arrayBuffer()) };
}

export function acceptsFile(f: File, accept: PickOpts['accept']): boolean {
  if (accept === 'any') return true;
  if (accept === 'pdf') return f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
  return f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(f.name);
}

export function pickFiles(o: PickOpts): Promise<PickedFile[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPT[o.accept];
    input.multiple = !!o.multiple;
    if (o.camera) input.setAttribute('capture', 'environment');
    input.style.display = 'none';
    input.onchange = () => {
      resolve(Array.from(input.files || []).filter((f) => acceptsFile(f, o.accept)).map(wrapFile));
      input.remove();
    };
    input.addEventListener('cancel', () => {
      resolve([]);
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
  });
}

export function saveFile(name: string, bytes: Uint8Array, mime: string): void {
  const url = URL.createObjectURL(toBlob(bytes, mime));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function openExternal(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** mailto: links must navigate the current tab, or browsers open a blank one. */
export function openMail(url: string): void {
  window.location.href = url;
}
