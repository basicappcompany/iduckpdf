import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavPress } from './nav';
import { Anchor } from './Anchor';
import { useTheme } from '../lib/theme';
import type { ToolDef } from '../tools';
import { Pill } from './kit';
import { toolPath } from '../content/toolSlugs';
import { useT } from '../i18n/react';

export function ToolCard({ tool, compact, badge }: { tool: ToolDef; compact?: boolean; badge?: string }) {
  const { t } = useTheme();
  const nav = useNavPress();
  const tr = useT();
  return (
    <Anchor to={toolPath(tool.id)}>
      <Pressable
        onPress={nav(toolPath(tool.id))}
        accessibilityRole="link"
        style={((s: any) => [
          {
            minWidth: 0,
            borderWidth: 2,
            borderColor: t.line,
            borderRadius: 14,
            padding: compact ? 12 : 16,
            backgroundColor: s.hovered ? t.duck : t.card,
            gap: 4,
          },
          t.shadow(4),
          s.hovered ? { transform: [{ translateX: -2 }, { translateY: -2 }] } : null,
          s.pressed ? { transform: [{ translateX: 3 }, { translateY: 3 }], boxShadow: '0px 0px 0px 0px transparent' } : null,
        ]) as any}
      >
        {(s: any) => (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: compact ? 22 : 28 }}>{tool.icon}</Text>
              <Text style={{ flex: 1, color: s.hovered ? t.duckInk : t.ink, fontWeight: '900', fontSize: compact ? 15 : 17 }}>{tr(tool.name)}</Text>
              {tool.status === 'soon' ? <Pill>{tr('soon')}</Pill> : badge ? <Pill tone="duck">{badge}</Pill> : null}
            </View>
            {!compact ? <Text style={{ color: s.hovered ? t.duckInk : t.muted, fontSize: 14, lineHeight: 19 }}>{tr(tool.short)}</Text> : null}
          </>
        )}
      </Pressable>
    </Anchor>
  );
}
