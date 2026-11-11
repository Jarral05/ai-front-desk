// A profile's look: three colours and, for a private profile, a logo file. Pure functions, so
// a colour that can't be read or a file that isn't really an image is refused at startup.

// The page background in client/src/styles.css. Accent-coloured text (prices, links) sits on it.
const PAGE = '#f8fafc';
const WHITE = '#ffffff';
// WCAG 2.2 level AA for normal-size text.
export const MIN_CONTRAST = 4.5;

export const HEX_COLOUR = /^#[0-9a-f]{6}$/i;

// WCAG's relative luminance: how bright a colour looks to the eye, from 0 (black) to 1 (white).
function luminance(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// From 1 (no difference) to 21 (black on white).
export function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

// The pale fill behind accent text, as styles.css makes it: color-mix(in srgb, accent 7%, #fff).
export function tint(hex, share = 0.07) {
  return `#${[1, 3, 5]
    .map((i) => Math.round(share * parseInt(hex.slice(i, i + 2), 16) + (1 - share) * 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

// Where each colour is used, and what it must be readable against. Returns the first problem in
// words, or null when all three pairs can be read.
export function brandProblem({ dark, accent, light }) {
  const pairs = [
    ['dark', dark, WHITE, 'white text on the header, the footer and your chat messages'],
    ['accent', accent, PAGE, 'prices, links and the white text on buttons'],
    ['accent', accent, tint(accent), 'the "Book an appointment" button'],
    ['light', light, dark, 'the dark text on the demo bar'],
  ];
  for (const [name, colour, against, where] of pairs) {
    const ratio = contrast(colour, against);
    if (ratio < MIN_CONTRAST) {
      return `the ${name} colour ${colour} is too hard to read for ${where} `
        + `(contrast ${ratio.toFixed(1)}, needs at least ${MIN_CONTRAST}).`;
    }
  }
  return null;
}

// "Nanhay Qadam Children's Hospital (Demo)" → "NQ". Shown in a circle when there's no logo.
export function initials(name) {
  return name
    .replace(/\(.*?\)/g, ' ')
    .split(/\s+/)
    .filter((word) => /^\p{L}/u.test(word))
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

export const LOGO_BYTES = 300 * 1024;

// The real type from the file's first bytes, never from its name. SVG is refused on purpose: it
// is text that can carry scripts.
export function logoType(bytes) {
  const starts = (...sig) => sig.every((byte, i) => bytes[i] === byte);
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (starts(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (starts(0x52, 0x49, 0x46, 0x46) && bytes.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}
