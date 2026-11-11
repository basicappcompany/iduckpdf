// Pure helpers for the AI tools: split a document into requests, read the model's JSON reliably, and write CSV.
// No network and no storage here, so every function can be tested in Node.

export type Chunk = { text: string; pages: number[] };

/**
 * Splits page text into pieces of at most maxChars, keeping whole pages together where possible. Each piece starts with
 * "=== Page N ===" markers so a translation can be put back in order. A page longer than maxChars is split at line breaks.
 */
export function chunkPages(pages: string[], idx: number[], maxChars: number): Chunk[] {
  const out: Chunk[] = [];
  let cur: Chunk = { text: '', pages: [] };
  const flush = () => {
    if (cur.text) out.push(cur);
    cur = { text: '', pages: [] };
  };
  for (const i of idx) {
    const body = (pages[i] || '').trim();
    if (!body) continue;
    const marker = `=== Page ${i + 1} ===`;
    const whole = `${marker}\n${body}`;
    if (whole.length <= maxChars) {
      if (cur.text && cur.text.length + whole.length + 2 > maxChars) flush();
      cur.text += (cur.text ? '\n\n' : '') + whole;
      cur.pages.push(i + 1);
      continue;
    }
    flush();
    // a page longer than one request: cut at line breaks (and cut any single enormous line), marker on the first piece only
    const room = Math.max(50, maxChars - marker.length - 2);
    const lines: string[] = [];
    for (const line of body.split('\n')) for (let k = 0; k < Math.max(1, line.length); k += room) lines.push(line.slice(k, k + room));
    let piece = marker + '\n';
    let hasBody = false;
    for (const line of lines) {
      if (hasBody && piece.length + line.length + 1 > maxChars) {
        out.push({ text: piece.trimEnd(), pages: [i + 1] });
        piece = '';
        hasBody = false;
      }
      piece += line + '\n';
      hasBody = true;
    }
    if (hasBody) out.push({ text: piece.trimEnd(), pages: [i + 1] });
  }
  flush();
  return out;
}

/** Reads the first JSON value in a model reply, ignoring ```fences``` and any chatter before or after it. */
export function extractJson(raw: string): unknown {
  const s = String(raw || '').replace(/```(?:json)?/gi, '');
  const start = s.search(/[[{]/);
  if (start < 0) throw new Error('no JSON found');
  const open = s[start];
  const close = open === '[' ? ']' : '}';
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return JSON.parse(s.slice(start, i + 1));
  }
  throw new Error('the JSON was cut off');
}

const str = (v: unknown): string => (v == null ? '' : typeof v === 'string' ? v.trim() : typeof v === 'object' ? JSON.stringify(v) : String(v));

export type Card = { q: string; a: string };
export function parseCards(v: unknown): Card[] {
  const list = Array.isArray(v) ? v : Array.isArray((v as any)?.cards) ? (v as any).cards : Array.isArray((v as any)?.flashcards) ? (v as any).flashcards : [];
  return list.map((c: any) => ({ q: str(c?.q ?? c?.question ?? c?.front), a: str(c?.a ?? c?.answer ?? c?.back) })).filter((c: Card) => c.q && c.a);
}

export type QuizItem = { q: string; choices: string[]; answer: number; why: string };
export function parseQuiz(v: unknown): QuizItem[] {
  const list = Array.isArray(v) ? v : Array.isArray((v as any)?.questions) ? (v as any).questions : Array.isArray((v as any)?.quiz) ? (v as any).quiz : [];
  const out: QuizItem[] = [];
  for (const c of list as any[]) {
    const choices = (Array.isArray(c?.choices) ? c.choices : Array.isArray(c?.options) ? c.options : []).map(str).filter(Boolean);
    let answer = Number(c?.answer ?? c?.correct);
    if (!Number.isInteger(answer) && typeof c?.answer === 'string') answer = 'ABCDEFGH'.indexOf(c.answer.trim().toUpperCase().charAt(0));
    const q = str(c?.q ?? c?.question);
    if (!q || choices.length < 2 || !Number.isInteger(answer) || answer < 0 || answer >= choices.length) continue;
    out.push({ q, choices: choices.slice(0, 6), answer, why: str(c?.why ?? c?.explanation) });
  }
  return out;
}

export type Table = { columns: string[]; rows: (string | number)[][] };
/** Accepts {columns, rows}, an array of arrays, or an array of objects. Plain numbers become numbers; everything else stays text. */
export function parseTable(v: unknown): Table {
  const cell = (x: unknown): string | number => {
    if (typeof x === 'number' && Number.isFinite(x)) return x;
    const s = str(x);
    return /^-?(0|[1-9]\d{0,14})(\.\d+)?$/.test(s) ? Number(s) : s;
  };
  let columns: string[] = [];
  let rows: unknown[][] = [];
  if (v && !Array.isArray(v) && typeof v === 'object' && Array.isArray((v as any).columns) && Array.isArray((v as any).rows)) {
    columns = (v as any).columns.map(str);
    rows = (v as any).rows.map((r: any) => (Array.isArray(r) ? r : columns.map((c) => r?.[c])));
  } else if (Array.isArray(v) && v.length && v.every((r) => r && typeof r === 'object' && !Array.isArray(r))) {
    for (const r of v as Record<string, unknown>[]) for (const k of Object.keys(r)) if (!columns.includes(k)) columns.push(k);
    rows = (v as Record<string, unknown>[]).map((r) => columns.map((c) => r[c]));
  } else if (Array.isArray(v) && v.length && v.every(Array.isArray)) {
    columns = (v[0] as unknown[]).map(str);
    rows = (v as unknown[][]).slice(1);
  }
  const width = columns.length;
  const clean = rows.map((r) => Array.from({ length: width }, (_, i) => cell(r[i]))).filter((r) => r.some((c) => c !== ''));
  return { columns, rows: clean };
}

const csvCell = (x: string | number): string => {
  const s = String(x);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const csvLine = (cells: (string | number)[]): string => cells.map(csvCell).join(',');
export const toCsv = (rows: (string | number)[][]): string => rows.map(csvLine).join('\r\n') + '\r\n';
