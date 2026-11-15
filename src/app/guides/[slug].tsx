import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { GUIDES } from '../../content/guides';
import { guideFor } from '../../i18n/guideContent';
import { useLang, useT } from '../../i18n/react';
import { byId } from '../../tools';
import { toolPath } from '../../content/toolSlugs';
import { Btn, Card, Chip, Screen, T } from '../../ui/kit';
import { SiteFooter } from '../../ui/SiteFooter';
import { Seo } from '../../lib/seo';
import { SITE } from '../../config';

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export default function GuidePage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const tr = useT();
  const lang = useLang();
  const g = guideFor(lang, String(slug));
  if (!g) {
    return (
      <Screen narrow>
        <Seo path="/guides/not-found" />
        <T v="h1">{tr('We could not find that guide')}</T>
        <Btn label={tr('All guides')} to="/guides/" />
      </Screen>
    );
  }
  const tool = byId(g.tool);
  const path = `/guides/${g.slug}`;
  return (
    <Screen narrow>
      <Seo path={path} />
      <T v="small" muted>{tr('Guide · updated {date}', { date: SITE.updated })}</T>
      <T v="h1">{g.title}</T>
      <Card hot>
        <T color="#17160f" style={{ fontWeight: '700' }}>{g.intro}</T>
      </Card>
      {tool ? (
        <View style={{ alignSelf: 'flex-start' }}>
          <Btn label={tr('Open {name}', { name: tr(tool.name) })} icon={tool.icon} to={toolPath(tool.id)} />
        </View>
      ) : null}
      {g.sections.map((s) => (
        <View key={s.h} style={{ gap: 8 }}>
          <T v="h2">{s.h}</T>
          {s.p.map((p, i) => <T key={i}>{p}</T>)}
        </View>
      ))}
      <View style={{ gap: 10 }}>
        <T v="h2">{tr('Questions')}</T>
        {g.faq.map((f) => (
          <View key={f.q} style={{ gap: 4 }}>
            <T v="h3">{f.q}</T>
            <T muted>{f.a}</T>
          </View>
        ))}
      </View>
      <View style={{ gap: 8 }}>
        <T v="h3">{tr('Related tools')}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {g.related.map((id) => byId(id)).filter(Boolean).map((x) => <Chip key={x!.id} label={tr(x!.name)} icon={x!.icon} to={toolPath(x!.id)} />)}
          <Chip label={tr('All guides')} to="/guides/" />
        </View>
      </View>
      <SiteFooter />
    </Screen>
  );
}
