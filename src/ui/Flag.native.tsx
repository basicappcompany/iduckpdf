import { Text } from 'react-native';

/** Phones draw flag emoji natively, so the app uses them. (Flag.tsx draws SVG flags for the web, where Windows has no flag emoji.) */
export function Flag({ code, width = 22 }: { code: string; width?: number }) {
  const emoji = code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
  return <Text style={{ fontSize: width * 0.8 }}>{emoji}</Text>;
}
