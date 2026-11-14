import React from 'react';
import { View } from 'react-native';
import { Btn, Card, Chip, Screen, T } from './kit';
import { SiteFooter } from './SiteFooter';
import { Seo } from '../lib/seo';
import { useTheme } from '../lib/theme';
import { byId } from '../tools';
import { toolPath } from '../content/toolSlugs';
import { LANDINGS, type Landing } from '../content/landing';

function Faq({ q, a }: { q: string; a: string }) {
  const { t } = useTheme();
  return (
    <View style={{ borderWidth: 2, borderColor: t.line, borderRadius: 12, backgroundColor: t.card, padding: 12, gap: 4 }}>
      <T v="h3">{q}</T>
      <T muted>{a}</T>
    </View>
  );
}

/** Every landing page is plain text in the pre-rendered HTML: heading, direct answer, steps, facts, table, questions and related tools. */
export function LandingView({ landing: l }: { landing: Landing }) {
  const { t } = useTheme();
  const tool = l.tool ? byId(l.tool) : undefined;
  const related = l.related.map((id) => byId(id)).filter((x): x is NonNullable<ReturnType<typeof byId>> => !!x).slice(0, 3);
  return (
    <Screen narrow>
      <Seo path={`/${l.slug}`} />
      <T v="small" muted>{l.kind === 'compare' ? 'Comparison' : l.kind === 'info' ? 'About the site' : 'Guide and tool'}</T>
      <T v="h1">{l.h1}</T>
      <Card hot>
        <T color="#17160f" style={{ fontWeight: '700' }}>{l.answer}</T>
      </Card>
      {tool ? (
        <View style={{ alignSelf: 'flex-start' }}>
          <Btn label={`Open ${l.h1}`} icon={tool.icon} to={toolPath(tool.id) + (l.preset ? '?' + new URLSearchParams(l.preset).toString() : '')} />
        </View>
      ) : null}
      {l.steps?.length ? (
        <View style={{ gap: 8 }}>
          <T v="h2">How to do it</T>
          {l.steps.map((s, i) => <T key={i}>{i + 1}. {s}</T>)}
        </View>
      ) : null}
      {l.sections.map((s) => (
        <View key={s.h} style={{ gap: 8 }}>
          <T v="h2">{s.h}</T>
          {s.p.map((p, i) => <T key={i}>{p}</T>)}
        </View>
      ))}
      {l.table ? (
        <View style={{ gap: 8 }}>
          <T v="h2">{l.table.caption}</T>
          {/* @ts-ignore react-native-web renders a real table here so crawlers and screen readers see rows and columns */}
          <View style={{ overflow: 'scroll' as any }}>
            {React.createElement(
              'table',
              { style: { borderCollapse: 'collapse', width: '100%', fontSize: 14, color: t.ink } },
              React.createElement('thead', null, React.createElement('tr', null, l.table.head.map((h) => React.createElement('th', { key: h, scope: 'col', style: { textAlign: 'left', padding: 8, borderBottom: `2px solid ${t.line}` } }, h)))),
              React.createElement('tbody', null, l.table.rows.map((r, i) => React.createElement('tr', { key: i }, r.map((c, j) => React.createElement(j === 0 ? 'th' : 'td', { key: j, scope: j === 0 ? 'row' : undefined, style: { textAlign: 'left', padding: 8, borderBottom: `1px solid ${t.line}`, verticalAlign: 'top', fontWeight: j === 0 ? 700 : 400 } }, c))))),
            )}
          </View>
          {l.table.note ? <T v="small" muted>{l.table.note}</T> : null}
        </View>
      ) : null}
      <View style={{ gap: 10 }}>
        <T v="h2">Frequently asked questions</T>
        {l.faq.map((f) => <Faq key={f.q} q={f.q} a={f.a} />)}
      </View>
      {l.sources?.length ? (
        <View style={{ gap: 4 }}>
          <T v="h3">Sources</T>
          {l.sources.map((s) => (
            <T key={s.url} v="small" muted>
              {React.createElement('a', { href: s.url, rel: 'noopener nofollow', target: '_blank', style: { color: 'inherit' } }, s.label)}
            </T>
          ))}
        </View>
      ) : null}
      <View style={{ gap: 8 }}>
        <T v="h3">Related tools</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {related.map((x) => <Chip key={x.id} label={x.name} icon={x.icon} to={toolPath(x.id)} />)}
          {(l.kind === 'compare' || l.kind === 'info' ? LANDINGS.filter((x) => x.kind === 'compare' && x.slug !== l.slug) : []).map((x) => <Chip key={x.slug} label={x.h1} to={`/${x.slug}`} />)}
          <Chip label="All PDF tools" to="/pdf-tools" />
        </View>
      </View>
      <T v="small" muted>Last reviewed {l.reviewed}.</T>
      <SiteFooter />
    </Screen>
  );
}
