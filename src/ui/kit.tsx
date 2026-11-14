import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useNavPress } from './nav';
import { Anchor } from './Anchor';
import { useWidth } from '../lib/useWidth';
import { ds } from '../lib/responsive';
import { useTheme } from '../lib/theme';

/* ---------- text ---------- */
type Variant = 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'mono' | 'label';

export function T({ v = 'body', level: levelOverride, muted, color, style, children, ...rest }: { v?: Variant; level?: 1 | 2 | 3 | 4; muted?: boolean; color?: string; style?: StyleProp<TextStyle>; children?: React.ReactNode } & Record<string, any>) {
  const { t } = useTheme();
  const width = useWidth();
  const big = width >= 760;
  const base: TextStyle = { color: color || (muted ? t.muted : t.ink) };
  const sizes: Record<Variant, TextStyle> = {
    h1: { fontSize: big ? 50 : 34, lineHeight: big ? 54 : 38, fontWeight: '900', letterSpacing: -1.5 },
    h2: { fontSize: big ? 26 : 22, lineHeight: big ? 32 : 28, fontWeight: '900', letterSpacing: -0.5 },
    h3: { fontSize: 17, lineHeight: 23, fontWeight: '800' },
    body: { fontSize: 16, lineHeight: 24 },
    small: { fontSize: 13.5, lineHeight: 19 },
    label: { fontSize: 13.5, lineHeight: 18, fontWeight: '800' },
    mono: { fontSize: 13.5, lineHeight: 20, fontFamily: 'ui-monospace, Menlo, Consolas, monospace' },
  };
  const level = levelOverride ?? (v === 'h1' ? 1 : v === 'h2' ? 2 : v === 'h3' ? 3 : 0); // level: keep the visual size but fix the heading order for screen readers
  const a11y = level ? ({ role: 'heading', 'aria-level': level } as any) : null;
  return (
    <Text {...a11y} {...(v === 'h1' || v === 'h2' ? ds(v) : null)} {...rest} style={[base, sizes[v], style]}>
      {children}
    </Text>
  );
}

/* ---------- surfaces ---------- */
export function Card({ children, style, hot }: { children?: React.ReactNode; style?: StyleProp<ViewStyle>; hot?: boolean }) {
  const { t } = useTheme();
  return <View style={[{ backgroundColor: hot ? t.duck : t.card, borderWidth: 2, borderColor: t.line, borderRadius: 14, padding: 16 }, t.shadow(4), style]}>{children}</View>;
}

