import React, { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { Anchor } from './Anchor';
import { Flag } from './Flag';
import { useNavPress } from './nav';
import { useTheme } from '../lib/theme';
import { KEYS, getItem, setItem } from '../lib/storage';
import { useLocation, useT } from '../i18n/react';
import { translate } from '../i18n/catalog';
import { isLang, liveLocales, localeOf, localePath, type Lang } from '../i18n/locales';

/** Where the same page lives in another language. Switching is a plain link (a full page load) so the new language's catalog loads with its page. */
const target = (path: string, lang: Lang) => localePath(path, lang);

function remember(lang: Lang) {
  setItem(KEYS.lang, lang);
}

/**
 * Web: go to the other language's page with a real page load. react-native-web's Pressable stops the click from reaching the wrapping
 * <a>, so the browser would never follow the link by itself; this does it (and opens a new tab for ctrl/cmd/middle-style clicks).
 */
function goTo(to: string, e?: any) {
  if (typeof window === 'undefined') return;
  if (e && (e.metaKey || e.ctrlKey || e.shiftKey)) window.open(to, '_blank');
  else window.location.assign(to);
}

/**
 * The language menu in the top bar. Hidden until a second language is live. Choosing a language remembers it; nobody is redirected
 * automatically (that would hide pages from crawlers and surprise people who shared a link), see LanguageHint for the gentle nudge.
 */
export function LanguageSwitcher() {
  const { t } = useTheme();
  const tr = useT();
  const nav = useNavPress();
  const { lang, path } = useLocation();
  const [open, setOpen] = useState(false);
  const live = liveLocales();
  if (live.length < 2) return null;
  const here = localeOf(lang);
  return (
    <View style={{ position: 'relative', zIndex: 20 }}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={tr('Change language')}
        accessibilityState={{ expanded: open }}
        style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 2, borderColor: t.line, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: t.card }, t.shadow(3)]}
      >
        <Flag code={here.flag} />
        <Text style={{ color: t.ink, fontWeight: '800' }}>{here.short}</Text>
      </Pressable>
      {open ? (
        <View style={[{ position: 'absolute', top: 44, right: 0, minWidth: 210, maxHeight: 440, padding: 6, borderWidth: 2, borderColor: t.line, borderRadius: 12, backgroundColor: t.card, overflow: 'auto' as any }, t.shadow(4)]}>
          {live.map((l) => {
            const to = target(path, l.code);
            const active = l.code === lang;
            return (
              <Anchor key={l.code} to={to} exact lang={l.hreflang} label={l.name}>
                <Pressable
                  accessibilityRole="link"
                  onPress={(e: any) => {
                    remember(l.code);
                    if (Platform.OS === 'web') return goTo(to, e); // a real page load, so the language's catalog comes with its page
                    nav(to, true)(e);
                  }}
                  style={((s: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: active ? t.duck : s.hovered ? t.soft : 'transparent' })) as any}
                >
                  <Flag code={l.flag} />
                  <Text style={{ color: active ? t.duckInk : t.ink, fontWeight: active ? '900' : '700' }}>{l.native}</Text>
                </Pressable>
              </Anchor>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

/**
 * A slim bar for someone who chose another language before and landed on a page in this one: "This page is also available in
 * Español". It never moves them by itself and goes away for the rest of the visit when dismissed.
 */
export function LanguageHint() {
  const { t } = useTheme();
  const { lang, path } = useLocation();
  const [pref, setPref] = useState<Lang | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    try {
      const saved = getItem(KEYS.lang);
      if (saved && isLang(saved) && saved !== lang && liveLocales().some((l) => l.code === saved) && sessionStorage.getItem('duck.langHint') !== '1') setPref(saved);
      else setPref(null);
    } catch {
      setPref(null);
    }
  }, [lang, path]);
  if (!pref) return null;
  const l = localeOf(pref);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: t.soft, borderBottomWidth: 2, borderColor: t.line }}>
      <Text style={{ flex: 1, color: t.ink }}>{translate(pref, 'This page is also available in your language.')}</Text>
      <Anchor to={target(path, pref)} exact lang={l.hreflang}>
        <Pressable accessibilityRole="link" onPress={(e: any) => goTo(target(path, pref), e)} style={[{ borderWidth: 2, borderColor: t.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: t.duck }, t.shadow(2)]}>
          <Text style={{ color: t.duckInk, fontWeight: '900' }}>{l.native}</Text>
        </Pressable>
      </Anchor>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={translate(pref, 'Dismiss')}
        onPress={() => {
          try {
            sessionStorage.setItem('duck.langHint', '1');
          } catch {}
          setPref(null);
        }}
      >
        <Text style={{ color: t.muted, fontWeight: '900', fontSize: 18 }}>×</Text>
      </Pressable>
    </View>
  );
}
