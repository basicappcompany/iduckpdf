// Tiny key/value store. Uses localStorage on the web; in-memory elsewhere
// (the mobile apps are future scope and will swap in AsyncStorage).
const mem: Record<string, string> = {};

function ls(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function getItem(key: string): string | null {
  const s = ls();
  try {
    return s ? s.getItem(key) : key in mem ? mem[key] : null;
  } catch {
    return null;
  }
}

export function setItem(key: string, value: string): void {
  const s = ls();
  try {
    if (s) s.setItem(key, value);
    else mem[key] = value;
  } catch {
    mem[key] = value;
  }
}

export function removeItem(key: string): void {
  const s = ls();
  try {
    if (s) s.removeItem(key);
    else delete mem[key];
  } catch {
    delete mem[key];
  }
}

export function getJSON<T>(key: string, fallback: T): T {
  const raw = getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setJSON(key: string, value: unknown): void {
  setItem(key, JSON.stringify(value));
}

export const KEYS = {
  theme: 'duck.theme', // 'system' | 'light' | 'dark'
  ai: 'duck.ai', // { provider, key, model }
  recent: 'duck.recent', // string[] of tool ids
  votes: 'duck.votes', // string[] of tool ids
  lang: 'duck.lang', // language code the visitor last chose in the language menu
};
