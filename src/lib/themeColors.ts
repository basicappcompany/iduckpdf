/**
 * Theme colours, plain data (no React) so the build scripts can use them too.
 *
 * On the web every colour token is a CSS variable (var(--d-bg), ...). The variables are defined in a <style> block in every page's
 * <head> and switched by the system setting (prefers-color-scheme) or by the saved choice, which a tiny inline script copies from
 * localStorage onto <html data-theme> before anything is painted. So a dark-mode visitor never sees the light pre-rendered page
 * first, and the JavaScript side does not need to know the theme to render the right colours.
 */
export const light = {
  bg: '#fffdf5',
  card: '#ffffff',
  ink: '#17160f',
  muted: '#6b685b',
  line: '#17160f',
  soft: '#f3efe0',
  duck: '#ffd23f',
  duckInk: '#17160f',
  orange: '#ff8a1f',
  ok: '#1f9d55',
  danger: '#d64545',
};
export const dark = {
  bg: '#121212',
  card: '#1c1c1e',
  ink: '#f5f5f5',
  muted: '#a1a1a6',
  line: '#f5f5f5',
  soft: '#26262a',
  duck: '#ffd23f',
  duckInk: '#17160f',
  orange: '#ff8a1f',
  ok: '#4cd98a',
  danger: '#ff6b6b',
};

export type ColorKey = keyof typeof light;
const KEYS = Object.keys(light) as ColorKey[];

/** { bg: 'var(--d-bg)', ... } */
export const CSS_VAR_TOKENS = Object.fromEntries(KEYS.map((k) => [k, `var(--d-${k})`])) as Record<ColorKey, string>;
export const CSS_VAR_SHADOW = 'var(--d-shadow)';

const vars = (c: typeof light, shadow: string) => KEYS.map((k) => `--d-${k}:${c[k]}`).join(';') + `;--d-shadow:${shadow}`;

/** Goes into every page's <head>. The saved choice (data-theme) beats the system setting. */
export const THEME_CSS = [
  `:root{${vars(light, light.ink)};color-scheme:light}`,
  `@media (prefers-color-scheme:dark){:root:not([data-theme=light]){${vars(dark, '#000000')};color-scheme:dark}}`,
  `:root[data-theme=dark]{${vars(dark, '#000000')};color-scheme:dark}`,
  'html,body{background-color:var(--d-bg)}',
  // the light/dark toggle icon (a moon in light mode, a sun in dark mode) is chosen by CSS too
  '[data-duck=sun]{display:none}',
  '@media (prefers-color-scheme:dark){:root:not([data-theme=light]) [data-duck=moon]{display:none}:root:not([data-theme=light]) [data-duck=sun]{display:inline}}',
  ':root[data-theme=dark] [data-duck=moon]{display:none}:root[data-theme=dark] [data-duck=sun]{display:inline}',
].join('');

/** Runs before first paint. Only an explicit saved choice is applied; "system" is left to the media query. */
export const THEME_INIT_SCRIPT = "try{var m=localStorage.getItem('duck.theme');if(m==='dark'||m==='light')document.documentElement.setAttribute('data-theme',m)}catch(e){}";
