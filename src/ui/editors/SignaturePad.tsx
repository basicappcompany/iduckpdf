import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '../../lib/theme';

/**
 * Create a signature three ways: draw it, type it, or upload a picture. The result is a PNG data URL with a transparent
 * background, cropped to the ink, handed to onChange (or '' when empty). Everything happens on a canvas in the browser.
 */
type Mode = 'draw' | 'type' | 'upload';
type Pt = { x: number; y: number };

const INKS: [string, string][] = [['Black', '#111111'], ['Blue', '#1a3fa8']];
const FONTS: [string, string][] = [
  ['Script', '"Segoe Script","Snell Roundhand","Brush Script MT","Lucida Handwriting",cursive'],
  ['Casual', '"Bradley Hand","Segoe Print","Chalkboard SE","Comic Sans MS",cursive'],
  ['Classic', 'Georgia,"Times New Roman",serif'],
];
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const PAD_W = 640;
const PAD_H = 220;

/** Crop a canvas to the non-transparent pixels plus a margin and return it as a PNG data URL ('' if nothing is drawn). */
function trimToPng(src: HTMLCanvasElement, margin = 12, maxWidth = 1000): string {
  const ctx = src.getContext('2d');
  if (!ctx) return '';
  const { width, height } = src;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return '';
  const sx = Math.max(0, minX - margin), sy = Math.max(0, minY - margin);
  const sw = Math.min(width - sx, maxX - minX + 1 + margin * 2), sh = Math.min(height - sy, maxY - minY + 1 + margin * 2);
  const scale = Math.min(1, maxWidth / sw);
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(sw * scale));
  out.height = Math.max(1, Math.round(sh * scale));
  out.getContext('2d')!.drawImage(src, sx, sy, sw, sh, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
}

