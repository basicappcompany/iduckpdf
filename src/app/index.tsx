import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../lib/theme';
import { usePalette } from '../lib/palette';
import { KEYS, getJSON } from '../lib/storage';
import { VISIBLE_CATEGORIES, READY, SOON, TOOLS, byId, inCategory, type CategoryId } from '../tools';
import { NEW_BADGE_COUNT, NEW_TOOL_IDS } from '../content/changelog';
import { Btn, Card, Chip, Hl, Screen, T, CardGrid } from '../ui/kit';
import { Logo } from '../ui/Logo';
import { ToolCard } from '../ui/ToolCard';
import { Seo } from '../lib/seo';
import { homeFaqFor, guideCardFor } from '../i18n/content';
import { useLang, useT } from '../i18n/react';
import { SiteFooter } from '../ui/SiteFooter';
import { LinkCard } from '../ui/LinkCard';
import { toolPath } from '../content/toolSlugs';
import { GUIDE_INDEX as GUIDES } from '../content/guideIndex';
import { SITE } from '../config';

const POPULAR = ['merge', 'split', 'compress', 'images-to-pdf', 'page-numbers', 'text-watermark', 'pdf-to-images', 'inspect'];

export default function Home() {
  const { t } = useTheme();
  const tr = useT();
  const lang = useLang();
  const { open } = usePalette();
  const [recent, setRecent] = useState<string[]>([]);
  const [cat, setCat] = useState<CategoryId | 'all'>('all');
  const fresh = new Set(NEW_TOOL_IDS.slice(0, NEW_BADGE_COUNT));
  const shown = TOOLS.filter((x) => x.status === 'ready' && (cat === 'all' || x.category === cat));
  const shownCat = VISIBLE_CATEGORIES.find((c) => c.id === cat);
  useEffect(() => setRecent(getJSON<string[]>(KEYS.recent, [])), []);

  return (
    <Screen>
      <Seo path="/" />
      <View style={{ alignItems: 'center', gap: 12, paddingTop: 10 }}>
        <Logo size={88} />
        <T v="h1" style={{ textAlign: 'center' }}>
          {tr('PDFs,')} <Hl>{tr('quacked')}</Hl> {tr('open.')}
        </T>
        <T muted style={{ textAlign: 'center', maxWidth: 560, fontSize: 17 }}>
          {tr('{n} free tools to join, cut, sign, convert, protect and tidy your PDFs. No sign-up, no watermark, and most of it runs right in your browser tab.', { n: READY.length })}
        </T>
        <Pressable
          onPress={open}
          accessibilityRole="button"
          style={((s: any) => [{ width: '100%', maxWidth: 620, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, borderColor: t.line, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 15, backgroundColor: t.card, marginTop: 6 }, t.shadow(4), s.hovered ? { transform: [{ translateX: -2 }, { translateY: -2 }] } : null]) as any}
        >
          <Text style={{ fontSize: 18 }}>🔍</Text>
          <Text style={{ flex: 1, color: t.muted, fontSize: 17 }}>{tr('What do you want to do with your PDF?')}</Text>
          <Text style={{ color: t.muted, fontSize: 12, fontWeight: '800', borderWidth: 1.5, borderColor: t.muted, borderRadius: 6, paddingHorizontal: 6 }}>Ctrl K</Text>
        </Pressable>
      </View>

      <Card hot style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <Text style={{ fontSize: 34 }}>💬</Text>
        <View style={{ flex: 1, minWidth: 200 }}>
          <T v="h3" level={2} color={t.duckInk}>{tr('Not sure which tool you need?')}</T>
          <T color={t.duckInk} style={{ opacity: 0.8 }}>{tr('Describe the job in plain words and the helper will point you to the right one.')}</T>
        </View>
        <Btn label={tr('Ask the helper')} variant="dark" to="/chat" />
      </Card>

      {recent.length ? (
        <View style={{ gap: 8 }}>
          <T v="h3">{tr('Pick up where you left off')}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {recent.map((id) => byId(id)).filter(Boolean).map((tl) => <Chip key={tl!.id} label={tr(tl!.name)} icon={tl!.icon} to={toolPath(tl!.id)} />)}
          </View>
        </View>
      ) : null}

      <View style={{ gap: 12 }}>
        <T v="h2">{tr('Popular right now')}</T>
        <CardGrid min={240} gap={14}>
          {POPULAR.map((id) => byId(id)).filter(Boolean).map((tl) => <ToolCard key={tl!.id} tool={tl!} />)}
        </CardGrid>
      </View>

      <View style={{ gap: 12 }} testID="all-tools">
        <View style={{ gap: 2 }}>
          <T v="h2">{tr('All {n} PDF tools', { n: READY.length })}</T>
          <T muted>{shownCat ? tr(shownCat.blurb) : tr('Pick a group to narrow the list, or press Ctrl K to search.')}</T>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label={tr('Everything ({n})', { n: READY.length })} on={cat === 'all'} onPress={() => setCat('all')} small />
          {VISIBLE_CATEGORIES.filter((c) => c.id !== 'soon').map((c) => (
            <Chip key={c.id} label={`${tr(c.name)} (${inCategory(c.id).length})`} icon={c.icon} on={cat === c.id} onPress={() => setCat(c.id)} small />
          ))}
        </View>
        <CardGrid min={250} gap={12}>
          {shown.map((tl) => <ToolCard key={tl.id} tool={tl} badge={fresh.has(tl.id) ? tr('new') : undefined} />)}
        </CardGrid>
      </View>

      <View style={{ gap: 12 }}>
        <T v="h2">✨ {tr('New and next')}</T>
        <T muted>{SOON.length ? tr('{n} more tools are planned. Tell us which ones you need first.', { n: SOON.length }) : tr('Recently added, all running in your browser. Tell us what to build next.')}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[...NEW_TOOL_IDS.map((id) => byId(id)).filter(Boolean), ...SOON].map((tl) => <Chip key={tl!.id} label={tr(tl!.name)} icon={tl!.icon} to={toolPath(tl!.id)} />)}
        </View>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <Btn label={tr('See what’s next')} variant="ghost" small to="/roadmap" />
          <Btn label={tr('Request a feature')} icon="💡" small to="/request" />
        </View>
      </View>

      <CardGrid min={250} gap={14}>
        {[
          ['🔐', tr('Your files stay with you'), tr('Most tools process PDFs inside your browser. When something does need an outside service (like the AI tools), we say so before you start.')],
          ['🎟️', tr('No account, no watermark'), tr('Open a tool, use it, download the result. That is the whole deal.')],
          ['🗝️', tr('Bring your own AI key'), tr('AI summaries and Q&A use a key you add yourself, so you pick the provider and stay in control of the cost.')],
        ].map(([i, h, b]) => (
          <Card key={h} style={{ gap: 4 }}>
            <Text style={{ fontSize: 26 }}>{i}</Text>
            <T v="h3">{h}</T>
            <T muted v="small">{b}</T>
          </Card>
        ))}
      </CardGrid>

      <View style={{ gap: 12 }}>
        <T v="h2">📚 {tr('PDF how-to guides')}</T>
        <CardGrid min={300} gap={14}>
          {GUIDES.slice(0, 4).map((g0) => { const g = guideCardFor(lang, g0); return <LinkCard key={g.slug} to={`/guides/${g.slug}`} icon={byId(g.tool)?.icon || '📚'} title={g.title} body={g.description} />; })}
        </CardGrid>
        <View style={{ alignSelf: 'flex-start' }}><Btn label={tr('All guides')} variant="ghost" small to="/guides/" /></View>
      </View>

      <View style={{ gap: 10 }}>
        <T v="h2">{tr('Common questions')}</T>
        {homeFaqFor(lang).map((f) => (
          <Card key={f.q} style={{ gap: 4 }}>
            <T v="h3">{f.q}</T>
            <T muted>{f.a}</T>
          </Card>
        ))}
      </View>

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <Text style={{ fontSize: 30 }}>💛</Text>
        <View style={{ flex: 1, minWidth: 200 }}>
          <T v="h3">{tr('Free, and kept that way by people like you')}</T>
          <T muted v="small">{tr('iDuckPDF has no ads and no paywall. If it saved you time, a small tip helps keep it going.')}</T>
        </View>
        <Btn label={tr('Support iDuckPDF')} to="/donate" />
      </Card>
      <SiteFooter />
    </Screen>
  );
}
