import React from 'react';
import { View } from 'react-native';
import { GUIDES } from '../../content/guides';
import { byId } from '../../tools';
import { Hl, Screen, T } from '../../ui/kit';
import { LinkCard } from '../../ui/LinkCard';
import { SiteFooter } from '../../ui/SiteFooter';
import { Seo } from '../../lib/seo';

export default function Guides() {
  return (
    <Screen>
      <Seo path="/guides" />
      <T v="h1">
        PDF <Hl>how-to</Hl> guides
      </T>
      <T muted style={{ fontSize: 17 }}>
        Short, practical walkthroughs for the PDF jobs people search for most. Each one links to the free tool that does the work.
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        {GUIDES.map((g) => (
          <LinkCard key={g.slug} to={`/guides/${g.slug}`} icon={byId(g.tool)?.icon || '📚'} title={g.title} body={g.description} />
        ))}
      </View>
      <SiteFooter />
    </Screen>
  );
}
