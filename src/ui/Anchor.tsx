import React from 'react';

/**
 * Web: wraps children in a real <a href> so crawlers, "open in new tab" and screen readers see a link.
 * `display: contents` keeps it out of the layout. The child Pressable does the in-app navigation
 * (see useNavPress), because react-native-web's Pressable stops click events from bubbling.
 */
export function Anchor({ to, children, label }: { to: string; children: React.ReactNode; label?: string }) {
  return (
    <a href={to} aria-label={label} tabIndex={-1} style={{ display: 'contents', textDecoration: 'none', color: 'inherit' }}>
      {children}
    </a>
  );
}
