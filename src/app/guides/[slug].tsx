import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { GUIDES, guideBySlug } from '../../content/guides';
import { byId } from '../../tools';
import { Btn, Card, Chip, Screen, T } from '../../ui/kit';
import { SiteFooter } from '../../ui/SiteFooter';
import { Seo } from '../../lib/seo';
import { SITE } from '../../config';

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export default function GuidePage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const g = guideBySlug(String(slug));
  if (!g) {
    return (
      <Screen narrow>
        <Seo path="/guides/not-found" />
        <T v="h1">We could not find that guide</T>
        <Btn label="All guides" to="/guides" />
      </Screen>
    );
  }
  const tool = byId(g.tool);
  const path = `/guides/${g.slug}`;
  return (
    <Screen narrow>
      <Seo path={path} />
      <T v="small" muted>Guide · updated {SITE.updated}</T>
      <T v="h1">{g.title}</T>
      <Card hot>
        <T color="#17160f" style={{ fontWeight: '700' }}>{g.intro}</T>
      </Card>
      {tool ? (
        <View style={{ alignSelf: 'flex-start' }}>
          <Btn label={`Open ${tool.name}`} icon={tool.icon} to={`/tool/${tool.id}`} />
        </View>
      ) : null}
      {g.sections.map((s) => (
        <View key={s.h} style={{ gap: 8 }}>
          <T v="h2">{s.h}</T>
          {s.p.map((p, i) => <T key={i}>{p}</T>)}
        </View>
      ))}
      <View style={{ gap: 10 }}>
        <T v="h2">Questions</T>
        {g.faq.map((f) => (
          <View key={f.q} style={{ gap: 4 }}>
            <T v="h3">{f.q}</T>
            <T muted>{f.a}</T>
          </View>
        ))}
      </View>
      <View style={{ gap: 8 }}>
        <T v="h3">Related tools</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {g.related.map((id) => byId(id)).filter(Boolean).map((x) => <Chip key={x!.id} label={x!.name} icon={x!.icon} to={`/tool/${x!.id}`} />)}
          <Chip label="All guides" to="/guides" />
        </View>
      </View>
      <SiteFooter />
    </Screen>
  );
}
