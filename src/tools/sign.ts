import { PDFCheckBox, PDFDropdown, PDFOptionList, PDFRadioGroup, PDFTextField, StandardFonts, degrees } from 'pdf-lib';
import type { Placement, ToolDef } from '../engine/types';
import { ToolError, baseName, loadDoc, needOne, pdfOut, save } from '../engine/util';
import { placeImage } from '../engine/placement';

/** A PNG data URL ("data:image/png;base64,...") to bytes. */
export function dataUrlToBytes(url: string): Uint8Array {
  const m = /^data:image\/(png|jpeg|jpg);base64,(.+)$/i.exec(url || '');
  if (!m) throw new ToolError('Create your signature first: draw it, type it or upload a picture.');
  const bin = atob(m[2]);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export type FormField = {
  name: string;
  kind: 'text' | 'checkbox' | 'dropdown' | 'radio' | 'list';
  value: string | boolean;
  options?: string[];
  multiline?: boolean;
  readOnly?: boolean;
};

/** The fields of a PDF form that a person can fill in. Buttons and signature fields are left out. */
export async function listFormFields(bytes: Uint8Array): Promise<FormField[]> {
  const doc = await loadDoc({ name: 'form.pdf', size: bytes.length, type: 'application/pdf', bytes: async () => bytes });
  let fields;
  try {
    fields = doc.getForm().getFields();
  } catch {
    return [];
  }
  const out: FormField[] = [];
  for (const f of fields) {
    const name = f.getName();
    const readOnly = f.isReadOnly();
    if (f instanceof PDFTextField) out.push({ name, kind: 'text', value: f.getText() ?? '', multiline: f.isMultiline(), readOnly });
    else if (f instanceof PDFCheckBox) out.push({ name, kind: 'checkbox', value: f.isChecked(), readOnly });
    else if (f instanceof PDFDropdown) out.push({ name, kind: 'dropdown', value: f.getSelected()[0] ?? '', options: f.getOptions(), readOnly });
    else if (f instanceof PDFRadioGroup) out.push({ name, kind: 'radio', value: f.getSelected() ?? '', options: f.getOptions(), readOnly });
    else if (f instanceof PDFOptionList) out.push({ name, kind: 'list', value: f.getSelected()[0] ?? '', options: f.getOptions(), readOnly });
  }
  return out;
}

const DEFAULT_PLACEMENT: Placement = { page: 1, x: 0.55, y: 0.82, w: 0.3 };

export const signTools: ToolDef[] = [
  {
    id: 'sign',
    name: 'Sign a PDF',
    short: 'Draw, type or upload a signature and place it on the page.',
    desc: 'Add your signature to a PDF. Draw it with your finger or mouse, type it, or upload a picture, then drag it into place and resize it. Everything happens in your browser tab, so the document and your signature never leave your device.',
    category: 'markup',
    icon: '🖊️',
    keywords: ['signature', 'sign', 'initial', 'esign', 'e-sign', 'autograph', 'sign document', 'handwritten'],
    inputs: [{ key: 'files', label: 'PDF to sign', accept: 'pdf' }],
    options: [
      { key: 'signature', type: 'signature', label: 'Your signature', hint: 'Draw it, type it or upload a picture of it.' },
      { key: 'placement', type: 'placement', label: 'Place it on the page', signatureKey: 'signature', hint: 'Drag the signature where you want it. Drag the corner, or use the size slider, to resize it.' },
      { key: 'applyTo', type: 'select', label: 'Put it on', default: 'this', options: [{ value: 'this', label: 'This page' }, { value: 'all', label: 'Every page' }, { value: 'first', label: 'First page' }, { value: 'last', label: 'Last page' }], hint: 'Handy for initialling every page.' },
    ],
    runLabel: 'Sign now',
    tips: ['Your signature is added as a picture. It is a visual signature, not a certified digital one.', 'To sign in more than one place, run the tool again on the signed copy.'],
    faq: [
      { q: 'Is this a legally binding signature?', a: 'It is a visual (electronic) signature, which many everyday documents accept. It is not a certificate-based digital signature. Check what the recipient or your local rules require.' },
      { q: 'Is my signature stored or uploaded?', a: 'No. It is drawn and placed inside your browser tab and is gone when you close it. Nothing is sent to a server.' },
      { q: 'Can I sign more than once on a page?', a: 'Yes. Download the signed copy and run it through the tool again to add another signature or initials.' },
    ],
    status: 'ready',
    async run({ files, opts, progress }) {
      const f = needOne(files.files);
      const png = dataUrlToBytes(String(opts.signature || ''));
      const place: Placement = { ...DEFAULT_PLACEMENT, ...(opts.placement || {}) };
      progress(0.1, 'Loading the PDF…');
      const doc = await loadDoc(f);
      const n = doc.getPageCount();
      const img = String(opts.signature).startsWith('data:image/png') ? await doc.embedPng(png) : await doc.embedJpg(png);
      const aspect = img.width / img.height;
      const which = String(opts.applyTo || 'this');
      const targets = which === 'all' ? doc.getPageIndices() : which === 'first' ? [0] : which === 'last' ? [n - 1] : [Math.min(Math.max(1, Math.round(place.page || 1)), n) - 1];
      targets.forEach((idx, i) => {
        const page = doc.getPage(idx);
        const p = placeImage(page.getCropBox(), page.getRotation().angle, place, aspect);
        page.drawImage(img, { x: p.x, y: p.y, width: p.width, height: p.height, rotate: degrees(p.angle) });
        progress(0.2 + (0.7 * (i + 1)) / targets.length, `Signed page ${idx + 1}`);
      });
      const bytes = await save(doc);
      return { files: [pdfOut(`${baseName(f.name)}-signed.pdf`, bytes)], notes: [`Signature added to ${targets.length === 1 ? `page ${targets[0] + 1}` : `${targets.length} pages`}.`] };
    },
  },
  {
    id: 'fill',
    name: 'Fill in a form',
    short: 'Type into the fillable fields of a PDF form.',
    desc: 'Fill in an interactive PDF form: text boxes, check boxes, drop-downs and radio buttons are listed for you to complete, then saved into a new PDF. Optionally make the answers permanent. Everything stays in your browser.',
    category: 'markup',
    icon: '📋',
    keywords: ['form', 'fillable', 'acroform', 'fields', 'fill form', 'fill out', 'complete form', 'checkbox', 'application'],
    inputs: [{ key: 'files', label: 'PDF form', accept: 'pdf' }],
    options: [
      { key: 'fields', type: 'formfields', label: 'Form fields' },
      { key: 'flatten', type: 'toggle', label: 'Make the answers permanent', default: false, hint: 'Turns the fields into ordinary page content so they can no longer be edited. Do this for the copy you send.' },
    ],
    runLabel: 'Fill form',
    tips: ['Only forms with real fillable fields are listed. For a flat PDF with no fields, use “Write on a PDF” to place text anywhere.', 'Keep the unflattened copy if you may need to change an answer later.'],
    faq: [
      { q: 'Why does my PDF show no fields?', a: 'Many PDFs are just pictures of forms. Only PDFs created with interactive fields can be filled this way. For other PDFs, use “Write on a PDF”.' },
      { q: 'What does “make the answers permanent” do?', a: 'It flattens the form: your answers are merged into the page and the boxes disappear. Flattened forms cannot be edited again.' },
      { q: 'Is my data uploaded?', a: 'No. The form is read and filled inside your browser tab.' },
    ],
    status: 'ready',
    async run({ files, opts, progress }) {
      const f = needOne(files.files);
      const values: Record<string, string | boolean> = opts.fields || {};
      progress(0.1, 'Loading the form…');
      const doc = await loadDoc(f);
      const form = doc.getForm();
      const fields = form.getFields();
      if (!fields.length) throw new ToolError('This PDF has no fillable fields. Use “Write on a PDF” to place text anywhere on a page.');
      let changed = 0;
      for (const field of fields) {
        const name = field.getName();
        if (!(name in values) || field.isReadOnly()) continue;
        const v = values[name];
        try {
          if (field instanceof PDFTextField) field.setText(String(v ?? ''));
          else if (field instanceof PDFCheckBox) (v ? field.check() : field.uncheck());
          else if (field instanceof PDFDropdown) (v ? field.select(String(v)) : field.clear());
          else if (field instanceof PDFRadioGroup) { if (v) field.select(String(v)); }
          else if (field instanceof PDFOptionList) (v ? field.select(String(v)) : field.clear());
          else continue;
          changed++;
        } catch (e: any) {
          throw new ToolError(`Could not fill “${name}”: ${String(e?.message || e).slice(0, 120)}`);
        }
      }
      progress(0.6, 'Drawing the answers…');
      try {
        form.updateFieldAppearances(await doc.embedFont(StandardFonts.Helvetica));
      } catch {
        throw new ToolError('One of the answers contains a character this form’s font cannot show. Try plain letters and numbers.');
      }
      if (opts.flatten) form.flatten();
      const bytes = await save(doc);
      progress(1);
      return { files: [pdfOut(`${baseName(f.name)}-filled.pdf`, bytes)], notes: [`${changed} field${changed === 1 ? '' : 's'} filled${opts.flatten ? ' and made permanent' : ''}.`] };
    },
  },
];
