import React from 'react';

// On native there are no anchors; navigation happens in the Pressable's onPress.
export function Anchor({ children }: { to: string; children: React.ReactNode; label?: string; exact?: boolean; lang?: string }) {
  return <>{children}</>;
}
