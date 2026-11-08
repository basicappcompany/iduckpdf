import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../lib/theme';
import { KEYS, getJSON, setJSON } from '../lib/storage';
import { setHandoff, takeHandoff } from '../lib/handoff';
import { CATEGORIES, TOOLS, byId, inCategory, loadRunner, preloadEngine, type ToolDef } from '../tools';
import { isShown, type InputSlot, type Option, type OutFile, type PickedFile, type ToolResult } from '../engine/types';
import { ToolError, fmtBytes } from '../engine/base';
import { copyText, saveFile } from '../engine/io';
import { Banner, Btn, Card, Choice, Chip, Field, Pill, Screen, T, TextField, Toggle } from './kit';
import { SiteFooter } from './SiteFooter';
import { TOOL_SEO } from '../content/toolSeo';
import { SITE } from '../config';
import { DropZone } from './DropZone';

const GENERIC_FAQ = [
  { q: 'Where do my files go?', a: 'Most tools work entirely inside your browser tab, so the PDF is processed on your device and not uploaded to us. The AI tools are the exception: with your own key, the text of your PDF is sent to the AI provider you choose, and they say so before you start.' },
  { q: 'Do I need an account, and is there a limit?', a: 'No account, no watermark and no daily limit set by the site. Very large files are limited only by your device’s memory.' },
];

