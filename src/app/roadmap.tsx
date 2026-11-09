import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../lib/theme';
import { VISIBLE_CATEGORIES, READY, SOON, byId, inCategory } from '../tools';
import { NEW_TOOL_IDS } from '../content/changelog';
import { toolPath } from '../content/toolSlugs';
import { Btn, Card, Chip, Hl, Screen, T } from '../ui/kit';
import { Seo } from '../lib/seo';
import { SiteFooter } from '../ui/SiteFooter';

// Ideas, not promises. Everything announced earlier is built.
const IDEAS = [
  { title: 'More OCR languages', blurb: 'Arabic, Hindi, Chinese, Japanese and other scripts need larger fonts to write the invisible text layer.' },
  { title: 'Closer Word, Excel and PowerPoint conversions', blurb: 'Headers and footers, text boxes, charts and exact fonts are not reproduced yet.' },
  { title: 'Android and iPhone apps', blurb: 'The site is built with React Native (via Expo), so the same code can become apps. Tools that draw pages need extra mobile work first.' },
];

export default function Roadmap() {
  const { t } = useTheme();
  const added = NEW_TOOL_IDS.map((id) => byId(id)).filter(Boolean);
  return (
    <Screen narrow>
      <Seo path="/roadmap" />
      <T v="h1">
        What’s <Hl>next</Hl>
      </T>
      <T muted>
        {SOON.length ? 'An honest list of what exists, and what is coming.' : 'Every PDF tool we announced is built. Here is what is live, what was added recently, and what we are thinking about next.'} Tell us what matters most and we will build that first.
      </T>

      <Card hot>
        <T v="h3" color={t.duckInk}>Already live: {READY.length} tools</T>
        <T color={t.duckInk} style={{ marginTop: 4 }}>
          {VISIBLE_CATEGORIES.map((c) => `${c.name} (${inCategory(c.id).length})`).join(' · ')}
        </T>
      </Card>

      <View style={{ gap: 10 }}>
        <T v="h2">Recently added</T>
        <T muted>All of these run in your browser, so your files are not uploaded.</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {added.map((tl) => <Chip key={tl!.id} label={tl!.name} icon={tl!.icon} to={toolPath(tl!.id)} />)}
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <T v="h2">Ideas on our list</T>
        <T muted>Nothing here is promised. Requests decide what moves up.</T>
        {IDEAS.map((i) => (
          <Card key={i.title} style={{ gap: 4 }}>
            <T v="h3">{i.title}</T>
            <T v="small" muted>{i.blurb}</T>
          </Card>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <Btn label="Request a feature" icon="💡" to="/request" />
        <Btn label="Send feedback" variant="ghost" to="/feedback" />
      </View>
      <SiteFooter />
    </Screen>
  );
}
