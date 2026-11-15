import { GUIDE_INDEX as GUIDES } from '../../content/guideIndex';
import { byId } from '../../tools';
import { Hl, Screen, T, CardGrid } from '../../ui/kit';
import { LinkCard } from '../../ui/LinkCard';
import { SiteFooter } from '../../ui/SiteFooter';
import { Seo } from '../../lib/seo';
import { useLang, useT } from '../../i18n/react';
import { guideCardFor } from '../../i18n/content';

export default function Guides() {
  const tr = useT();
  const lang = useLang();
  return (
    <Screen>
      <Seo path="/guides" />
      <T v="h1">
        {tr('PDF')} <Hl>{tr('how-to')}</Hl> {tr('guides')}
      </T>
      <T muted style={{ fontSize: 17 }}>
        {tr('Short, practical walkthroughs for the PDF jobs people search for most. Each one links to the free tool that does the work.')}
      </T>
      <CardGrid min={300} gap={14}>
        {GUIDES.map((g0) => { const g = guideCardFor(lang, g0); return (
          <LinkCard key={g.slug} to={`/guides/${g.slug}`} icon={byId(g.tool)?.icon || '📚'} title={g.title} body={g.description} />
        ); })}
      </CardGrid>
      <SiteFooter />
    </Screen>
  );
}
