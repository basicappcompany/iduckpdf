import { ToolError } from '../engine/base';
import { AI_DEFAULTS } from '../config';
import { KEYS, getJSON, removeItem, setJSON } from './storage';

export type AiConfig = { provider: 'openai' | 'anthropic' | 'gemini'; key: string; model: string };

export function getAi(): AiConfig | null {
  const c = getJSON<AiConfig | null>(KEYS.ai, null);
  return c && c.key ? c : null;
}
export function saveAi(c: AiConfig): void {
  setJSON(KEYS.ai, c);
}
export function clearAi(): void {
  removeItem(KEYS.ai);
}

async function readError(res: Response): Promise<string> {
  try {
    const j: any = await res.json();
    return j?.error?.message || j?.message || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

/** Calls the provider the user configured, with the key they supplied. Nothing goes through our servers. */
export async function askAI(system: string, prompt: string, o: { maxTokens?: number } = {}): Promise<string> {
  const cfg = getAi();
  if (!cfg) throw new ToolError('Add your own API key in Settings to use this tool.', 'NO_KEY');
  const model = cfg.model || AI_DEFAULTS[cfg.provider].model;
  let res: Response;
  try {
    if (cfg.provider === 'openai') {
      res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] }),
      });
    } else if (cfg.provider === 'anthropic') {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': cfg.key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({ model, max_tokens: o.maxTokens || 2048, system, messages: [{ role: 'user', content: prompt }] }),
      });
    } else {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.key },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }], ...(o.maxTokens ? { generationConfig: { maxOutputTokens: o.maxTokens } } : {}) }),
      });
    }
  } catch {
    throw new ToolError(`Could not reach ${AI_DEFAULTS[cfg.provider].label}. Check your connection.`);
  }
  if (!res.ok) throw new ToolError(`${AI_DEFAULTS[cfg.provider].label} replied: ${await readError(res)}`);
  const j: any = await res.json();
  const text =
    cfg.provider === 'openai'
      ? j?.choices?.[0]?.message?.content
      : cfg.provider === 'anthropic'
        ? (j?.content || []).map((c: any) => c.text || '').join('')
        : (j?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('');
  if (!text) throw new ToolError('The AI service returned an empty answer.');
  return String(text).trim();
}

/** Page-tagged document text, capped so the request stays reasonable. */
export function buildContext(pages: string[], maxChars = 90000, only?: number[]): { text: string; truncated: boolean } {
  let out = '';
  let truncated = false;
  for (const i of only || pages.map((_, k) => k)) {
    if (!(pages[i] || '').trim()) continue;
    const chunk = `\n[Page ${i + 1}]\n${pages[i]}\n`;
    if (out.length + chunk.length > maxChars) {
      truncated = true;
      break;
    }
    out += chunk;
  }
  return { text: out.trim(), truncated };
}
