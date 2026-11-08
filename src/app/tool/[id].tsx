import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { TOOLS, byId } from '../../tools';
import { ToolView } from '../../ui/ToolView';
import { Btn, Screen, T } from '../../ui/kit';
import { Seo } from '../../lib/seo';

// Pre-render one HTML page per tool at build time.
export function generateStaticParams() {
  return TOOLS.map((t) => ({ id: t.id }));
}

export default function ToolPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tool = byId(String(id));
  if (!tool) {
    return (
      <Screen narrow>
        <Seo path="/tool/unknown" />
        <T v="h1">We could not find that tool</T>
        <T muted>It may have been renamed. Browse everything, or ask the helper.</T>
        <Btn label="Browse all tools" to="/tools" />
      </Screen>
    );
  }
  return (
    <>
      <Seo path={`/tool/${tool.id}`} />
      <ToolView key={tool.id} tool={tool} />
    </>
  );
}
