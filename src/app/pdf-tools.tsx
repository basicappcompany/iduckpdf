import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { VISIBLE_CATEGORIES, TOOLS, inCategory, searchTools, type CategoryId } from '../tools';
import { Chip, Hl, Screen, T, TextField, CardGrid } from '../ui/kit';
import { ToolCard } from '../ui/ToolCard';
import { Seo } from '../lib/seo';
import { SiteFooter } from '../ui/SiteFooter';
import { useLocalSearchParams } from 'expo-router';
import { useLang, useT } from '../i18n/react';

export default function AllTools() {
  const tr = useT();
  const lang = useLang();
  const params = useLocalSearchParams<{ q?: string }>();
  const [q, setQ] = useState(typeof params.q === 'string' ? params.q : '');
  const [cat, setCat] = useState<CategoryId | 'all'>('all');
  const found = useMemo(() => (q.trim() ? searchTools(q, 60, lang) : TOOLS), [q, lang]);
  const cats = VISIBLE_CATEGORIES.filter((c) => cat === 'all' || c.id === cat);

  return (
    <Screen>
      <Seo path="/pdf-tools" />
      <T v="h1">
        {tr('All')} <Hl>{tr('PDF tools')}</Hl>
      </T>
      <T muted>{TOOLS.filter((t) => t.status === 'soon').length ? tr('{ready} ready to use, {soon} on the roadmap.', { ready: TOOLS.filter((t) => t.status === 'ready').length, soon: TOOLS.filter((t) => t.status === 'soon').length }) : tr('{n} tools, all ready to use.', { n: TOOLS.length })}</T>
      <TextField value={q} onChange={setQ} placeholder={tr('Filter by name or what you want to do…')} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Chip label={tr('Everything')} on={cat === 'all'} onPress={() => setCat('all')} small />
        {VISIBLE_CATEGORIES.map((c) => <Chip key={c.id} label={tr(c.name)} icon={c.icon} on={cat === c.id} onPress={() => setCat(c.id)} small />)}
      </View>
      {q.trim() ? (
        <CardGrid min={240} gap={14}>
          {found.filter((t) => cat === 'all' || t.category === cat).map((t) => <ToolCard key={t.id} tool={t} />)}
          {!found.length ? <T muted>{tr('No tool matches “{q}”. Try the helper, or request it.', { q })}</T> : null}
        </CardGrid>
      ) : (
        cats.map((c) => (
          <View key={c.id} style={{ gap: 12 }}>
            <View>
              <T v="h2">{c.icon} {tr(c.name)}</T>
              <T muted>{tr(c.blurb)}</T>
            </View>
            <CardGrid min={240} gap={14}>
              {inCategory(c.id).map((t) => <ToolCard key={t.id} tool={t} />)}
            </CardGrid>
          </View>
        ))
      )}
      <SiteFooter />
    </Screen>
  );
}
