import { useTheme } from '../lib/theme';

// Web: inline SVG duck. (Logo.native.tsx falls back to an emoji until react-native-svg is added.)
export function Logo({ size = 34 }: { size?: number }) {
  const { t } = useTheme();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <g stroke={t.ink} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round">
        <path d="M8 40c0-8 6-12 14-12h6c-2-12 4-20 14-20s14 8 10 16l8 4-8 4c0 12-10 22-24 22-12 0-20-4-20-14z" fill="#ffd23f" />
        <path d="M44 24l11 4-11 4z" fill="#ff8a1f" />
        <path d="M18 40c4 6 14 6 18-2" fill="none" />
      </g>
      <circle cx="43" cy="19" r="2.6" fill="#000" />
    </svg>
  );
}
