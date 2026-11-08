import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../lib/theme';
import { usePalette } from '../lib/palette';
import { KEYS, getJSON } from '../lib/storage';
import { CATEGORIES, READY, SOON, byId, inCategory } from '../tools';
import { Btn, Card, Chip, Hl, Screen, T } from '../ui/kit';
import { Logo } from '../ui/Logo';
import { ToolCard } from '../ui/ToolCard';
import { Seo } from '../lib/seo';
import { HOME_FAQ } from '../content/homeFaq';
import { SiteFooter } from '../ui/SiteFooter';
import { LinkCard } from '../ui/LinkCard';
import { GUIDES } from '../content/guides';
import { SITE } from '../config';

const POPULAR = ['merge', 'split', 'compress', 'images-to-pdf', 'page-numbers', 'text-watermark', 'pdf-to-images', 'inspect'];

export default function Home() {
  const { t } = useTheme();
  const { open } = usePalette();
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => setRecent(getJSON<string[]>(KEYS.recent, [])), []);

  return (
    <Screen>
      <Seo path="/" />
      <View style={{ alignItems: 'center', gap: 12, paddingTop: 10 }}>
        <Logo size={88} />
        <T v="h1" style={{ textAlign: 'center' }}>
          PDFs, <Hl>quacked</Hl> open.
        </T>
        <T muted style={{ textAlign: 'center', maxWidth: 560, fontSize: 17 }}>
          {READY.length} free tools to join, cut, mark up, shrink and tidy your PDFs. No sign-up, no watermark, and most of it runs right in your browser tab.
        </T>
        <Pressable
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel="Search tools"
          style={((s: any) => [{ width: '100%', maxWidth: 620, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, borderColor: t.line, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 15, backgroundColor: t.card, marginTop: 6 }, t.shadow(4), s.hovered ? { transform: [{ translateX: -2 }, { translateY: -2 }] } : null]) as any}
        >
          <Text style={{ fontSize: 18 }}>🔍</Text>
          <Text style={{ flex: 1, color: t.muted, fontSize: 17 }}>What do you want to do with your PDF?</Text>
          <Text style={{ color: t.muted, fontSize: 12, fontWeight: '800', borderWidth: 1.5, borderColor: t.muted, borderRadius: 6, paddingHorizontal: 6 }}>Ctrl K</Text>
        </Pressable>
      </View>

      <Card hot style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <Text style={{ fontSize: 34 }}>💬</Text>
        <View style={{ flex: 1, minWidth: 200 }}>
          <T v="h3" color={t.duckInk}>Not sure which tool you need?</T>
          <T color={t.duckInk} style={{ opacity: 0.8 }}>Describe the job in plain words and the helper will point you to the right one.</T>
        </View>
        <Btn label="Ask the helper" variant="dark" to="/chat" />
      </Card>

      {recent.length ? (
        <View style={{ gap: 8 }}>
          <T v="h3">Pick up where you left off</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {recent.map((id) => byId(id)).filter(Boolean).map((tl) => <Chip key={tl!.id} label={tl!.name} icon={tl!.icon} to={`/tool/${tl!.id}`} />)}
          </View>
        </View>
      ) : null}

      <View style={{ gap: 12 }}>
        <T v="h2">Popular right now</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {POPULAR.map((id) => byId(id)).filter(Boolean).map((tl) => <ToolCard key={tl!.id} tool={tl!} />)}
        </View>
      </View>

      {CATEGORIES.filter((c) => c.id !== 'soon').map((c) => (
        <View key={c.id} style={{ gap: 12 }}>
          <View style={{ gap: 2 }}>
            <T v="h2">{c.icon} {c.name}</T>
            <T muted>{c.blurb}</T>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {inCategory(c.id).map((tl) => <ToolCard key={tl.id} tool={tl} compact />)}
          </View>
        </View>
      ))}

      <View style={{ gap: 12 }}>
        <T v="h2">🛠️ On the roadmap</T>
        <T muted>{SOON.length} more tools are planned. Tell us which ones you need first.</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {SOON.map((tl) => <Chip key={tl.id} label={tl.name} icon={tl.icon} to={`/tool/${tl.id}`} />)}
        </View>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <Btn label="See the roadmap" variant="ghost" small to="/roadmap" />
          <Btn label="Request a feature" icon="💡" small to="/request" />
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        {[
          ['🔐', 'Your files stay with you', 'Most tools process PDFs inside your browser. When something does need an outside service (like the AI tools), we say so before you start.'],
          ['🎟️', 'No account, no watermark', 'Open a tool, use it, download the result. That is the whole deal.'],
          ['🗝️', 'Bring your own AI key', 'AI summaries and Q&A use a key you add yourself, so you pick the provider and stay in control of the cost.'],
        ].map(([i, h, b]) => (
          <Card key={h} style={{ flexGrow: 1, flexBasis: 250, gap: 4 }}>
            <Text style={{ fontSize: 26 }}>{i}</Text>
            <T v="h3">{h}</T>
            <T muted v="small">{b}</T>
          </Card>
        ))}
      </View>

      <View style={{ gap: 12 }}>
        <T v="h2">📚 PDF how-to guides</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {GUIDES.slice(0, 4).map((g) => <LinkCard key={g.slug} to={`/guides/${g.slug}`} icon={byId(g.tool)?.icon || '📚'} title={g.title} body={g.description} />)}
        </View>
        <View style={{ alignSelf: 'flex-start' }}><Btn label="All guides" variant="ghost" small to="/guides" /></View>
      </View>

      <View style={{ gap: 10 }}>
        <T v="h2">Common questions</T>
        {HOME_FAQ.map((f) => (
          <Card key={f.q} style={{ gap: 4 }}>
            <T v="h3">{f.q}</T>
            <T muted>{f.a}</T>
          </Card>
        ))}
      </View>

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <Text style={{ fontSize: 30 }}>💛</Text>
        <View style={{ flex: 1, minWidth: 200 }}>
          <T v="h3">Free, and kept that way by people like you</T>
          <T muted v="small">iDuckPDF has no ads and no paywall. If it saved you time, a small tip helps keep it going.</T>
        </View>
        <Btn label="Support iDuckPDF" to="/donate" />
      </Card>
      <SiteFooter />
    </Screen>
  );
}
