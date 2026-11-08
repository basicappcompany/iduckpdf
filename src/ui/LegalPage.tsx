import React from 'react';
import { View } from 'react-native';
import type { LegalDoc } from '../content/legal';
import { SITE } from '../config';
import { Btn, Card, Screen, T } from './kit';
import { Seo } from '../lib/seo';
import { SiteFooter } from './SiteFooter';

export function LegalPage({ path, doc }: { path: string; doc: LegalDoc }) {
  return (
    <Screen narrow>
      <Seo path={path} />
      <T v="small" muted>Last updated {SITE.legalUpdated}</T>
      <T v="h1">{doc.title}</T>
      <Card hot>
        <T color="#17160f" style={{ fontWeight: '700' }}>{doc.intro}</T>
      </Card>
      {doc.sections.map((s) => (
        <View key={s.h} style={{ gap: 8 }}>
          <T v="h2">{s.h}</T>
          {s.p.map((p, i) => <T key={i}>{p}</T>)}
        </View>
      ))}
      <Card style={{ gap: 6 }}>
        <T v="h3">Contact</T>
        <T muted>
          <a href={`mailto:${SITE.feedbackEmail}`} style={{ color: 'inherit', fontWeight: 700 }}>{SITE.feedbackEmail}</a>
        </T>
      </Card>
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <Btn label="Privacy policy" variant="ghost" small to="/privacy" />
        <Btn label="Terms of use" variant="ghost" small to="/terms" />
        <Btn label="About" variant="ghost" small to="/about" />
      </View>
      <SiteFooter />
    </Screen>
  );
}
