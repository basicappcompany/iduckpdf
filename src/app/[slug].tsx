import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { TOOLS, byId } from '../tools';
import { TOOL_SLUGS, HUB_PATH, idForSlug, toolPath } from '../content/toolSlugs';
import { ToolView } from '../ui/ToolView';
import { Btn, Screen, T } from '../ui/kit';
import { Seo } from '../lib/seo';
import { useT } from '../i18n/react';

// Pre-render one HTML page per tool at build time, at /<keyword>-pdf (see content/toolSlugs.ts).
export function generateStaticParams() {
  return TOOLS.map((t) => ({ slug: TOOL_SLUGS[t.id] }));
}

export default function ToolPage() {
  const tr = useT();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const id = idForSlug(String(slug));
  const tool = id ? byId(id) : undefined;
  if (!tool) {
    return (
      <Screen narrow>
        <Seo path="/tool-not-found" />
        <T v="h1">{tr('We could not find that page')}</T>
        <T muted>{tr('It may have been renamed. Browse every PDF tool, or ask the helper.')}</T>
        <Btn label={tr('Browse all PDF tools')} to={HUB_PATH} />
      </Screen>
    );
  }
  return (
    <>
      <Seo path={toolPath(tool.id)} />
      <ToolView key={tool.id} tool={tool} />
    </>
  );
}
