import { getCatalog } from './catalog';
import type { Lang } from './locales';
import { fold } from '../tools';

export type Intent = 'greet' | 'privacy' | 'bug' | 'feature' | 'support' | 'settings';

/** The kind of message the helper chat got. English words are always understood; a language's catalog (`chat`) adds its own words for the same six intents. */
export function intentOf(text: string, lang: Lang): Intent | null {
  const s = text.toLowerCase();
  if (/^(hi|hello|hey|yo|hiya)\b/.test(s)) return 'greet';
  if (/(safe|private|privacy|secure|upload|server|data)/.test(s)) return 'privacy';
  if (/(bug|broken|not working|error|problem|issue|crash|feedback)/.test(s)) return 'bug';
  if (/(feature|suggest|wish|idea|missing|add a tool|request)/.test(s)) return 'feature';
  if (/(donate|support|tip|coffee|sponsor|pay)/.test(s)) return 'support';
  if (/(api key|settings|dark mode|theme|my key)/.test(s)) return 'settings';
  const words = getCatalog(lang)?.chat;
  if (!words) return null;
  const f = fold(text);
  // a greeting only counts at the start, as a whole word ("hi" must not catch "hilfe")
  if ((words.greet ?? []).some((w) => f.startsWith(fold(w)) && !/[\p{L}\p{M}]/u.test(f.charAt(fold(w).length)))) return 'greet';
  for (const k of ['privacy', 'bug', 'feature', 'support', 'settings'] as const) if ((words[k] ?? []).some((w) => f.includes(fold(w)))) return k;
  return null;
}
