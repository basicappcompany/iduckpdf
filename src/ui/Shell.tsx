import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocation, useT } from '../i18n/react';
import { LanguageHint, LanguageSwitcher } from './LanguageSwitcher';
import { useNavPress } from './nav';
import { Anchor } from './Anchor';
import { useWidthState } from '../lib/useWidth';
import { ds } from '../lib/responsive';
import { useTheme } from '../lib/theme';
import { usePalette } from '../lib/palette';
import { CATEGORIES, VISIBLE_CATEGORIES, inCategory } from '../tools';
import { Logo } from './Logo';
import { Pill } from './kit';
import { idForSlug, toolPath } from '../content/toolSlugs';

function NavItem({ to, icon, label, active, small, pill }: { to: string; icon?: string; label: string; active?: boolean; small?: boolean; pill?: 'soon' }) {
  const { t } = useTheme();
  const nav = useNavPress();
  return (
    <Anchor to={to}>
      <Pressable
        accessibilityRole="link"
        onPress={nav(to)}
        style={((s: any) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 9,
          paddingVertical: small ? 5 : 7,
          paddingHorizontal: 10,
          borderRadius: 10,
          backgroundColor: active ? t.duck : s.hovered ? t.soft : 'transparent',
        })) as any}
      >
        {icon ? <Text style={{ fontSize: small ? 14 : 16, width: 22, textAlign: 'center' }}>{icon}</Text> : null}
        <Text numberOfLines={1} style={{ flex: 1, color: active ? t.duckInk : t.ink, fontWeight: active ? '900' : '700', fontSize: small ? 13.5 : 15 }}>
          {label}
        </Text>
        {pill ? <Pill>{pill}</Pill> : null}
      </Pressable>
    </Anchor>
  );
}

function Group({ id, name, icon, open, onToggle, children }: { id: string; name: string; icon: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  const { t } = useTheme();
  return (
    <View>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} style={((s: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 10, backgroundColor: s.hovered ? t.soft : 'transparent' })) as any}>
        <Text style={{ fontSize: 16, width: 22, textAlign: 'center' }}>{icon}</Text>
        <Text style={{ flex: 1, color: t.ink, fontWeight: '800', fontSize: 15 }}>{name}</Text>
        <Text style={{ color: t.muted, fontWeight: '900', transform: [{ rotate: open ? '90deg' : '0deg' }] }}>›</Text>
      </Pressable>
      {open ? <View style={{ marginLeft: 20, paddingLeft: 6, borderLeftWidth: 2, borderColor: t.soft }}>{children}</View> : null}
    </View>
  );
}

