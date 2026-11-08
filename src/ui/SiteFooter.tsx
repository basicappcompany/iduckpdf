import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../lib/theme';
import { useNavPress } from './nav';
import { Anchor } from './Anchor';
import { T } from './kit';
import { READY } from '../tools';
import { GUIDES } from '../content/guides';
import { SITE } from '../config';
import { toolPath } from '../content/toolSlugs';

function FooterLink({ to, label }: { to: string; label: string }) {
  const { t } = useTheme();
  const nav = useNavPress();
  return (
    <Anchor to={to}>
      <Pressable accessibilityRole="link" onPress={nav(to)} style={((s: any) => ({ paddingVertical: 3, opacity: s.hovered ? 1 : 0.85 })) as any}>
        {(s: any) => <Text style={{ color: t.ink, fontSize: 14.5, textDecorationLine: s.hovered ? 'underline' : 'none' }}>{label}</Text>}
      </Pressable>
    </Anchor>
  );
}

const POPULAR = ['merge', 'split', 'compress', 'images-to-pdf', 'rotate', 'remove-pages', 'page-numbers', 'text-watermark', 'pdf-to-images', 'redact'];

export function SiteFooter() {
  const { t } = useTheme();
  const tools = POPULAR.map((id) => READY.find((x) => x.id === id)).filter(Boolean) as typeof READY;
  const col = (title: string, children: React.ReactNode) => (
    <View style={{ flexGrow: 1, flexBasis: 200, gap: 2 }}>
      <T v="label" style={{ marginBottom: 4 }}>{title}</T>
      {children}
    </View>
  );
  return (
    <View accessibilityRole={'contentinfo' as any} style={{ borderTopWidth: 2, borderColor: t.line, marginTop: 36, paddingTop: 22, gap: 18 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 22 }}>
        {col('Popular tools', tools.map((x) => <FooterLink key={x.id} to={toolPath(x.id)} label={x.name} />))}
        {col('Guides', GUIDES.slice(0, 6).map((g) => <FooterLink key={g.slug} to={`/guides/${g.slug}`} label={g.title.replace(/^How to /, 'How to ')} />))}
        {col('iDuckPDF', (
          <>
            <FooterLink to="/pdf-tools" label="All PDF tools" />
            <FooterLink to="/guides" label="All guides" />
            <FooterLink to="/chat" label="Ask the helper" />
            <FooterLink to="/roadmap" label="Roadmap" />
            <FooterLink to="/about" label="About" />
            <FooterLink to="/privacy" label="Privacy policy" />
            <FooterLink to="/terms" label="Terms of use" />
            <FooterLink to="/request" label="Request a feature" />
            <FooterLink to="/feedback" label="Send feedback" />
            <FooterLink to="/donate" label="Support us" />
          </>
        ))}
      </View>
      <T v="small" muted>
        © {new Date(SITE.updated).getFullYear()} {SITE.operator} · {SITE.name} · {SITE.domain} · Free PDF tools that run in your browser. Last updated {SITE.updated}.
      </T>
    </View>
  );
}