function defaultsFor(tool: ToolDef): Record<string, any> {
  const o: Record<string, any> = {};
  (tool.options || []).forEach((x) => {
    o[x.key] = x.type === 'toggle' ? x.default : x.type === 'select' ? x.default : x.default ?? '';
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
      {multiple ? small('↑', () => onMove(-1), i === 0, `Move ${f.name} up`) : null}
      {multiple ? small('↓', () => onMove(1), i === n - 1, `Move ${f.name} down`) : null}
      {small('✕', onRemove, false, `Remove ${f.name}`)}
    </View>
  );
}
function OptionControl({ o, value, onChange }: { o: Option; value: any; onChange: (v: any) => void }) {
  if (o.type === 'toggle') return <View style={{ gap: 4 }}><Toggle label={o.label} value={!!value} onChange={onChange} />{o.hint ? <T v="small" muted>{o.hint}</T> : null}</View>;
  if (o.type === 'select') return <Field label={o.label} hint={o.hint}><Choice options={o.options} value={String(value)} onChange={onChange} /></Field>;
  return (
    <Field label={o.label} hint={o.hint}>
      <TextField value={String(value ?? '')} onChange={onChange} placeholder={o.placeholder} multiline={o.type === 'textarea'} secure={o.type === 'password'} numeric={o.type === 'number'} />
    </Field>
  );
}

export function ToolView({ tool }: { tool: ToolDef }) {
  const { t } = useTheme();
  const router = useRouter();
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
    setProg({ f: 0, label: 'Starting…' });
    await new Promise((r) => setTimeout(r, 30));
    try {
      const runner = await loadRunner(tool.id);
      if (!runner) throw new ToolError('This tool is not available yet.');
      const r = await runner({ files, opts, progress: (f, label) => setProg({ f: Math.max(0, Math.min(1, f)), label: label || '' }) });
      setRes(r);
      setPhase('done');
      const recent = getJSON<string[]>(KEYS.recent, []).filter((x) => x !== tool.id);
      setJSON(KEYS.recent, [tool.id, ...recent].slice(0, 8));
    } catch (e: any) {
      setErr({ message: e instanceof ToolError ? e.message : 'Something went wrong while processing. Your file may be unusual or very large.', code: e?.code });
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
    router.push(`/tool/${to}` as any);
  };

  const seo = TOOL_SEO[tool.id];
  const related = inCategory(tool.category).filter((x) => x.id !== tool.id && x.status === 'ready').slice(0, 4);
  const cat = CATEGORIES.find((c) => c.id === tool.category);

  /* ---------- roadmap tool ---------- */
  if (tool.status === 'soon') {
    return (
      <Screen narrow>
        <View style={{ gap: 6 }}>
          <T v="small" muted>{cat?.name}</T>
          <T v="h1">{tool.icon} {tool.name}</T>
          <T muted>{tool.desc}</T>
        </View>
        <Card hot>
          <T v="h3" color={t.duckInk}>Not built yet · Phase {tool.phase}</T>
          <T color={t.duckInk} style={{ marginTop: 6 }}>{tool.reason}</T>
        </Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <Btn label="Request this tool" icon="💡" to={`/request?tool=${tool.id}`} />
          <Btn label="See the roadmap" variant="ghost" to="/roadmap" />
        </View>
        <T v="h2" style={{ marginTop: 8 }}>You can already do this much</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {TOOLS.filter((x) => x.status === 'ready').slice(0, 8).map((x) => <Chip key={x.id} label={x.name} icon={x.icon} to={`/tool/${x.id}`} />)}
        </View>
      </Screen>
    );
  }

  /* ---------- working tool ---------- */
  return (
    <Screen narrow>
      <View style={{ gap: 8 }}>
        <T v="small" muted>{cat?.icon} {cat?.name}</T>
        <T v="h1">{tool.icon} {tool.name}</T>
        <T muted>{tool.desc}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
          <Pill tone="ok">{tool.warn ? 'Uses your AI key' : 'Runs in your browser'}</Pill>
          <Pill>No sign-up</Pill>
          <Pill>No watermark</Pill>
        </View>
      </View>

      {seo ? (
        <Card style={{ gap: 4 }}>
          <T v="label" muted>Quick answer</T>
          <T>{seo.answer}</T>
        </Card>
      ) : null}

      {tool.warn ? <Banner tone="warn">{tool.warn}</Banner> : null}

      {phase !== 'done' ? (
        <>
          {tool.inputs.map((slot) => {
            const list = files[slot.key] || [];
            return (
              <View key={slot.key} style={{ gap: 10 }}>
                {tool.inputs.length > 1 ? <T v="h3">{slot.label}</T> : null}
                {slot.multiple || list.length === 0 ? (
                  <DropZone label={list.length ? 'Add more files' : slot.label} hint={slot.hint} accept={slot.accept} multiple={slot.multiple} camera={slot.camera} compact={list.length > 0} onFiles={(l) => addFiles(slot, l)} />
                ) : null}
                {list.map((f, i) => (
                  <FileRow key={f.name + i} f={f} i={i} n={list.length} multiple={!!slot.multiple} onMove={(d) => moveFile(slot, i, d)} onRemove={() => removeFile(slot, i)} />
                ))}
                {slot.min && slot.min > 1 && list.length < slot.min ? <T v="small" muted>Add at least {slot.min} files.</T> : null}
              </View>
            );
          })}

          {visibleOpts.length ? (
            <Card style={{ gap: 14 }}>
              {visibleOpts.map((o) => (
                <OptionControl key={o.key} o={o} value={opts[o.key]} onChange={(v) => setOpts((p) => ({ ...p, [o.key]: v }))} />
              ))}
            </Card>
          ) : null}

          {err ? (
            <Banner tone="error">
              <T v="small" color="#fff">{err.message}</T>
              {err.code === 'NO_KEY' ? <View style={{ marginTop: 8, alignSelf: 'flex-start' }}><Btn label="Open Settings" small to="/settings" variant="ghost" /></View> : null}
            </Banner>
          ) : null}

          <View style={{ gap: 10 }}>
            <Btn label={phase === 'running' ? 'Working…' : tool.runLabel || 'Go'} onPress={run} disabled={!ready || phase === 'running'} />
            {phase === 'running' ? (
              <View style={{ gap: 6 }}>
                <View style={{ height: 14, borderWidth: 2, borderColor: t.line, borderRadius: 8, backgroundColor: t.soft, overflow: 'hidden' }}>
                  <View style={{ width: `${Math.max(6, Math.round(prog.f * 100))}%`, height: '100%', backgroundColor: t.duck }} />
                </View>
                <T v="small" muted>{prog.label || 'Working…'}</T>
              </View>
            ) : null}
          </View>
        </>
      ) : (
        <View style={{ gap: 12 }}>
          <Card hot>
            <T v="h2" color={t.duckInk}>Done! 🎉</T>
            {res?.notes?.map((n, i) => <T key={i} color={t.duckInk} style={{ marginTop: 4 }}>{n}</T>)}
          </Card>

          {res?.files?.map((f) => (
            <View key={f.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2, borderColor: t.line, borderRadius: 12, padding: 12, backgroundColor: t.card, flexWrap: 'wrap' }}>
              <Text style={{ fontSize: 20 }}>{f.mime.startsWith('image') ? '🖼️' : f.mime.includes('zip') ? '🗜️' : '📄'}</Text>
              <View style={{ flex: 1, minWidth: 160 }}>
                <Text numberOfLines={1} style={{ color: t.ink, fontWeight: '800' }}>{f.name}</Text>
                <T v="small" muted>{fmtBytes(f.bytes.length)}</T>
              </View>
              <Btn label="Download" icon="⬇️" small onPress={() => saveFile(f.name, f.bytes, f.mime)} />
            </View>
          ))}
          {res?.files && res.files.length > 1 ? <Btn label={`Download all ${res.files.length} files (ZIP)`} variant="dark" onPress={downloadAll} /> : null}

          {res?.text ? (
            <View style={{ gap: 10 }}>
              <View style={{ borderWidth: 2, borderColor: t.line, borderRadius: 12, padding: 14, backgroundColor: t.card, maxHeight: 420, overflow: 'hidden' }}>
                <T v="mono" selectable style={{ whiteSpace: 'pre-wrap' } as any}>{res.text.length > 8000 ? res.text.slice(0, 8000) + '\n\n… (preview truncated: download the file for everything)' : res.text}</T>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                <Btn label={copied ? 'Copied!' : 'Copy all'} icon="📋" small variant="ghost" onPress={async () => { setCopied(await copyText(res.text!)); setTimeout(() => setCopied(false), 1500); }} />
                <Btn label="Download .txt" icon="⬇️" small onPress={() => saveFile(res.textName || 'result.txt', new TextEncoder().encode(res.text!), 'text/plain')} />
              </View>
            </View>
          ) : null}

          {nextTools.length && res?.files ? (
            <View style={{ gap: 8, marginTop: 4 }}>
              <T v="h3">Keep going with this file</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {nextTools.map((x) => <Chip key={x.id} label={x.name} icon={x.icon} onPress={() => sendOn(res.files![0], x.id)} />)}
              </View>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <Btn label="Start over" variant="ghost" small onPress={reset} />
            <Btn label="Suggest an improvement" variant="ghost" small to={`/feedback?tool=${tool.id}`} />
          </View>
        </View>
      )}

      <View style={{ gap: 10, marginTop: 10 }}>
        <T v="h2">How to use {tool.name}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {(seo?.steps || ['Add your file', 'Tweak the options', 'Download the result']).map((s, i) => (
            <Card key={i} style={{ flexGrow: 1, flexBasis: 200, gap: 4 }}>
              <T v="label" muted>Step {i + 1}</T>
              <T>{s}</T>
            </Card>
          ))}
        </View>
        {tool.tips?.map((x, i) => <T key={i} muted>• {x}</T>)}
      </View>

      {seo ? (
        <View style={{ gap: 8 }}>
          <T v="h2">What people use it for</T>
          {seo.uses.map((u) => <T key={u}>• {u}</T>)}
        </View>
      ) : null}

      <View style={{ gap: 10 }}>
        <T v="h2">Frequently asked questions</T>
        {[...(seo?.faq || tool.faq || []), ...GENERIC_FAQ].map((f) => <Faq key={f.q} q={f.q} a={f.a} />)}
        <T v="small" muted>Last updated {SITE.updated}.</T>
      </View>

      {related.length ? (
        <View style={{ gap: 10 }}>
          <T v="h2">More in “{cat?.name}”</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {related.map((x) => <Chip key={x.id} label={x.name} icon={x.icon} to={`/tool/${x.id}`} />)}
          </View>
        </View>
      ) : null}
      <SiteFooter />
    </Screen>
  );
}