export function Sidebar() {
  const { t } = useTheme();
  const { open } = usePalette();
  const nav = useNavPress();
  const tr = useT();
  const { path } = useLocation();
  const toolId = idForSlug(path.slice(1)) ?? '';
  const currentCat = CATEGORIES.find((c) => inCategory(c.id).some((x) => x.id === toolId))?.id;
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({ join: true });
  useEffect(() => {
    if (currentCat) setOpenCats((o) => ({ ...o, [currentCat]: true }));
  }, [currentCat]);

  return (
    <View style={{ width: 280, height: '100%', backgroundColor: t.card, borderRightWidth: 2, borderColor: t.line }}>
      <ScrollView contentContainerStyle={{ padding: 12, gap: 3 }} showsVerticalScrollIndicator={false}>
        <Anchor to="/" label={tr('iDuckPDF home')}>
          <Pressable accessibilityRole="link" onPress={nav('/')} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6, paddingVertical: 4, marginBottom: 8 }}>
            <Logo size={34} />
            <Text style={{ color: t.ink, fontWeight: '900', fontSize: 22, letterSpacing: -0.5 }}>iDuckPDF</Text>
          </Pressable>
        </Anchor>

        <Pressable onPress={open} accessibilityRole="button" style={((s: any) => [{ flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 2, borderColor: t.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8, backgroundColor: s.hovered ? t.soft : t.bg }, t.shadow(3)]) as any}>
          <Text>🔍</Text>
          <Text style={{ flex: 1, color: t.muted }}>{tr('Search…')}</Text>
          <Text style={{ color: t.muted, fontSize: 11, fontWeight: '800', borderWidth: 1.5, borderColor: t.muted, borderRadius: 6, paddingHorizontal: 5 }}>Ctrl K</Text>
        </Pressable>

        <NavItem to="/" icon="🏠" label={tr('Home')} active={path === '/'} />
        <NavItem to="/chat" icon="💬" label={tr('Ask the helper')} active={path === '/chat'} />
        <NavItem to="/pdf-tools" icon="🧰" label={tr('All PDF tools')} active={path === '/pdf-tools'} />

        <Text style={{ color: t.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 12, marginBottom: 2, paddingHorizontal: 10 }}>{tr('Tools')}</Text>
        {VISIBLE_CATEGORIES.map((c) => (
          <Group key={c.id} id={c.id} name={tr(c.name)} icon={c.icon} open={!!openCats[c.id]} onToggle={() => setOpenCats((o) => ({ ...o, [c.id]: !o[c.id] }))}>
            {inCategory(c.id).map((tl) => (
              <NavItem key={tl.id} to={toolPath(tl.id)} icon={tl.icon} label={tr(tl.name)} small active={toolId === tl.id} pill={tl.status === 'soon' ? 'soon' : undefined} />
            ))}
          </Group>
        ))}

        <Text style={{ color: t.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 12, marginBottom: 2, paddingHorizontal: 10 }}>{tr('Community')}</Text>
        <NavItem to="/roadmap" icon="🗺️" label={tr('Roadmap')} active={path === '/roadmap'} />
        <NavItem to="/request" icon="💡" label={tr('Request a feature')} active={path === '/request'} />
        <NavItem to="/feedback" icon="📮" label={tr('Send feedback')} active={path === '/feedback'} />
        <NavItem to="/donate" icon="💛" label={tr('Support iDuckPDF')} active={path === '/donate'} />
        <NavItem to="/settings" icon="⚙️" label={tr('Settings')} active={path === '/settings'} />
        <NavItem to="/about" icon="🦆" label={tr('About')} active={path === '/about'} />
      </ScrollView>
    </View>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { t, toggle } = useTheme();
  const { open } = usePalette();
  const nav = useNavPress();
  const tr = useT();
  const { width, ready } = useWidthState();
  const wide = width >= 980;
  const [drawer, setDrawer] = useState(false);
  const { path } = useLocation();
  useEffect(() => setDrawer(false), [path]);

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: t.bg }}>
      {!ready || wide ? <View {...ds('sidebar')} style={{ height: '100%' }}><Sidebar /></View> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 2, borderColor: t.line, backgroundColor: t.bg }}>
          {!ready || !wide ? (
            <View {...ds('narrow')}>
            <Pressable onPress={() => setDrawer(true)} accessibilityRole="button" accessibilityLabel={tr('Open menu')} style={[{ borderWidth: 2, borderColor: t.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: t.card }, t.shadow(3)]}>
              <Text style={{ color: t.ink, fontWeight: '900', fontSize: 16 }}>☰</Text>
            </Pressable>
            </View>
          ) : null}
          {!ready || !wide ? (
            <View {...ds('narrow')}>
            <Anchor to="/" label={tr('iDuckPDF home')}>
              <Pressable accessibilityRole="link" onPress={nav('/')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Logo size={26} />
                <Text style={{ color: t.ink, fontWeight: '900', fontSize: 18 }}>iDuckPDF</Text>
              </Pressable>
            </Anchor>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={tr('Search')} style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 2, borderColor: t.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: t.card }, t.shadow(3)]}>
            <Text>🔍</Text>
            <Text {...ds('w560')} style={{ color: t.muted, fontWeight: '700' }}>{tr('Search')} · Ctrl K</Text>
          </Pressable>
          <LanguageSwitcher />
          <Pressable onPress={toggle} accessibilityRole="button" accessibilityLabel={tr('Switch light or dark mode')} style={[{ borderWidth: 2, borderColor: t.line, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: t.card }, t.shadow(3)]}>
            <Text style={{ fontSize: 16 }}><Text {...ds('moon')}>🌙</Text><Text {...ds('sun')}>☀️</Text></Text>
          </Pressable>
          <Anchor to="/donate" label={tr('Support iDuckPDF')}>
            <Pressable accessibilityRole="link" onPress={nav('/donate')} style={[{ borderWidth: 2, borderColor: t.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: t.duck }, t.shadow(3)]}>
              <Text style={{ color: t.duckInk, fontWeight: '900' }}>💛<Text {...ds('w520')}> {tr('Support')}</Text></Text>
            </Pressable>
          </Anchor>
        </View>
        <LanguageHint />
        <View accessibilityRole={'main' as any} style={{ flex: 1 }}>{children}</View>
      </View>

      {!wide && drawer ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', zIndex: 50 }}>
          <Sidebar />
          <Pressable accessibilityLabel={tr('Close menu')} onPress={() => setDrawer(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
        </View>
      ) : null}
    </View>
  );
}
