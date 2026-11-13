import React from 'react';
import { Linking, Platform, Text, View } from 'react-native';
import { useTheme } from '../lib/theme';
import { useT } from '../i18n/react';

/** The sister sites of the iDuck family (same operator, same promises). Shown in the sidebar and the footer as real links. */
export const FAMILY = [
  { name: 'iDuckIMG', url: 'https://iduckimg.com/' },
  { name: 'iDuckCalculator', url: 'https://iduckcalculator.com/' },
  { name: 'iDuckConvert', url: 'https://iduckconvert.com/' },
];

export function FamilyLinks({ compact }: { compact?: boolean }) {
  const { t } = useTheme();
  const tr = useT();
  return (
    <View style={{ gap: 2, marginTop: compact ? 12 : 0 }}>
      <Text style={{ color: t.muted, fontSize: compact ? 11 : 12, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase', paddingHorizontal: compact ? 10 : 0, marginBottom: compact ? 2 : 4 }}>
        {tr('Also from iDuck')}
      </Text>
      {FAMILY.map((f) => (
        <Text
          key={f.url}
          accessibilityRole="link"
          {...({ href: f.url, hrefAttrs: { rel: 'noopener', target: '_blank' } } as any)}
          onPress={Platform.OS === 'web' ? undefined : () => Linking.openURL(f.url)}
          style={{ color: t.ink, fontSize: compact ? 14 : 14.5, paddingVertical: 3, paddingHorizontal: compact ? 10 : 0, opacity: 0.85 }}
        >
          {compact ? '🦆 ' : ''}{f.name}
        </Text>
      ))}
    </View>
  );
}