export function SignaturePad({ label, hint, value, onChange }: { label: string; hint?: string; value: string; onChange: (v: string) => void }) {
  const { t } = useTheme();
  const [mode, setMode] = useState<Mode>('draw');
  const [ink, setInk] = useState(INKS[0][1]);
  const [text, setText] = useState('');
  const [font, setFont] = useState(FONTS[0][1]);
  const [removeBg, setRemoveBg] = useState(true);
  const [upload, setUpload] = useState<HTMLImageElement | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Pt[][]>([]);
  const drawing = useRef(false);

  const paintStrokes = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const s of strokes.current) {
      if (!s.length) continue;
      ctx.beginPath();
      ctx.moveTo(s[0].x, s[0].y);
      if (s.length === 1) ctx.lineTo(s[0].x + 0.1, s[0].y + 0.1);
      for (let i = 1; i < s.length - 1; i++) ctx.quadraticCurveTo(s[i].x, s[i].y, (s[i].x + s[i + 1].x) / 2, (s[i].y + s[i + 1].y) / 2);
      if (s.length > 1) ctx.lineTo(s[s.length - 1].x, s[s.length - 1].y);
      ctx.stroke();
    }
  }, [ink]);

  // the drawing surface is 2x for sharp lines on high-density screens
  useEffect(() => {
    if (mode !== 'draw' || !canvas.current) return;
    canvas.current.width = PAD_W * 2;
    canvas.current.height = PAD_H * 2;
    paintStrokes();
  }, [mode, paintStrokes]);

  const commitDraw = () => {
    if (canvas.current) onChange(trimToPng(canvas.current));
  };
  const pt = (e: React.PointerEvent): Pt => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * canvas.current!.width, y: ((e.clientY - r.top) / r.height) * canvas.current!.height };
  };
  const down = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    strokes.current.push([pt(e)]);
    paintStrokes();
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    strokes.current[strokes.current.length - 1].push(pt(e));
    paintStrokes();
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    commitDraw();
  };
  const clear = () => {
    strokes.current = [];
    setText('');
    setUpload(null);
    paintStrokes();
    onChange('');
  };
  const undo = () => {
    strokes.current.pop();
    paintStrokes();
    commitDraw();
  };

  // recolour an existing drawing when the ink changes
  useEffect(() => {
    if (mode === 'draw' && strokes.current.length) {
      paintStrokes();
      commitDraw();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ink]);

  // typed signature
  useEffect(() => {
    if (mode !== 'type') return;
    if (!text.trim()) return onChange('');
    const c = document.createElement('canvas');
    c.width = 1600;
    c.height = 360;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = ink;
    ctx.textBaseline = 'middle';
    let size = 200;
    ctx.font = `italic ${size}px ${font}`;
    const w = ctx.measureText(text).width;
    if (w > c.width - 60) {
      size = Math.max(40, Math.floor((size * (c.width - 60)) / w));
      ctx.font = `italic ${size}px ${font}`;
    }
    ctx.fillText(text, 30, c.height / 2);
    onChange(trimToPng(c));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, text, font, ink]);

  // uploaded picture, optionally with the white background made transparent
  useEffect(() => {
    if (mode !== 'upload' || !upload) return;
    const scale = Math.min(1, 900 / upload.naturalWidth);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(upload.naturalWidth * scale));
    c.height = Math.max(1, Math.round(upload.naturalHeight * scale));
    const ctx = c.getContext('2d')!;
    ctx.drawImage(upload, 0, 0, c.width, c.height);
    if (removeBg) {
      const img = ctx.getImageData(0, 0, c.width, c.height);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const whiteness = Math.min(d[i], d[i + 1], d[i + 2]);
        const a = whiteness >= 240 ? 0 : whiteness <= 190 ? 255 : Math.round(((240 - whiteness) / 50) * 255);
        d[i + 3] = Math.min(d[i + 3], a);
      }
      ctx.putImageData(img, 0, 0);
    }
    onChange(removeBg ? trimToPng(c, 6) : c.toDataURL('image/png'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, upload, removeBg]);

  const onFile = (f?: File | null) => {
    if (!f) return;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      setUpload(img);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    };
    img.src = url;
  };

  const btn = (on: boolean): React.CSSProperties => ({
    fontFamily: 'inherit', border: `2px solid ${t.line}`, borderRadius: 999, padding: '4px 14px', cursor: 'pointer', fontWeight: 800, fontSize: 14,
    background: on ? t.duck : t.card, color: on ? t.duckInk : t.ink,
  });
  const plain: React.CSSProperties = { fontFamily: 'inherit', border: `2px solid ${t.line}`, borderRadius: 10, padding: '4px 12px', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: t.card, color: t.ink };

  return (
    <div style={{ display: 'grid', gap: 10, fontFamily: FONT }}>
      <div style={{ color: t.ink, fontWeight: 800, fontSize: 14 }}>{label}</div>
      {hint ? <div style={{ color: t.muted, fontSize: 13 }}>{hint}</div> : null}
      <div role="group" aria-label="How to create your signature" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {([['draw', 'Draw'], ['type', 'Type'], ['upload', 'Upload']] as [Mode, string][]).map(([m, l]) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} style={btn(mode === m)}>{l}</button>
        ))}
        <span style={{ flex: 1 }} />
        {mode !== 'upload' ? (
          <span role="group" aria-label="Ink colour" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {INKS.map(([n, c]) => (
              <button key={c} type="button" aria-label={`${n} ink`} aria-pressed={ink === c} onClick={() => setInk(c)}
                style={{ width: 26, height: 26, borderRadius: 13, background: c, cursor: 'pointer', border: `3px solid ${ink === c ? t.duck : t.line}`, boxShadow: ink === c ? `0 0 0 2px ${t.line}` : 'none' }} />
            ))}
          </span>
        ) : null}
      </div>

      {mode === 'draw' ? (
        <div>
          <canvas ref={canvas} aria-label="Signature drawing area. Draw with your finger or mouse." onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
            style={{ width: '100%', maxWidth: PAD_W, aspectRatio: `${PAD_W} / ${PAD_H}`, touchAction: 'none', cursor: 'crosshair', background: '#ffffff', border: `3px dashed ${t.line}`, borderRadius: 14, display: 'block' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" onClick={undo} style={plain}>Undo</button>
            <button type="button" onClick={clear} style={plain}>Clear</button>
          </div>
        </div>
      ) : null}

      {mode === 'type' ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your name" aria-label="Your signature as text" maxLength={60}
            style={{ fontFamily: 'inherit', border: `2px solid ${t.line}`, borderRadius: 12, padding: '10px 12px', fontSize: 18, background: t.card, color: t.ink, outline: 'none', width: '100%', boxSizing: 'border-box' }} />
          <div role="group" aria-label="Signature style" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {FONTS.map(([n, f]) => <button key={n} type="button" aria-pressed={font === f} onClick={() => setFont(f)} style={{ ...btn(font === f), fontFamily: f, fontStyle: 'italic' }}>{n}</button>)}
          </div>
        </div>
      ) : null}

      {mode === 'upload' ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <input type="file" accept="image/*" aria-label="Choose a picture of your signature" onChange={(e) => onFile(e.target.files?.[0])} style={{ color: t.ink }} />
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: t.ink, fontSize: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={removeBg} onChange={(e) => setRemoveBg(e.target.checked)} /> Remove the white background
          </label>
          <div style={{ color: t.muted, fontSize: 13 }}>Sign on plain white paper, photograph it in even light, and upload the picture.</div>
        </div>
      ) : null}

      <div aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 56 }}>
        {value ? (
          <>
            <span style={{ color: t.muted, fontSize: 13, fontWeight: 700 }}>Your signature</span>
            <img src={value} alt="Preview of your signature" style={{ maxHeight: 60, maxWidth: 220, background: 'repeating-conic-gradient(#d8d8d8 0% 25%, #ffffff 0% 50%) 50% / 12px 12px', border: `2px solid ${t.line}`, borderRadius: 8 }} />
          </>
        ) : <span style={{ color: t.muted, fontSize: 13 }}>No signature yet.</span>}
      </div>
    </div>
  );
}
