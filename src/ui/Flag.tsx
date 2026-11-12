import React from 'react';

/**
 * Small country flags for the language menu, drawn as inline SVG (simplified, 3:2). Flag emoji do not render on Windows (they show
 * as two letters), so the menu draws its own. Web only: Flag.native.tsx uses the emoji, which phones render.
 */
const star = (cx: number, cy: number, R: number, r: number) =>
  Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 ? r : R;
    return `${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`;
  }).join(' ');

const FLAGS: Record<string, React.ReactNode> = {
  us: (
    <>
      <rect width="30" height="20" fill="#fff" />
      {[0, 2, 4, 6, 8, 10, 12].map((i) => (
        <rect key={i} y={(i * 20) / 13} width="30" height={20 / 13} fill="#b22234" />
      ))}
      <rect width="13" height="10.77" fill="#3c3b6e" />
      {[0, 1, 2].flatMap((r) => [0, 1, 2, 3].map((c) => <circle key={`${r}${c}`} cx={2.2 + c * 3.1 + (r % 2) * 1.5} cy={2 + r * 3.2} r="0.6" fill="#fff" />))}
    </>
  ),
  gb: (
    <>
      <rect width="30" height="20" fill="#012169" />
      <path d="M0 0L30 20M30 0L0 20" stroke="#fff" strokeWidth="4" />
      <path d="M0 0L30 20M30 0L0 20" stroke="#c8102e" strokeWidth="1.8" />
      <path d="M15 0V20M0 10H30" stroke="#fff" strokeWidth="6" />
      <path d="M15 0V20M0 10H30" stroke="#c8102e" strokeWidth="3.4" />
    </>
  ),
  bd: (
    <>
      <rect width="30" height="20" fill="#006a4e" />
      <circle cx="13.5" cy="10" r="6" fill="#f42a41" />
    </>
  ),
  de: (
    <>
      <rect width="30" height="20" fill="#000" />
      <rect y="6.67" width="30" height="13.33" fill="#dd0000" />
      <rect y="13.33" width="30" height="6.67" fill="#ffce00" />
    </>
  ),
  es: (
    <>
      <rect width="30" height="20" fill="#aa151b" />
      <rect y="5" width="30" height="10" fill="#f1bf00" />
    </>
  ),
  fr: (
    <>
      <rect width="30" height="20" fill="#fff" />
      <rect width="10" height="20" fill="#0055a4" />
      <rect x="20" width="10" height="20" fill="#ef4135" />
    </>
  ),
  in: (
    <>
      <rect width="30" height="20" fill="#fff" />
      <rect width="30" height="6.67" fill="#ff9933" />
      <rect y="13.33" width="30" height="6.67" fill="#138808" />
      <circle cx="15" cy="10" r="2.4" fill="none" stroke="#000080" strokeWidth="0.8" />
    </>
  ),
  id: (
    <>
      <rect width="30" height="20" fill="#fff" />
      <rect width="30" height="10" fill="#e70011" />
    </>
  ),
  br: (
    <>
      <rect width="30" height="20" fill="#009c3b" />
      <polygon points="15,2 27.5,10 15,18 2.5,10" fill="#ffdf00" />
      <circle cx="15" cy="10" r="4.2" fill="#002776" />
    </>
  ),
  ru: (
    <>
      <rect width="30" height="20" fill="#fff" />
      <rect y="6.67" width="30" height="6.67" fill="#0039a6" />
      <rect y="13.33" width="30" height="6.67" fill="#d52b1e" />
    </>
  ),
  tr: (
    <>
      <rect width="30" height="20" fill="#e30a17" />
      <circle cx="11" cy="10" r="5" fill="#fff" />
      <circle cx="12.4" cy="10" r="4" fill="#e30a17" />
      <polygon points={star(17.2, 10, 2.4, 1)} fill="#fff" />
    </>
  ),
};

export function Flag({ code, width = 22 }: { code: string; width?: number }) {
  const body = FLAGS[code];
  if (!body) return null;
  const id = `flag-${code}`;
  return (
    <svg width={width} height={(width * 2) / 3} viewBox="0 0 30 20" aria-hidden="true" style={{ flexShrink: 0, display: 'block' }}>
      <defs>
        <clipPath id={id}>
          <rect width="30" height="20" rx="3" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>{body}</g>
      <rect x="0.5" y="0.5" width="29" height="19" rx="2.6" fill="none" stroke="rgba(0,0,0,0.3)" />
    </svg>
  );
}
