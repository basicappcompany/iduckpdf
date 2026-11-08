import { useRouter } from 'expo-router';

/** onPress handler that navigates in-app, but lets ctrl/cmd/shift-click open a new tab via the <a href>. */
export function useNavPress() {
  const router = useRouter();
  return (to: string) => (e?: any) => {
    if (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1)) return; // the browser handles it
    e?.preventDefault?.();
    router.push(to as any);
  };
}
