import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../lib/theme';
import { useNavPress } from './nav';
import { Anchor } from './Anchor';

export function LinkCard({ to, icon, title, body }: { to: string; icon: string; title: string; body: string }) {
  const { t } = useTheme();
  const nav = useNavPress();
  return (
    <Anchor to={to}>
      <Pressable
        accessibilityRole="link"
        onPress={nav(to)}
        style={((s: any) => [
          { flexGrow: 1, flexBasis: 300, maxWidth: '100%', borderWidth: 2, borderColor: t.line, borderRadius: 14, padding: 16, gap: 6, backgroundColor: s.hovered ? t.duck : t.card },
          t.shadow(4),
          s.hovered ? { transform: [{ translateX: -2 }, { translateY: -2 }] } : null,
        ]) as any}
      >
        {(s: any) => (
          <>
            <Text style={{ fontSize: 26 }}>{icon}</Text>
            <Text style={{ color: s.hovered ? t.duckInk : t.ink, fontWeight: '900', fontSize: 17, lineHeight: 22 }}>{title}</Text>
            <Text style={{ color: s.hovered ? t.duckInk : t.muted, fontSize: 14, lineHeight: 20 }}>{body}</Text>
          </>
        )}
      </Pressable>
    </Anchor>
  );
}
