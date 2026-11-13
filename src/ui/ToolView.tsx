import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useHref, useLang, useT } from '../i18n/react';
import { toolSeoFor } from '../i18n/toolContent';
import { useTheme } from '../lib/theme';
import { KEYS, getJSON, setJSON } from '../lib/storage';
import { setHandoff, takeHandoff } from '../lib/handoff';
import { CATEGORIES, TOOLS, byId, inCategory, loadRunner, preloadEngine, type ToolDef } from '../tools';
import { isShown, type InputSlot, type Option, type OutFile, type PickedFile, type ToolResult } from '../engine/types';
import { ToolError, fmtBytes } from '../engine/base';
import { copyText, saveFile } from '../engine/io';
import { Banner, Btn, Card, Choice, Chip, Field, Pill, Screen, T, TextField, Toggle, CardGrid } from './kit';
import { SiteFooter } from './SiteFooter';
import { SITE } from '../config';
import { toolPath } from '../content/toolSlugs';
import { GENERIC_FAQ } from '../content/genericFaq';
import { DropZone } from './DropZone';
import { SignaturePad } from './editors/SignaturePad';
import { PlacementEditor } from './editors/PlacementEditor';
import { FormFieldsEditor } from './editors/FormFieldsEditor';


function defaultsFor(tool: ToolDef): Record<string, any> {
  const o: Record<string, any> = {};
  (tool.options || []).forEach((x) => {
    if (x.type === 'signature') o[x.key] = '';
    else if (x.type === 'placement') o[x.key] = { page: 1, x: 0.55, y: 0.82, w: 0.3 };
    else if (x.type === 'formfields') o[x.key] = {};
    else o[x.key] = x.type === 'toggle' || x.type === 'select' ? x.default : x.default ?? '';
  });
  return o;
}

function Faq({ q, a }: { q: string; a: string }) {
  const { t } = useTheme();
  return (
    <View style={{ borderWidth: 2, borderColor: t.line, borderRadius: 12, backgroundColor: t.card, padding: 12, gap: 4 }}>
      <T v="h3">{q}</T>
      <T muted>{a}</T>
    </View>
  );
}

function FileRow({ f, i, n, multiple, onMove, onRemove }: { f: PickedFile; i: number; n: number; multiple: boolean; onMove: (d: number) => void; onRemove: () => void }) {
  const { t } = useTheme();
  const tr = useT();
  const small = (label: string, on: () => void, disabled?: boolean, name?: string) => (
    <Pressable onPress={on} disabled={disabled} accessibilityRole="button" accessibilityLabel={name || label} style={{ opacity: disabled ? 0.25 : 1 }}>
      {({ hovered }: any) => (
        <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: hovered ? t.duck : 'transparent' }}>
          <Text style={{ color: hovered ? t.duckInk : t.ink, fontWeight: '900', fontSize: 15 }}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 2, borderColor: t.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: t.card }}>
      <Text>{f.type.startsWith('image') ? '🖼️' : '📄'}</Text>
      <Text numberOfLines={1} style={{ flex: 1, color: t.ink, fontWeight: '700' }}>{f.name}</Text>
      <T v="small" muted>{fmtBytes(f.size)}</T>
      {multiple ? small('↑', () => onMove(-1), i === 0, tr('Move {name} up', { name: f.name })) : null}
      {multiple ? small('↓', () => onMove(1), i === n - 1, tr('Move {name} down', { name: f.name })) : null}
      {small('✕', onRemove, false, tr('Remove {name}', { name: f.name }))}
    </View>
  );
}
function OptionControl({ o, value, onChange, file, opts }: { o: Option; value: any; onChange: (v: any) => void; file?: PickedFile; opts: Record<string, any> }) {
  const tr = useT();
  const label = tr(o.label);
  const hint = o.hint ? tr(o.hint) : undefined;
  if (o.type === 'signature') return <SignaturePad label={label} hint={hint} value={String(value || '')} onChange={onChange} />;
  if (o.type === 'placement') return <PlacementEditor label={label} hint={hint} file={file} signature={String(opts[o.signatureKey] || '')} value={value} onChange={onChange} />;
  if (o.type === 'formfields') return <FormFieldsEditor label={label} file={file} value={value || {}} onChange={onChange} />;
  if (o.type === 'toggle') return <View style={{ gap: 4 }}><Toggle label={label} value={!!value} onChange={onChange} />{hint ? <T v="small" muted>{hint}</T> : null}</View>;
  if (o.type === 'select') return <Field label={label} hint={hint}><Choice options={o.options.map((x) => ({ ...x, label: tr(x.label) }))} value={String(value)} onChange={onChange} /></Field>;
  return (
    <Field label={label} hint={hint}>
      <TextField value={String(value ?? '')} onChange={onChange} placeholder={o.placeholder ? tr(o.placeholder) : undefined} multiline={o.type === 'textarea'} secure={o.type === 'password'} numeric={o.type === 'number'} />
    </Field>
  );
}

