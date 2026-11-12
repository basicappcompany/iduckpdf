import React from 'react';
import { useHref } from '../i18n/react';

/**
 * Web: wraps children in a real <a href> so crawlers, "open in new tab" and screen readers see a link.
 * `display: contents` keeps it out of the layout. The child Pressable does the in-app navigation
 * (see useNavPress), because react-native-web's Pressable stops click events from bubbling.
 * The link keeps the page's language (/es/...). `exact` skips that, for links that name a language themselves (the language switcher).
 */
export function Anchor({ to, children, label, exact, lang }: { to: string; children: React.ReactNode; label?: string; exact?: boolean; lang?: string }) {
  const href = useHref();
  return (
    <a href={exact ? to : href(to)} aria-label={label} hrefLang={lang} lang={lang} tabIndex={-1} style={{ display: 'contents', textDecoration: 'none', color: 'inherit' }}>
      {children}
    </a>
  );
}