/** Equal-width columns that never stretch: a short last row keeps the same card size as the rows above it. */
export function CardGrid({ min = 240, gap = 14, children }: { min?: number; gap?: number; children?: React.ReactNode }) {
  return <View style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}px, 100%), 1fr))`, gap } as any}>{children}</View>;
}

export function Banner({ children, tone = 'info', style }: { children: React.ReactNode; tone?: 'info' | 'warn' | 'error' | 'ok'; style?: StyleProp<ViewStyle> }) {
  const { t } = useTheme();
  const bg = tone === 'error' ? t.danger : tone === 'ok' ? t.ok : tone === 'warn' ? t.duck : t.soft;
  const fg = tone === 'error' ? '#fff' : tone === 'ok' ? '#0b2b1a' : tone === 'warn' ? t.duckInk : t.ink;
  return (
    <View style={[{ backgroundColor: bg, borderWidth: 2, borderColor: t.line, borderStyle: tone === 'info' ? 'dashed' : 'solid', borderRadius: 12, padding: 12 }, style]}>
      {typeof children === 'string' ? <T v="small" color={fg}>{children}</T> : children}
    </View>
  );
}

export function Pill({ children, tone }: { children: React.ReactNode; tone?: 'ok' | 'muted' | 'duck' }) {
  const { t } = useTheme();
  const bg = tone === 'ok' ? t.ok : tone === 'duck' ? t.duck : 'transparent';
  const fg = tone === 'ok' ? '#031209' : tone === 'duck' ? t.duckInk : t.muted; // dark text on the green pill: white was 1.8:1, #0b2b1a was 4.3:1, this is above 4.5:1
  return (
    <View style={{ borderWidth: 1.5, borderColor: tone ? bg : t.muted, backgroundColor: bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 }}>
      <Text style={{ color: fg, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' }}>{children}</Text>
    </View>
  );
}

/* ---------- buttons ---------- */
type BtnProps = { label: string; onPress?: () => void; variant?: 'primary' | 'ghost' | 'dark'; disabled?: boolean; small?: boolean; icon?: string; style?: StyleProp<ViewStyle>; to?: string };

export function Btn({ label, onPress, variant = 'primary', disabled, small, icon, style, to }: BtnProps) {
  const { t } = useTheme();
  const nav = useNavPress();
  const press = to ? nav(to) : onPress;
  const bg = variant === 'primary' ? t.duck : variant === 'dark' ? t.ink : t.card;
  const fg = variant === 'primary' ? t.duckInk : variant === 'dark' ? t.bg : t.ink;
  const node = (
    <Pressable
      accessibilityRole={to ? 'link' : 'button'}
      disabled={disabled}
      onPress={press}
      style={((s: any) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: bg,
          borderWidth: 2,
          borderColor: t.line,
          borderRadius: 14,
          paddingVertical: small ? 7 : 12,
          paddingHorizontal: small ? 14 : 24,
          opacity: disabled ? 0.4 : 1,
        },
        disabled ? null : t.shadow(small ? 3 : 4),
        !disabled && s.hovered ? { transform: [{ translateX: -2 }, { translateY: -2 }] } : null,
        !disabled && s.pressed ? { transform: [{ translateX: 3 }, { translateY: 3 }], boxShadow: '0px 0px 0px 0px transparent' } : null,
        style,
      ]) as any}
    >
      {icon ? <Text style={{ fontSize: small ? 14 : 17 }}>{icon}</Text> : null}
      <Text style={{ color: fg, fontWeight: '900', fontSize: small ? 14 : 16 }}>{label}</Text>
    </Pressable>
  );
  return to ? <Anchor to={to}>{node}</Anchor> : node;
}

export function Chip({ label, on, onPress, icon, to, small }: { label: string; on?: boolean; onPress?: () => void; icon?: string; to?: string; small?: boolean }) {
  const { t } = useTheme();
  const nav = useNavPress();
  const node = (
    <Pressable
      accessibilityRole={to ? 'link' : 'button'}
      {...(!to && onPress ? ({ 'aria-pressed': !!on } as any) : null)}
      onPress={to ? nav(to) : onPress}
      style={((s: any) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          borderWidth: 2,
          borderColor: t.line,
          borderRadius: 999,
          paddingHorizontal: small ? 10 : 14,
          paddingVertical: small ? 3 : 6,
          backgroundColor: on || s.hovered ? t.duck : t.card,
        },
      ]) as any}
    >
      {icon ? <Text>{icon}</Text> : null}
      <Text style={{ color: on || false ? t.duckInk : t.ink, fontWeight: '800', fontSize: small ? 12.5 : 14 }}>{label}</Text>
    </Pressable>
  );
  return to ? <Anchor to={to}>{node}</Anchor> : node;
}

/* ---------- form fields ---------- */
export function Field({ label, hint, children }: { label?: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 5 }}>
      {label ? <T v="label">{label}</T> : null}
      {children}
      {hint ? <T v="small" muted>{hint}</T> : null}
    </View>
  );
}

export function TextField({ value, onChange, placeholder, multiline, secure, numeric, style }: { value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; secure?: boolean; numeric?: boolean; style?: StyleProp<TextStyle> }) {
  const { t } = useTheme();
  const [focus, setFocus] = React.useState(false);
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={t.muted}
      multiline={multiline}
      secureTextEntry={secure}
      keyboardType={numeric ? 'numeric' : 'default'}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={[
        {
          borderWidth: 2,
          borderColor: t.line,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 16,
          color: t.ink,
          backgroundColor: t.card,
          minHeight: multiline ? 110 : undefined,
          textAlignVertical: multiline ? 'top' : 'center',
          outlineStyle: 'none',
        } as any,
        focus ? t.shadow(3) : null,
        style,
      ]}
    />
  );
}

export function Choice({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => (
        <Chip key={o.value} label={o.label} on={o.value === value} onPress={() => onChange(o.value)} small />
      ))}
    </View>
  );
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const { t } = useTheme();
  return (
    <Pressable onPress={() => onChange(!value)} accessibilityRole="switch" accessibilityState={{ checked: value }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 44, height: 26, borderRadius: 13, borderWidth: 2, borderColor: t.line, backgroundColor: value ? t.duck : t.soft, justifyContent: 'center' }}>
        <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: value ? t.duckInk : t.muted, marginLeft: value ? 22 : 3 }} />
      </View>
      <T v="label" style={{ flex: 1 }}>{label}</T>
    </Pressable>
  );
}

/* ---------- layout ---------- */
export function Screen({ children, narrow }: { children: React.ReactNode; narrow?: boolean }) {
  const width = useWidth();
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ alignItems: 'center', paddingTop: 28, paddingBottom: 64 }} keyboardShouldPersistTaps="handled">
      <View {...ds('pad')} style={{ width: '100%', alignItems: 'center', paddingHorizontal: width < 600 ? 16 : 28 }}>
        <View style={{ width: '100%', maxWidth: narrow ? 720 : 1040, gap: 18 }}>{children}</View>
      </View>
    </ScrollView>
  );
}

export function Heading({ children }: { children: React.ReactNode }) {
  const { t } = useTheme();
  return (
    <View style={{ alignSelf: 'flex-start' }}>
      <T v="h1">
        {children}
      </T>
      <View style={{ height: 0 }} />
    </View>
  );
}

export function Hl({ children }: { children: React.ReactNode }) {
  const { t } = useTheme();
  return <Text style={{ backgroundColor: t.duck, color: t.duckInk }}>{` ${children} `}</Text>;
}

export const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
