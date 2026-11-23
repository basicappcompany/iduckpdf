import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { Anchor } from './Anchor';
import { ds } from '../lib/responsive';
import { Flag } from './Flag';
import { useNavPress } from './nav';
import { useTheme } from '../lib/theme';
import { KEYS, getItem, setItem } from '../lib/storage';
import { useLocation, useT } from '../i18n/react';
import { translate } from '../i18n/catalog';
import { DEFAULT_LANG, isLang, liveLocales, localeOf, localePath, type Lang } from '../i18n/locales';
import { LANDING_SLUG_LIST } from '../content/landingSlugs';

/**
 * Where the same page lives in another language. Switching is a plain link (a full page load) so the new language's catalog loads with its page.
 * English-only landing pages have no translated copy, so for those the link goes to the language's home page instead of a missing address.
 */
const target = (path: string, lang: Lang) =>
  lang !== DEFAULT_LANG && LANDING_SLUG_LIST.includes(path.slice(1).split(/[?#/]/)[0]) ? localePath('/', lang) : localePath(path, lang);

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
  useEffect(() => {
    if (!open || Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  const live = liveLocales();
  if (live.length < 2) return null;
  const here = localeOf(lang);
  return (
    <View style={{ position: 'relative', zIndex: 20 }}>
      <Pressable {...ds('btn')}
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={tr('Change language')}
        accessibilityState={{ expanded: open }}
        style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 2, borderColor: t.line, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: t.card }, t.shadow(3)]}
      >
        <Flag code={here.flag} />
        <Text {...ds('w520')} style={{ color: t.ink, fontWeight: '800' }}>{here.short}</Text>
      </Pressable>
      {open ? (
        // a transparent layer over the whole screen: a tap or click anywhere outside the menu closes it
        <Pressable accessibilityLabel={tr('Close menu')} onPress={() => setOpen(false)} style={(Platform.OS === 'web' ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, cursor: 'default' } : { position: 'absolute', top: -2000, left: -2000, right: -2000, bottom: -2000 }) as any} />
      ) : null}
      {open ? (
        <View testID="lang-menu" style={[{ position: 'absolute', top: 44, right: 0, minWidth: 210, maxHeight: 440, padding: 6, borderWidth: 2, borderColor: t.line, borderRadius: 12, backgroundColor: t.card, overflow: 'auto' as any }, t.shadow(4)]}>
          {live.map((l) => {
            const to = target(path, l.code);
            const active = l.code === lang;
            return (
              <Anchor key={l.code} to={to} exact lang={l.hreflang} label={l.name}>
                <Pressable
                  accessibilityRole="link"
                  onPress={(e: any) => {
                    setOpen(false);
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
 * Every language as a plain link, always in the page (the menu above only exists after a click, so a crawler never sees it).
 * Without these, the pages in the other languages are linked from nowhere except the sitemap and the hreflang tags.
 * Lives at the bottom of the sidebar, which is rendered on every page.
 */
export function LanguageLinks() {
  const { t } = useTheme();
  const tr = useT();
  const nav = useNavPress();
  const { lang, path } = useLocation();
  const live = liveLocales();
  if (live.length < 2) return null;
  return (
    <View testID="lang-links">
      <Text style={{ color: t.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 12, marginBottom: 6, paddingHorizontal: 10 }}>{tr('Change language')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 10 }}>
        {live.map((l) => {
          const to = target(path, l.code);
          const active = l.code === lang;
          return (
            <Anchor key={l.code} to={to} exact lang={l.hreflang}>
              <Pressable
                accessibilityRole="link"
                onPress={(e: any) => {
                  remember(l.code);
                  if (Platform.OS === 'web') return goTo(to, e);
                  nav(to, true)(e);
                }}
                style={((s: any) => ({ borderWidth: 1.5, borderColor: t.line, borderRadius: 8, paddingVertical: 3, paddingHorizontal: 8, backgroundColor: active ? t.duck : s.hovered ? t.soft : 'transparent' })) as any}
              >
                <Text style={{ color: active ? t.duckInk : t.ink, fontWeight: active ? '900' : '700', fontSize: 13 }}>{l.native}</Text>
              </Pressable>
            </Anchor>
          );
        })}
      </View>
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