export function ToolView({ tool }: { tool: ToolDef }) {
  const { t } = useTheme();
  const router = useRouter();
  const href = useHref();
  const tr = useT();
  const lang = useLang();
  const [files, setFiles] = useState<Record<string, PickedFile[]>>(() => {
    const h = takeHandoff();
    const first = tool.inputs[0];
    return h && first && first.accept === 'pdf' ? { [first.key]: first.multiple ? h : h.slice(0, 1) } : {};
  });
  const [opts, setOpts] = useState<Record<string, any>>(() => defaultsFor(tool));
  const [phase, setPhase] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [prog, setProg] = useState({ f: 0, label: '' });
  const [res, setRes] = useState<ToolResult | null>(null);
  const [err, setErr] = useState<{ message: string; code?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch the PDF engine in the background so the first run does not wait on the network, but never while the page is still
  // starting up (evaluating it blocks the main thread): start on the first sign of a person, with a late timer as a fallback.
  useEffect(() => {
    if (tool.status !== 'ready' || typeof window === 'undefined') return;
    const events = ['pointermove', 'pointerdown', 'keydown', 'touchstart', 'scroll'];
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      events.forEach((e) => window.removeEventListener(e, go));
      clearTimeout(timer);
      void preloadEngine().catch(() => {});
    };
    events.forEach((e) => window.addEventListener(e, go, { passive: true, once: true }));
    const timer = setTimeout(go, 8000);
    return () => {
      done = true;
      events.forEach((e) => window.removeEventListener(e, go));
      clearTimeout(timer);
    };
  }, [tool.id, tool.status]);

  const ready = tool.inputs.every((s) => (files[s.key]?.length || 0) >= (s.min ?? 1));
  const visibleOpts = (tool.options || []).filter((o) => isShown(o.showIf, opts));

  const addFiles = (slot: InputSlot, list: PickedFile[]) =>
    setFiles((f) => ({ ...f, [slot.key]: slot.multiple ? [...(f[slot.key] || []), ...list] : list.slice(0, 1) }));
  const removeFile = (slot: InputSlot, i: number) => setFiles((f) => ({ ...f, [slot.key]: (f[slot.key] || []).filter((_, k) => k !== i) }));
  const moveFile = (slot: InputSlot, i: number, d: number) =>
    setFiles((f) => {
      const a = [...(f[slot.key] || [])];
      const j = i + d;
      if (j < 0 || j >= a.length) return f;
      [a[i], a[j]] = [a[j], a[i]];
      return { ...f, [slot.key]: a };
    });

  const run = async () => {
    if (tool.status !== 'ready') return;
    setPhase('running');
    setErr(null);
    setRes(null);
    setProg({ f: 0, label: tr('Starting…') });
    await new Promise((r) => setTimeout(r, 30));
    try {
      const runner = await loadRunner(tool.id);
      if (!runner) throw new ToolError(tr('This tool is not available yet.'));
      const r = await runner({ files, opts, progress: (f, label) => setProg({ f: Math.max(0, Math.min(1, f)), label: label || '' }) });
      setRes(r);
      setPhase('done');
      const recent = getJSON<string[]>(KEYS.recent, []).filter((x) => x !== tool.id);
      setJSON(KEYS.recent, [tool.id, ...recent].slice(0, 8));
    } catch (e: any) {
      setErr({ message: e instanceof ToolError ? tr(e.message) : tr('Something went wrong while processing. Your file may be unusual or very large.'), code: e?.code });
      if (!(e instanceof ToolError)) console.error(e);
      setPhase('error');
    }
  };

  const reset = () => {
    setFiles({});
    setRes(null);
    setErr(null);
    setPhase('idle');
  };

  const downloadAll = async () => {
    if (!res?.files) return;
    const { zipFiles } = await preloadEngine();
    const z = await zipFiles(res.files, `${tool.id}-results.zip`);
    saveFile(z.name, z.bytes, z.mime);
  };

  const nextTools = useMemo(() => {
    if (!res?.files || res.files.length !== 1 || res.files[0].mime !== 'application/pdf') return [];
    const pref = ['compress', 'page-numbers', 'text-watermark', 'rotate', 'reorder', 'properties', 'extract-pages', 'split', 'resize'];
    return pref.map(byId).filter((x): x is ToolDef => !!x && x.id !== tool.id);
  }, [res, tool.id]);

  const sendOn = (out: OutFile, to: string) => {
    setHandoff([{ name: out.name, size: out.bytes.length, type: out.mime, bytes: async () => out.bytes }]);
    router.push(href(toolPath(to)) as any);
  };

  const seo = toolSeoFor(lang, tool.id);
  const toolName = tr(tool.name);
  // English pages lead with the phrase people search ("Compress PDF"); the friendly name stays as the card label and a tag above
  const h1 = (lang === 'en' || lang === 'en-gb') && seo?.h1 ? seo.h1 : '';
  const related = inCategory(tool.category).filter((x) => x.id !== tool.id && x.status === 'ready').slice(0, 4);
  const cat = CATEGORIES.find((c) => c.id === tool.category);

  /* ---------- roadmap tool ---------- */
  if (tool.status === 'soon') {
    return (
      <Screen narrow>
        <View style={{ gap: 6 }}>
          <T v="small" muted>{cat ? tr(cat.name) : ''}</T>
          <T v="h1">{tool.icon} {toolName}</T>
          <T muted>{tr(tool.desc)}</T>
        </View>
        <Card hot>
          <T v="h3" color={t.duckInk}>{tr('Not built yet · Phase {n}', { n: tool.phase ?? '' })}</T>
          <T color={t.duckInk} style={{ marginTop: 6 }}>{tool.reason ? tr(tool.reason) : ''}</T>
        </Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <Btn label={tr('Request this tool')} icon="💡" to={`/request?tool=${tool.id}`} />
          <Btn label={tr('See the roadmap')} variant="ghost" to="/roadmap" />
        </View>
        <T v="h2" style={{ marginTop: 8 }}>{tr('You can already do this much')}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {TOOLS.filter((x) => x.status === 'ready').slice(0, 8).map((x) => <Chip key={x.id} label={tr(x.name)} icon={x.icon} to={toolPath(x.id)} />)}
        </View>
      </Screen>
    );
  }

  /* ---------- working tool ---------- */
  return (
    <Screen narrow>
      <View style={{ gap: 8 }}>
        <T v="small" muted>{cat?.icon} {cat ? tr(cat.name) : ''}{h1 ? ` · ${tool.icon} ${toolName}` : ''}</T>
        <T v="h1">{h1 ? h1 : `${tool.icon} ${toolName}`}</T>
        <T muted>{tr(tool.desc)}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
          <Pill tone="ok">{tool.warn ? tr('Uses your AI key') : tr('Runs in your browser')}</Pill>
          <Pill>{tr('No sign-up')}</Pill>
          <Pill>{tr('No watermark')}</Pill>
        </View>
      </View>

      {seo ? (
        <Card style={{ gap: 4 }}>
          <T v="label" muted>{tr('Quick answer')}</T>
          <T>{seo.answer}</T>
        </Card>
      ) : null}

      {tool.warn ? <Banner tone="warn">{tr(tool.warn)}</Banner> : null}

      {phase !== 'done' ? (
        <>
          {tool.inputs.map((slot) => {
            const list = files[slot.key] || [];
            return (
              <View key={slot.key} style={{ gap: 10 }}>
                {tool.inputs.length > 1 ? <T v="h3">{tr(slot.label)}</T> : null}
                {slot.multiple || list.length === 0 ? (
                  <DropZone label={list.length ? tr('Add more files') : tr(slot.label)} hint={slot.hint ? tr(slot.hint) : undefined} accept={slot.accept} multiple={slot.multiple} camera={slot.camera} compact={list.length > 0} onFiles={(l) => addFiles(slot, l)} />
                ) : null}
                {list.map((f, i) => (
                  <FileRow key={f.name + i} f={f} i={i} n={list.length} multiple={!!slot.multiple} onMove={(d) => moveFile(slot, i, d)} onRemove={() => removeFile(slot, i)} />
                ))}
                {slot.min && slot.min > 1 && list.length < slot.min ? <T v="small" muted>{tr('Add at least {n} files.', { n: slot.min })}</T> : null}
              </View>
            );
          })}

          {visibleOpts.length ? (
            <Card style={{ gap: 14 }}>
              {visibleOpts.map((o) => (
                <OptionControl key={o.key} o={o} value={opts[o.key]} opts={opts} file={files[tool.inputs[0]?.key]?.[0]} onChange={(v) => setOpts((p) => ({ ...p, [o.key]: v }))} />
              ))}
            </Card>
          ) : null}

          {err ? (
            <Banner tone="error">
              <T v="small" color="#fff">{err.message}</T>
              {err.code === 'NO_KEY' ? <View style={{ marginTop: 8, alignSelf: 'flex-start' }}><Btn label={tr('Open Settings')} small to="/settings" variant="ghost" /></View> : null}
            </Banner>
          ) : null}

          <View style={{ gap: 10 }}>
            <Btn label={phase === 'running' ? tr('Working…') : tr(tool.runLabel || 'Go')} onPress={run} disabled={!ready || phase === 'running'} />
            {phase === 'running' ? (
              <View style={{ gap: 6 }}>
                <View style={{ height: 14, borderWidth: 2, borderColor: t.line, borderRadius: 8, backgroundColor: t.soft, overflow: 'hidden' }}>
                  <View style={{ width: `${Math.max(6, Math.round(prog.f * 100))}%`, height: '100%', backgroundColor: t.duck }} />
                </View>
                <T v="small" muted>{prog.label ? tr(prog.label) : tr('Working…')}</T>
              </View>
            ) : null}
          </View>
        </>
      ) : (
        <View style={{ gap: 12 }}>
          <Card hot>
            <T v="h2" color={t.duckInk}>{tr('Done!')} 🎉</T>
            {res?.notes?.map((n, i) => <T key={i} color={t.duckInk} style={{ marginTop: 4 }}>{tr(n)}</T>)}
          </Card>

          {res?.files?.map((f) => (
            <View key={f.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2, borderColor: t.line, borderRadius: 12, padding: 12, backgroundColor: t.card, flexWrap: 'wrap' }}>
              <Text style={{ fontSize: 20 }}>{f.mime.startsWith('image') ? '🖼️' : f.mime.includes('zip') ? '🗜️' : '📄'}</Text>
              <View style={{ flex: 1, minWidth: 160 }}>
                <Text numberOfLines={1} style={{ color: t.ink, fontWeight: '800' }}>{f.name}</Text>
                <T v="small" muted>{fmtBytes(f.bytes.length)}</T>
              </View>
              <Btn label={tr('Download')} icon="⬇️" small onPress={() => saveFile(f.name, f.bytes, f.mime)} />
            </View>
          ))}
          {res?.files && res.files.length > 1 ? <Btn label={tr('Download all {n} files (ZIP)', { n: res.files.length })} variant="dark" onPress={downloadAll} /> : null}

          {res?.text ? (
            <View style={{ gap: 10 }}>
              <View style={{ borderWidth: 2, borderColor: t.line, borderRadius: 12, padding: 14, backgroundColor: t.card, maxHeight: 420, overflow: 'hidden' }}>
                <T v="mono" selectable style={{ whiteSpace: 'pre-wrap' } as any}>{res.text.length > 8000 ? res.text.slice(0, 8000) + '\n\n' + tr('… (preview truncated: download the file for everything)') : res.text}</T>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                <Btn label={copied ? tr('Copied!') : tr('Copy all')} icon="📋" small variant="ghost" onPress={async () => { setCopied(await copyText(res.text!)); setTimeout(() => setCopied(false), 1500); }} />
                <Btn label={tr('Download .txt')} icon="⬇️" small onPress={() => saveFile(res.textName || 'result.txt', new TextEncoder().encode(res.text!), 'text/plain')} />
              </View>
            </View>
          ) : null}

          {nextTools.length && res?.files ? (
            <View style={{ gap: 8, marginTop: 4 }}>
              <T v="h3">{tr('Keep going with this file')}</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {nextTools.map((x) => <Chip key={x.id} label={tr(x.name)} icon={x.icon} onPress={() => sendOn(res.files![0], x.id)} />)}
              </View>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <Btn label={tr('Start over')} variant="ghost" small onPress={reset} />
            <Btn label={tr('Suggest an improvement')} variant="ghost" small to={`/feedback?tool=${tool.id}`} />
          </View>
        </View>
      )}

      <View style={{ gap: 10, marginTop: 10 }}>
        <T v="h2">{tr('How to use {name}', { name: toolName })}</T>
        <CardGrid min={200} gap={12}>
          {(seo?.steps || [tr('Add your file'), tr('Tweak the options'), tr('Download the result')]).map((s, i) => (
            <Card key={i} style={{ gap: 4 }}>
              <T v="label" muted>{tr('Step {n}', { n: i + 1 })}</T>
              <T>{s}</T>
            </Card>
          ))}
        </CardGrid>
      </View>
      {tool.tips?.length ? (
        <View style={{ gap: 6 }}>
          <T v="h2">{tr('Good to know')}</T>
          {tool.tips.map((x, i) => <T key={i} muted>• {tr(x)}</T>)}
        </View>
      ) : null}

      {seo ? (
        <View style={{ gap: 8 }}>
          <T v="h2">{tr('What people use it for')}</T>
          {seo.uses.map((u) => <T key={u}>• {u}</T>)}
        </View>
      ) : null}

      <View style={{ gap: 10 }}>
        <T v="h2">{tr('Frequently asked questions')}</T>
        {[...(seo?.faq || (tool.faq || []).map((f) => ({ q: tr(f.q), a: tr(f.a) }))), ...GENERIC_FAQ.map((f) => ({ q: tr(f.q), a: tr(f.a) }))].map((f) => <Faq key={f.q} q={f.q} a={f.a} />)}
        <T v="small" muted>{tr('Last reviewed {date}.', { date: SITE.updated })}</T>
      </View>

      {related.length ? (
        <View style={{ gap: 10 }}>
          <T v="h2">{tr('More in “{name}”', { name: cat ? tr(cat.name) : '' })}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {related.map((x) => <Chip key={x.id} label={tr(x.name)} icon={x.icon} to={toolPath(x.id)} />)}
          </View>
        </View>
      ) : null}
      <SiteFooter />
    </Screen>
  );
}
