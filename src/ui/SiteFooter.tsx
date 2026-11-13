import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../lib/theme';
import { useNavPress } from './nav';
import { Anchor } from './Anchor';
import { T } from './kit';
import { FamilyLinks } from './Family';
import { READY } from '../tools';
import { GUIDE_INDEX as GUIDES } from '../content/guideIndex';
import { SITE } from '../config';
import { toolPath } from '../content/toolSlugs';
import { useLang, useT } from '../i18n/react';
import { guideCardFor } from '../i18n/content';

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
  const tr = useT();
  const lang = useLang();
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
        {col(tr('Popular tools'), tools.map((x) => <FooterLink key={x.id} to={toolPath(x.id)} label={tr(x.name)} />))}
        {col(tr('Guides'), GUIDES.slice(0, 6).map((g) => <FooterLink key={g.slug} to={`/guides/${g.slug}`} label={guideCardFor(lang, g).title} />))}
        {col('iDuckPDF', (
          <>
            <FooterLink to="/pdf-tools" label={tr('All PDF tools')} />
            <FooterLink to="/guides/" label={tr('All guides')} />
            <FooterLink to="/chat" label={tr('Ask the helper')} />
            <FooterLink to="/roadmap" label={tr('Roadmap')} />
            <FooterLink to="/about" label={tr('About')} />
            <FooterLink to="/how-it-works" label={tr('How it works')} />
            <FooterLink to="/privacy" label={tr('Privacy policy')} />
            <FooterLink to="/terms" label={tr('Terms of use')} />
            <FooterLink to="/request" label={tr('Request a feature')} />
            <FooterLink to="/feedback" label={tr('Send feedback')} />
            <FooterLink to="/donate" label={tr('Support us')} />
          </>
        ))}
        <View style={{ flexGrow: 1, flexBasis: 200 }}><FamilyLinks /></View>
      </View>
      <T v="small" muted>
        © {new Date(SITE.updated).getFullYear()} {SITE.operator} · {SITE.name} · {SITE.domain} · {tr('Free PDF tools that run in your browser.')} {tr('Last updated {date}.', { date: SITE.updated })}
      </T>
    </View>
  );
}
