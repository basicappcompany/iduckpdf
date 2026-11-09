import React from 'react';
import { T } from '../kit';

// The mobile apps are future scope; this keeps the native bundle compiling.
export function SignaturePad(_: { label: string; hint?: string; value: string; onChange: (v: string) => void }) {
  return <T muted>Signing is available on the website for now.</T>;
}
