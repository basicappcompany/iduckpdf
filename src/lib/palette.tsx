import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from './theme';
import { READY, searchTools } from '../tools';
import { toolPath } from '../content/toolSlugs';

type Item = { id: string; label: string; icon: string; hint: string; run: () => void; group: 'Tools' | 'Pages' | 'Actions' };

const Ctx = createContext<{ open: () => void } | null>(null);
export const usePalette = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePalette outside PaletteProvider');
  return c;
};

export const PAGES: { to: string; label: string; icon: string; kw: string }[] = [
  { to: '/', label: 'Home', icon: '🏠', kw: 'start main' },
  { to: '/chat', label: 'Ask the helper', icon: '💬', kw: 'chat assistant help which tool' },
  { to: '/pdf-tools', label: 'All PDF tools', icon: '🧰', kw: 'browse list everything' },
  { to: '/roadmap', label: 'Roadmap', icon: '🗺️', kw: 'coming soon planned upcoming' },
  { to: '/request', label: 'Request a feature', icon: '💡', kw: 'suggest idea wish' },
  { to: '/feedback', label: 'Send feedback', icon: '📮', kw: 'bug report problem contact' },
  { to: '/donate', label: 'Support iDuckPDF', icon: '💛', kw: 'donate tip coffee sponsor' },
  { to: '/settings', label: 'Settings', icon: '⚙️', kw: 'theme dark ai key api' },
  { to: '/about', label: 'About', icon: '🦆', kw: 'privacy how it works info' },
];

export function PaletteProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const open = useCallback(() => setOpen(true), []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const h = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && k === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (k === '/' && !typing && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setOpen(true);
      } else if (k === 'escape') {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  return (
    <Ctx.Provider value={{ open }}>
      {children}
      <Palette visible={isOpen} onClose={() => setOpen(false)} />
    </Ctx.Provider>
  );
}

function Palette({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t, toggle } = useTheme();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);

  useEffect(() => {
    if (visible) {
      setQ('');
      setSel(0);
    }
  }, [visible]);

  const go = useCallback(
    (to: string) => () => {
      onClose();
      router.push(to as any);
    },
    [onClose, router],
  );

  const items: Item[] = useMemo(() => {
    const query = q.trim().toLowerCase();
    const pages: Item[] = PAGES.filter((p) => !query || (p.label + ' ' + p.kw).toLowerCase().includes(query)).map((p) => ({ id: 'p' + p.to, label: p.label, icon: p.icon, hint: 'Page', group: 'Pages' as const, run: go(p.to) }));
    const actions: Item[] = [{ id: 'theme', label: 'Switch light / dark', icon: '🌗', hint: 'Action', group: 'Actions' as const, run: () => { onClose(); toggle(); } }].filter((a) => !query || 'theme dark light mode night switch'.includes(query) || a.label.toLowerCase().includes(query));
    const tools: Item[] = (query ? searchTools(query, 8) : READY.slice(0, 8)).map((tl) => ({
      id: 't' + tl.id,
      label: tl.name,
      icon: tl.icon,
      hint: tl.status === 'ready' ? 'Tool' : 'Coming soon',
      group: 'Tools' as const,
      run: go(toolPath(tl.id)),
    }));
    return [...tools, ...pages, ...actions].slice(0, 14);
  }, [q, go, onClose, toggle]);

  useEffect(() => setSel((s) => Math.min(s, Math.max(0, items.length - 1))), [items.length]);

  const onKey = (e: any) => {
    const k = e.nativeEvent?.key;
    if (k === 'ArrowDown') {
      e.preventDefault?.();
      setSel((s) => Math.min(items.length - 1, s + 1));
    } else if (k === 'ArrowUp') {
      e.preventDefault?.();
      setSel((s) => Math.max(0, s - 1));
    } else if (k === 'Escape') onClose();
  };

  let lastGroup = '';
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close search" onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', paddingTop: '11%', paddingHorizontal: 14 }}>
        <Pressable onPress={() => {}} style={[{ width: '100%', maxWidth: 640, backgroundColor: t.card, borderWidth: 3, borderColor: t.line, borderRadius: 18, overflow: 'hidden' }, { boxShadow: '8px 8px 0px #000' } as any]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 2, borderColor: t.line }}>
            <Text style={{ fontSize: 18 }}>🔍</Text>
            <TextInput
              autoFocus
              value={q}
              onChangeText={(v) => {
                setQ(v);
                setSel(0);
              }}
              onKeyPress={onKey}
              onSubmitEditing={() => items[sel]?.run()}
              placeholder="Search tools, pages and actions…"
              placeholderTextColor={t.muted}
              style={[{ flex: 1, fontSize: 18, color: t.ink }, { outlineStyle: 'none' } as any]}
            />
            <Text style={{ color: t.muted, fontSize: 12, fontWeight: '800', borderWidth: 1.5, borderColor: t.muted, borderRadius: 6, paddingHorizontal: 6 }}>Esc</Text>
          </View>
          <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 8 }}>
            {items.length === 0 ? (
              <Text style={{ color: t.muted, padding: 16 }}>Nothing matches “{q}”. Try the helper from the sidebar.</Text>
            ) : (
              items.map((it, i) => {
                const header = it.group !== lastGroup ? it.group : '';
                lastGroup = it.group;
                const on = i === sel;
                return (
                  <View key={it.id}>
                    {header ? <Text style={{ color: t.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase', paddingHorizontal: 10, paddingTop: 8, paddingBottom: 3 }}>{header}</Text> : null}
                    <Pressable
                      onPress={it.run}
                      onHoverIn={() => setSel(i)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: on ? t.duck : 'transparent' }}
                    >
                      <Text style={{ fontSize: 20, width: 28, textAlign: 'center' }}>{it.icon}</Text>
                      <Text style={{ flex: 1, color: on ? t.duckInk : t.ink, fontWeight: '800', fontSize: 15.5 }}>{it.label}</Text>
                      <Text style={{ color: on ? t.duckInk : t.muted, fontSize: 12 }}>{it.hint}</Text>
                    </Pressable>
                  </View>
                );
              })
            )}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 16, justifyContent: 'center', padding: 9, borderTopWidth: 2, borderColor: t.line }}>
            <Text style={{ color: t.muted, fontSize: 12 }}>↑ ↓ move</Text>
            <Text style={{ color: t.muted, fontSize: 12 }}>Enter open</Text>
            <Text style={{ color: t.muted, fontSize: 12 }}>Esc close</Text>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
