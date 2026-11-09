import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { PickedFile } from '../../engine/types';
import { preloadEngine } from '../../tools';
import { Banner, Btn, Choice, Field, T, TextField, Toggle } from '../kit';

type Field_ = Awaited<ReturnType<Awaited<ReturnType<typeof preloadEngine>>['listFormFields']>>[number];

/** The fillable fields of the chosen PDF as ordinary inputs. The value maps each field's name to its text, tick or choice. */
export function FormFieldsEditor({ label, file, value, onChange }: { label: string; file?: PickedFile; value: Record<string, any>; onChange: (v: Record<string, any>) => void }) {
  const [fields, setFields] = useState<Field_[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let dead = false;
    setFields(null);
    setError('');
    if (!file) return;
    (async () => {
      try {
        const m = await preloadEngine();
        const list = await m.listFormFields(await file.bytes());
        if (dead) return;
        setFields(list);
        const initial: Record<string, any> = {};
        list.forEach((f) => (initial[f.name] = f.value));
        onChange(initial);
      } catch (e: any) {
        if (!dead) setError(e?.message || 'This PDF could not be read. It may be damaged or password-protected.');
      }
    })();
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.name, file?.size]);

  const set = (name: string, v: any) => onChange({ ...value, [name]: v });

  if (!file) return <T muted>Add your PDF above to see its form fields here.</T>;
  if (error) return <Banner tone="error"><T v="small" color="#fff">{error}</T></Banner>;
  if (!fields) return <T muted>Reading the form…</T>;
  if (!fields.length) {
    return (
      <View style={{ gap: 8 }}>
        <Banner tone="warn">This PDF has no fillable fields. It may be a picture of a form. You can still place text anywhere on a page.</Banner>
        <View style={{ alignSelf: 'flex-start' }}><Btn label="Write on a PDF" icon="✍️" small variant="ghost" to="/add-text-to-pdf" /></View>
      </View>
    );
  }
  return (
    <View style={{ gap: 12 }}>
      <T v="label">{label} ({fields.length})</T>
      {fields.map((f) => {
        const v = value[f.name];
        if (f.readOnly) return <T key={f.name} v="small" muted>{f.name}: read-only, left as it is.</T>;
        if (f.kind === 'checkbox') return <Toggle key={f.name} label={f.name} value={!!v} onChange={(x) => set(f.name, x)} />;
        if (f.kind === 'dropdown' || f.kind === 'list' || f.kind === 'radio') {
          return (
            <Field key={f.name} label={f.name}>
              <Choice options={[{ value: '', label: '(none)' }, ...(f.options || []).map((o) => ({ value: o, label: o }))]} value={String(v ?? '')} onChange={(x) => set(f.name, x)} />
            </Field>
          );
        }
        return <Field key={f.name} label={f.name}><TextField value={String(v ?? '')} onChange={(x) => set(f.name, x)} multiline={f.multiline} /></Field>;
      })}
    </View>
  );
}
