import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../lib/theme';
import { VISIBLE_CATEGORIES, READY, SOON, byId, inCategory } from '../tools';
import { NEW_TOOL_IDS } from '../content/changelog';
import { toolPath } from '../content/toolSlugs';
import { Btn, Card, Chip, Hl, Screen, T } from '../ui/kit';
import { Seo } from '../lib/seo';
import { SiteFooter } from '../ui/SiteFooter';
import { useT } from '../i18n/react';

// Ideas, not promises. Everything announced earlier is built.

export default function Roadmap() {
  const { t } = useTheme();
  const tr = useT();
  const IDEAS = [
    { title: tr('More OCR languages'), blurb: tr('Arabic, Hindi, Chinese, Japanese and other scripts need larger fonts to write the invisible text layer.') },
    { title: tr('Closer Word, Excel and PowerPoint conversions'), blurb: tr('Headers and footers, text boxes, charts and exact fonts are not reproduced yet.') },
    { title: tr('PDF to Markdown and a word counter'), blurb: tr('Turn a PDF into clean Markdown text for notes and AI tools, and count its words, characters and reading time. Both can run in your browser.') },
    { title: tr('Bates numbering'), blurb: tr('Stamp every page with a running prefix and number (for example CASE-000123), the way legal and audit teams label documents.') },
    { title: tr('Split a PDF by file size'), blurb: tr('Cut a long PDF into parts that each stay under a size limit, such as 5 MB for an email or an upload form.') },
    { title: tr('Android and iPhone apps'), blurb: tr('The site is built with React Native (via Expo), so the same code can become apps. Tools that draw pages need extra mobile work first.') },
  ];
  const added = NEW_TOOL_IDS.map((id) => byId(id)).filter(Boolean);
  return (
    <Screen narrow>
      <Seo path="/roadmap" />
      <T v="h1">
        {tr('What’s')} <Hl>{tr('next')}</Hl>
      </T>
      <T muted>
        {SOON.length ? tr('An honest list of what exists, and what is coming.') : tr('Every PDF tool we announced is built. Here is what is live, what was added recently, and what we are thinking about next.')} {tr('Tell us what matters most and we will build that first.')}
      </T>

      <Card hot>
        <T v="h3" color={t.duckInk}>{tr('Already live: {n} tools', { n: READY.length })}</T>
        <T color={t.duckInk} style={{ marginTop: 4 }}>
          {VISIBLE_CATEGORIES.map((c) => `${tr(c.name)} (${inCategory(c.id).length})`).join(' · ')}
        </T>
      </Card>

      <View style={{ gap: 10 }}>
        <T v="h2">{tr('Recently added')}</T>
        <T muted>{tr('All of these run in your browser, so your files are not uploaded.')}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {added.map((tl) => <Chip key={tl!.id} label={tr(tl!.name)} icon={tl!.icon} to={toolPath(tl!.id)} />)}
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <T v="h2">{tr('Ideas on our list')}</T>
        <T muted>{tr('Nothing here is promised. Requests decide what moves up.')}</T>
        {IDEAS.map((i) => (
          <Card key={i.title} style={{ gap: 4 }}>
            <T v="h3">{i.title}</T>
            <T v="small" muted>{i.blurb}</T>
          </Card>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <Btn label={tr('Request a feature')} icon="💡" to="/request" />
        <Btn label={tr('Send feedback')} variant="ghost" to="/feedback" />
      </View>
      <SiteFooter />
    </Screen>
  );
}
