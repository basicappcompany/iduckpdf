// Draws the duck icon set and the social-share card with sharp. Run once: `npm run icons`.
// (Outputs are committed, so this is only needed when the artwork changes.)
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.join(__dirname, '..');
const out = (p) => path.join(root, p);
fs.mkdirSync(out('public/icons'), { recursive: true });
fs.mkdirSync(out('assets/images'), { recursive: true });

const DUCK = (stroke = '#17160f', body = '#ffd23f') => `
  <g stroke="${stroke}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
    <path d="M8 40c0-8 6-12 14-12h6c-2-12 4-20 14-20s14 8 10 16l8 4-8 4c0 12-10 22-24 22-12 0-20-4-20-14z" fill="${body}"/>
    <path d="M44 24l11 4-11 4z" fill="#ff8a1f"/>
    <path d="M18 40c4 6 14 6 18-2" fill="none"/>
  </g>
  <circle cx="43" cy="19" r="2.6" fill="${stroke}"/>`;

// square icon: dark rounded tile, yellow duck (good contrast on light and dark tab bars)
const iconSvg = (size, pad = 0, radius = 14) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="${radius}" fill="#17160f"/>
  <g transform="translate(${6 + pad} ${7 + pad}) scale(${(52 - pad * 2) / 64})">${DUCK('#17160f')}</g>
</svg>`;

fs.writeFileSync(out('public/favicon.svg'), iconSvg(64).trim() + '\n');

async function png(svg, file, size) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(out(file));
}

(async () => {
  await png(iconSvg(512), 'public/icons/icon-512.png', 512);
  await png(iconSvg(512), 'public/icons/icon-192.png', 192);
  await png(iconSvg(512, 4, 0), 'public/icons/apple-touch-icon.png', 180); // iOS rounds the corners itself
  await png(iconSvg(512), 'public/icons/favicon-32.png', 32);
  await png(iconSvg(1024, 0, 0), 'assets/images/icon.png', 1024);
  await png(iconSvg(512), 'assets/images/favicon.png', 48);
  // splash: duck only on transparent
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 64 64">${DUCK()}</svg>`)).png().toFile(out('assets/images/splash-icon.png'));

  // Open Graph / Twitter card, 1200x630
  const og = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#fffdf5"/>
  <rect x="36" y="36" width="1128" height="558" rx="28" fill="#ffd23f" stroke="#17160f" stroke-width="6"/>
  <g transform="translate(70 150) scale(5.2)">${DUCK('#17160f', '#fffdf5')}</g>
  <text x="440" y="270" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="104" fill="#17160f" letter-spacing="-3">iDuckPDF</text>
  <text x="444" y="340" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="40" fill="#17160f">Free PDF tools in your browser</text>
  <text x="444" y="400" font-family="Arial, Helvetica, sans-serif" font-size="29" fill="#3b3720">Merge · Split · Compress · Rotate · Watermark</text>
  <text x="444" y="444" font-family="Arial, Helvetica, sans-serif" font-size="29" fill="#3b3720">No sign-up. No watermark. No ads.</text>
  <text x="444" y="530" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="34" fill="#17160f">iduckpdf.com</text>
</svg>`;
  await sharp(Buffer.from(og)).png().toFile(out('public/og.png'));
  console.log('icons and og.png written');
})();
