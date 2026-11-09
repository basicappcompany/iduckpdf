// Pure geometry for placing an image (a signature) on a PDF page, kept free of any PDF library so it is easy to test.
// The editor works in "displayed" fractions: x and y are the top-left corner of the image as a fraction of the page as it looks
// on screen (after the page's own rotation), and w is the image width as a fraction of the displayed page width.
export type Box = { x: number; y: number; width: number; height: number };
export type Frac = { x: number; y: number; w: number };
export type Placed = { x: number; y: number; width: number; height: number; angle: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Where to draw the image in the page's own (unrotated) coordinate system so that it appears upright at the chosen spot.
 * `angle` is the counter-clockwise rotation to draw it with (pdf-lib's convention) and (x, y) is its lower-left corner.
 */
export function placeImage(crop: Box, rotation: number, frac: Frac, aspect: number): Placed {
  const r = (((Math.round(rotation / 90) * 90) % 360) + 360) % 360;
  const W = crop.width;
  const H = crop.height;
  const sideways = r === 90 || r === 270;
  const Wd = sideways ? H : W; // displayed width and height
  const Hd = sideways ? W : H;
  const width = clamp(frac.w, 0.02, 1) * Wd;
  const height = width / aspect;
  const dx = clamp(frac.x * Wd, 0, Math.max(0, Wd - width)); // top-left of the image, displayed, from the top-left of the page
  const dy = clamp(frac.y * Hd, 0, Math.max(0, Hd - height));
  const bx = dx; // lower-left corner of the image in the same displayed space
  const by = dy + height;
  let px: number;
  let py: number;
  if (r === 0) { px = bx; py = H - by; }
  else if (r === 90) { px = by; py = bx; }
  else if (r === 180) { px = W - bx; py = by; }
  else { px = W - by; py = H - bx; }
  return { x: crop.x + px, y: crop.y + py, width, height, angle: r };
}

/** The four corners of a placed image in page coordinates, for tests. */
export function corners(p: Placed): [number, number][] {
  const a = (p.angle * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [[0, 0], [p.width, 0], [p.width, p.height], [0, p.height]].map(([u, v]) => [p.x + u * c - v * s, p.y + u * s + v * c]);
}
