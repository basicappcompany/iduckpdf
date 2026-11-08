import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { KEYS, getItem, setItem } from './storage';
import { CSS_VAR_SHADOW, CSS_VAR_TOKENS, dark, light } from './themeColors';

export type Mode = 'system' | 'light' | 'dark';

export type Tokens = {
  dark: boolean;
  bg: string;
  card: string;
  ink: string;
  muted: string;
  line: string;
  soft: string;
  duck: string;
  duckInk: string;
  orange: string;
  ok: string;
  danger: string;
  shadow: (n?: number) => any;
};

function make(isDark: boolean): Tokens {
  if (Platform.OS === 'web') {
    // CSS variables, switched in the page <head> before first paint (see themeColors.ts). The same strings are used for the
    // pre-rendered HTML and for every theme, so there is no flash and no hydration mismatch.
    return { dark: isDark, ...CSS_VAR_TOKENS, shadow: (n = 4) => ({ boxShadow: `${n}px ${n}px 0px ${CSS_VAR_SHADOW}` }) };
  }
  const base = isDark ? dark : light;
  const shadowColor = isDark ? '#000000' : base.ink;
  return {
    dark: isDark,
    ...base,
    // Flat "sticker" shadow. boxShadow is supported by react-native-web and RN's new architecture.
    shadow: (n = 4) => ({ boxShadow: `${n}px ${n}px 0px ${shadowColor}` }),
  };
}

type Ctx = { t: Tokens; mode: Mode; setMode: (m: Mode) => void; toggle: () => void };
const ThemeCtx = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<Mode>('system');
  useEffect(() => {
    const saved = getItem(KEYS.theme) as Mode | null;
    if (saved) setModeState(saved);
  }, []);

  // Native only needs this: web colours come from CSS variables, so the pre-rendered HTML is already in the right theme.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && (mode === 'system' ? system === 'dark' : mode === 'dark');
  const t = useMemo(() => make(isDark), [isDark]);

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    setItem(KEYS.theme, m);
  }, []);
  const toggle = useCallback(() => setMode(isDark ? 'light' : 'dark'), [isDark, setMode]);

  useEffect(() => {
    // Wait until the saved choice has been read, or the first pass would flip a dark page to light.
    if (!mounted || Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  }, [mounted, isDark]);

  const value = useMemo(() => ({ t, mode, setMode, toggle }), [t, mode, setMode, toggle]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): Ctx {
  const c = useContext(ThemeCtx);
  if (!c) throw new Error('useTheme outside ThemeProvider');
  return c;
}
