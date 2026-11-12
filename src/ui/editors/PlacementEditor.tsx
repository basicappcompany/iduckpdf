import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../lib/theme';
import { useT } from '../../i18n/react';
import type { PickedFile, Placement } from '../../engine/types';
import { openPdfjs, renderPage } from '../../engine/render';

/**
 * A page preview with the signature on top of it, which can be dragged, resized (corner handle, slider or + / - keys) and
 * nudged with the arrow keys. Positions are fractions of the displayed page, so they do not depend on the preview size.
 */
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function PlacementEditor({ label, hint, file, signature, value, onChange }: { label: string; hint?: string; file?: PickedFile; signature: string; value: Placement; onChange: (v: Placement) => void }) {
  const { t } = useTheme();
  const tr = useT();
  const [pages, setPages] = useState(0);
  const [img, setImg] = useState('');
  const [aspect, setAspect] = useState(0.707);
  const [sigAspect, setSigAspect] = useState(2);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const doc = useRef<any>(null);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<null | { mode: 'move' | 'size'; sx: number; sy: number; x: number; y: number; w: number }>(null);
  const page = clamp(Math.round(value.page || 1), 1, Math.max(1, pages || 1));

  // open the PDF
  useEffect(() => {
    let dead = false;
    doc.current = null;
    setPages(0);
    setImg('');
    setError('');
    if (!file) return;
    setBusy(true);
    (async () => {
      try {
        const d = await openPdfjs(await file.bytes());
        if (dead) return;
        doc.current = d;
        setPages(d.numPages);
      } catch (e: any) {
        if (!dead) setError(e?.message || tr('This PDF could not be shown.'));
      }
    })();
    return () => { dead = true; };
  }, [file?.name, file?.size]);

  // draw the current page
  useEffect(() => {
    let dead = false;
    if (!doc.current || !pages) return;
    setBusy(true);
    (async () => {
      try {
        const first = await doc.current.getPage(page);
        const base = first.getViewport({ scale: 1 });
        const scale = clamp(960 / base.width, 0.5, 3);
        const r = await renderPage(doc.current, page, scale);
        if (dead) return;
        setAspect(r.canvas.width / r.canvas.height);
        setImg(r.canvas.toDataURL('image/jpeg', 0.85));
      } catch (e: any) {
        if (!dead) setError(e?.message || tr('This page could not be shown.'));
      } finally {
        if (!dead) setBusy(false);
      }
    })();
    return () => { dead = true; };
  }, [pages, page]);

  // aspect ratio of the signature
  useEffect(() => {
    if (!signature) return;
    const i = new Image();
    i.onload = () => setSigAspect(i.naturalWidth / Math.max(1, i.naturalHeight));
    i.src = signature;
  }, [signature]);

  const set = (patch: Partial<Placement>) => onChange({ ...value, page, ...patch });
  // height of the signature as a fraction of the displayed page height
  const hFrac = (w: number) => (w / sigAspect) * aspect;
  const fit = (x: number, y: number, w: number) => {
    const ww = clamp(w, 0.05, 0.95);
    const hh = hFrac(ww);
    return { x: clamp(x, 0, 1 - ww), y: clamp(y, 0, Math.max(0, 1 - hh)), w: ww };
  };

  const onDown = (mode: 'move' | 'size') => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { mode, sx: e.clientX, sy: e.clientY, x: value.x, y: value.y, w: value.w };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const r = box.current?.getBoundingClientRect();
    if (!d || !r) return;
    const dx = (e.clientX - d.sx) / r.width;
    const dy = (e.clientY - d.sy) / r.height;
    if (d.mode === 'move') set(fit(d.x + dx, d.y + dy, d.w));
    else {
      const maxW = Math.min(0.95 - d.x + 0.05, ((1 - d.y) * sigAspect) / aspect);
      set({ w: clamp(d.w + dx, 0.05, Math.max(0.05, maxW)) });
    }
  };
  const onUp = () => { drag.current = null; };
  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.05 : 0.01;
    const k = e.key;
    if (k === 'ArrowLeft') set(fit(value.x - step, value.y, value.w));
    else if (k === 'ArrowRight') set(fit(value.x + step, value.y, value.w));
    else if (k === 'ArrowUp') set(fit(value.x, value.y - step, value.w));
    else if (k === 'ArrowDown') set(fit(value.x, value.y + step, value.w));
    else if (k === '+' || k === '=') set(fit(value.x, value.y, value.w + 0.02));
    else if (k === '-') set(fit(value.x, value.y, value.w - 0.02));
    else return;
    e.preventDefault();
  };

  const preset = (px: number, py: number) => () => {
    const m = 0.04;
    const hh = hFrac(value.w);
    set({ x: px < 0.3 ? m : px > 0.7 ? 1 - value.w - m : 0.5 - value.w / 2, y: py < 0.3 ? m : py > 0.7 ? 1 - hh - m : 0.5 - hh / 2 });
  };

  const btn: React.CSSProperties = { fontFamily: 'inherit', border: `2px solid ${t.line}`, borderRadius: 10, padding: '4px 12px', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: t.card, color: t.ink };
  const off = { opacity: 0.4, cursor: 'default' };

  return (
    <div style={{ display: 'grid', gap: 10, fontFamily: FONT }}>
      <div style={{ color: t.ink, fontWeight: 800, fontSize: 14 }}>{label}</div>
      {hint ? <div style={{ color: t.muted, fontSize: 13 }}>{hint}</div> : null}
      {!file ? <div style={{ color: t.muted, fontSize: 14 }}>{tr('Add your PDF above to see its pages here.')}</div> : null}
      {error ? <div role="alert" style={{ color: t.danger, fontWeight: 700, fontSize: 14 }}>{error}</div> : null}
      {file && !error ? (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" style={{ ...btn, ...(page <= 1 ? off : null) }} disabled={page <= 1} onClick={() => set({ page: page - 1 })} aria-label={tr('Previous page')}>‹ {tr('Prev')}</button>
            <span style={{ color: t.ink, fontWeight: 800, fontSize: 14 }} aria-live="polite">{tr('Page {n} of {total}', { n: page, total: pages || '…' })}</span>
            <button type="button" style={{ ...btn, ...(page >= pages ? off : null) }} disabled={page >= pages} onClick={() => set({ page: page + 1 })} aria-label={tr('Next page')}>{tr('Next')} ›</button>
            <span style={{ flex: 1 }} />
            <span role="group" aria-label={tr('Quick positions')} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button type="button" style={btn} onClick={preset(1, 1)} disabled={!signature}>{tr('Bottom right')}</button>
              <button type="button" style={btn} onClick={preset(0, 1)} disabled={!signature}>{tr('Bottom left')}</button>
              <button type="button" style={btn} onClick={preset(0.5, 0.5)} disabled={!signature}>{tr('Centre')}</button>
            </span>
          </div>

          <div ref={box} style={{ position: 'relative', width: '100%', maxWidth: 640, aspectRatio: String(aspect), background: '#fff', border: `3px solid ${t.line}`, borderRadius: 6, overflow: 'hidden', touchAction: 'none', userSelect: 'none' }}>
            {img ? <img src={img} alt={tr('Page {n} of your PDF', { n: page })} draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} /> : <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#666', fontSize: 14 }}>{busy ? 'Loading the page…' : ''}</div>}
            {signature && img ? (
              <div role="img" aria-label={tr('Your signature. Drag to move; arrow keys nudge it; plus and minus resize it.')} tabIndex={0} onPointerDown={onDown('move')} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onKey}
                style={{ position: 'absolute', left: `${value.x * 100}%`, top: `${value.y * 100}%`, width: `${value.w * 100}%`, cursor: 'grab', outline: `2px dashed ${t.orange}`, outlineOffset: 2, touchAction: 'none' }}>
                <img src={signature} alt="" draggable={false} style={{ width: '100%', display: 'block', pointerEvents: 'none' }} />
                <div onPointerDown={onDown('size')} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} aria-hidden="true"
                  style={{ position: 'absolute', right: -9, bottom: -9, width: 18, height: 18, borderRadius: 4, background: t.orange, border: '2px solid #fff', cursor: 'nwse-resize', touchAction: 'none' }} />
              </div>
            ) : null}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: t.ink, fontSize: 14, fontWeight: 700 }}>
            Size
            <input type="range" min={5} max={80} value={Math.round(value.w * 100)} disabled={!signature} aria-label={tr('Signature size')} onChange={(e) => set(fit(value.x, value.y, Number(e.target.value) / 100))} style={{ flex: 1, maxWidth: 320 }} />
            <span style={{ color: t.muted, width: 40 }}>{Math.round(value.w * 100)}%</span>
          </label>
          {!signature ? <div style={{ color: t.muted, fontSize: 13 }}>{tr('Create your signature above, then drag it into place on the page.')}</div> : null}
        </>
      ) : null}
    </div>
  );
}
