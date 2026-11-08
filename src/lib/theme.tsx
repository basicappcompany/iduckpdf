import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { KEYS, getItem, setItem } from './storage';

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

const light = {
  bg: '#fffdf5',
  card: '#ffffff',
  ink: '#17160f',
  muted: '#6b685b',
  line: '#17160f',
  soft: '#f3efe0',
  duck: '#ffd23f',
  duckInk: '#17160f',
  orange: '#ff8a1f',
  ok: '#1f9d55',
  danger: '#d64545',
};
const dark = {
  bg: '#121212',
  card: '#1c1c1e',
  ink: '#f5f5f5',
  muted: '#a1a1a6',
  line: '#f5f5f5',
  soft: '#26262a',
  duck: '#ffd23f',
  duckInk: '#17160f',
  orange: '#ff8a1f',
  ok: '#4cd98a',
  danger: '#ff6b6b',
};

function make(isDark: boolean): Tokens {
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

  // The pre-rendered HTML is light. Wait until mounted before applying the real theme, so hydration matches.
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
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.style.backgroundColor = t.bg;
      document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    }
  }, [t, isDark]);

  const value = useMemo(() => ({ t, mode, setMode, toggle }), [t, mode, setMode, toggle]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): Ctx {
  const c = useContext(ThemeCtx);
  if (!c) throw new Error('useTheme outside ThemeProvider');
  return c;
}
