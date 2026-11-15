import { Btn, Screen, T } from '../ui/kit';
import { Seo } from '../lib/seo';
import { useT } from '../i18n/react';

export default function NotFound() {
  const tr = useT();
  return (
    <Screen narrow>
      <Seo path="/404" />
      <T v="h1">🦆 {tr('Wrong pond')}</T>
      <T muted>{tr('That page does not exist. Let’s get you back to the tools.')}</T>
      <Btn label={tr('Back home')} to="/" />
    </Screen>
  );
}
