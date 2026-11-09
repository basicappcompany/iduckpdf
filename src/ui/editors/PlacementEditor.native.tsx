import React from 'react';
import type { PickedFile, Placement } from '../../engine/types';
import { T } from '../kit';

// The mobile apps are future scope; this keeps the native bundle compiling.
export function PlacementEditor(_: { label: string; hint?: string; file?: PickedFile; signature: string; value: Placement; onChange: (v: Placement) => void }) {
  return <T muted>Placing a signature is available on the website for now.</T>;
}
