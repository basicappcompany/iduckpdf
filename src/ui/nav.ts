import { useRouter } from 'expo-router';
import { useHref } from '../i18n/react';

/** onPress handler that navigates in-app, but lets ctrl/cmd/shift-click open a new tab via the <a href>. Keeps the page's language prefix. */
export function useNavPress() {
  const router = useRouter();
  const href = useHref();
  return (to: string, exact?: boolean) => (e?: any) => {
    if (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1)) return; // the browser handles it
    e?.preventDefault?.();
    router.push((exact ? to : href(to)) as any);
  };
}
