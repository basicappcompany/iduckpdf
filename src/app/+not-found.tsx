import React from 'react';
import { Btn, Screen, T } from '../ui/kit';
import { Seo } from '../lib/seo';

export default function NotFound() {
  return (
    <Screen narrow>
      <Seo path="/404" />
      <T v="h1">🦆 Wrong pond</T>
      <T muted>That page does not exist. Let’s get you back to the tools.</T>
      <Btn label="Back home" to="/" />
    </Screen>
  );
}
