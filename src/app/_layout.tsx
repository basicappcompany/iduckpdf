import React from 'react';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from '../lib/theme';
import { PaletteProvider } from '../lib/palette';
import { Shell } from '../ui/Shell';

function Inner() {
  const { t } = useTheme();
  return (
    <>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <Shell>
        <Slot />
      </Shell>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <PaletteProvider>
        <Inner />
      </PaletteProvider>
    </ThemeProvider>
  );
}
