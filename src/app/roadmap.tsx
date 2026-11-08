import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../lib/theme';
import { CATEGORIES, READY, SOON, inCategory } from '../tools';
import { Btn, Card, Hl, Pill, Screen, T } from '../ui/kit';
import { Seo } from '../lib/seo';
import { SiteFooter } from '../ui/SiteFooter';

const PHASES = [
  { phase: 2, title: 'Next: heavier in-browser engines', blurb: 'Still on your device, but they need bigger libraries such as WebAssembly encryption and OCR.' },
  { phase: 3, title: 'Later: conversions that need a server', blurb: 'Accurate Office conversions do not run well in a browser. If we build these, we will say clearly whenever a file is sent off your device.' },
];

export default function Roadmap() {
  const { t } = useTheme();
  return (
    <Screen narrow>
      <Seo path="/roadmap" />
      <T v="h1">
        What’s <Hl>next</Hl>
      </T>
      <T muted>An honest list of what exists, and what is coming. Tell us what matters most and we will build that first.</T>

      <Card hot>
        <T v="h3" color={t.duckInk}>Already live: {READY.length} tools</T>
        <T color={t.duckInk} style={{ marginTop: 4 }}>
          {CATEGORIES.filter((c) => c.id !== 'soon').map((c) => `${c.name} (${inCategory(c.id).length})`).join(' · ')}
        </T>
      </Card>

      {PHASES.map((p) => (
        <View key={p.phase} style={{ gap: 10 }}>
          <View>
            <T v="h2">{p.title}</T>
            <T muted>{p.blurb}</T>
          </View>
          {SOON.filter((s) => s.phase === p.phase).map((s) => (
            <Card key={s.id} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ fontSize: 26 }}>{s.icon}</Text>
                <T v="h3" style={{ flex: 1 }}>{s.name}</T>
                <Pill>phase {s.phase}</Pill>
              </View>
              <T v="small" muted>{s.short}</T>
              <T v="small">{s.reason}</T>
              <View style={{ alignSelf: 'flex-start', marginTop: 4 }}>
                <Btn label="I need this" icon="🙋" small to={`/request?tool=${s.id}`} />
              </View>
            </Card>
          ))}
        </View>
      ))}

      <View style={{ gap: 10 }}>
        <T v="h2">Later: mobile apps</T>
        <Card>
          <T>
            The site is built with React Native (via Expo), so the same code can become Android and iPhone apps. That is planned for after the website matures. A few tools (anything that draws pages) will need extra mobile work first.
          </T>
        </Card>
      </View>

      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <Btn label="Request a feature" icon="💡" to="/request" />
        <Btn label="Send feedback" variant="ghost" to="/feedback" />
      </View>
      <SiteFooter />
    </Screen>
  );
}
