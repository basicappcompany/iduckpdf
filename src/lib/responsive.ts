/**
 * Pre-rendered pages cannot know the screen width, so anything that changes with width has to be decided by CSS, not by
 * JavaScript, or phones see the desktop layout first and everything jumps when the app starts (a big layout shift).
 * Mark an element with ds('name') and give it a matching rule in RESPONSIVE_CSS. The breakpoints must equal the ones the
 * JavaScript uses (useWidth), so that before and after hydration the page is laid out the same way.
 */
export const ds = (name: string): any => ({ dataSet: { duck: name } });

export const RESPONSIVE_CSS = [
  '@media (max-width:979px){[data-duck=sidebar]{display:none!important}}', // Shell: sidebar only on wide screens
  '@media (min-width:980px){[data-duck=narrow]{display:none!important}}', // Shell: menu button + logo only on narrow screens
  '@media (max-width:560px){[data-duck=w560]{display:none!important}}', // header: "Search - Ctrl K" label
  '@media (max-width:520px){[data-duck=w520]{display:none!important}}', // header: "Support" label
  '@media (max-width:759px){[data-duck=h1]{font-size:34px!important;line-height:38px!important}[data-duck=h2]{font-size:22px!important;line-height:28px!important}}', // kit T headings
  '@media (max-width:599px){[data-duck=pad]{padding-left:16px!important;padding-right:16px!important}[data-duck=chatpad]{padding-left:12px!important;padding-right:12px!important}}', // Screen + chat gutters
].join('');
