import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { CATEGORIES, TOOLS, inCategory, searchTools, type CategoryId } from '../tools';
import { Chip, Hl, Screen, T, TextField } from '../ui/kit';
import { ToolCard } from '../ui/ToolCard';
import { Seo } from '../lib/seo';
import { SiteFooter } from '../ui/SiteFooter';
import { useLocalSearchParams } from 'expo-router';

export default function AllTools() {
  const params = useLocalSearchParams<{ q?: string }>();
  const [q, setQ] = useState(typeof params.q === 'string' ? params.q : '');
  const [cat, setCat] = useState<CategoryId | 'all'>('all');
  const found = useMemo(() => (q.trim() ? searchTools(q, 60) : TOOLS), [q]);
  const cats = CATEGORIES.filter((c) => cat === 'all' || c.id === cat);

  return (
    <Screen>
      <Seo path="/tools" />
      <T v="h1">
        All <Hl>tools</Hl>
      </T>
      <T muted>{TOOLS.filter((t) => t.status === 'ready').length} ready to use, {TOOLS.filter((t) => t.status === 'soon').length} on the roadmap.</T>
      <TextField value={q} onChange={setQ} placeholder="Filter by name or what you want to do…" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Chip label="Everything" on={cat === 'all'} onPress={() => setCat('all')} small />
        {CATEGORIES.map((c) => <Chip key={c.id} label={c.name} icon={c.icon} on={cat === c.id} onPress={() => setCat(c.id)} small />)}
      </View>
      {q.trim() ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {found.filter((t) => cat === 'all' || t.category === cat).map((t) => <ToolCard key={t.id} tool={t} />)}
          {!found.length ? <T muted>No tool matches “{q}”. Try the helper, or request it.</T> : null}
        </View>
      ) : (
        cats.map((c) => (
          <View key={c.id} style={{ gap: 12 }}>
            <View>
              <T v="h2">{c.icon} {c.name}</T>
              <T muted>{c.blurb}</T>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
              {inCategory(c.id).map((t) => <ToolCard key={t.id} tool={t} />)}
            </View>
          </View>
        ))
      )}
      <SiteFooter />
    </Screen>
  );
}
