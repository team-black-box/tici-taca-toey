// Draws the five tab-bar icons and writes them as PNGs at @1x/@2x/@3x.
//
// The icons have to be images because that is the only artwork the two
// tab bars have in common: iOS's native bar takes an SF Symbol or a
// bitmap and nothing else, and SF Symbols do not exist on Android. So
// one set of bitmaps is the only way both bars can show the same thing.
//
// Rather than check in five opaque binaries, the shapes live here as
// geometry and the PNGs are generated from it - editable, diffable, and
// re-runnable at any size. Zero dependencies: the PNG encoder is below
// and the only import is node:zlib, which Bun ships.
//
//   bun scripts/make-tab-icons.ts
//
// Output is white pixels with a coverage alpha, which is what both
// platforms want: iOS tints the image for selected/unselected state
// (`tinted` defaults to true), and Android's Image takes a tintColor.
// Colour never lives in the file.
import { deflateSync } from "node:zlib";

// Every shape is written in a 24x24 design space, whatever the output
// size, so the icons stay in proportion to each other.
const GRID = 24;
// Samples per axis per pixel. 4 is enough to make a diagonal look drawn
// rather than stepped, and costs nothing at these sizes.
const SUPERSAMPLE = 4;
const SIZES = [
  { suffix: "", scale: 1 },
  { suffix: "@2x", scale: 2 },
  { suffix: "@3x", scale: 3 },
];

type Inside = (x: number, y: number) => boolean;

const circle =
  (cx: number, cy: number, r: number): Inside =>
  (x, y) =>
    (x - cx) ** 2 + (y - cy) ** 2 <= r * r;

const rect =
  (x0: number, y0: number, x1: number, y1: number): Inside =>
  (x, y) =>
    x >= x0 && x <= x1 && y >= y0 && y <= y1;

// Half-plane test per edge; vertices must be given clockwise.
const triangle =
  (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number
  ): Inside =>
  (x, y) => {
    const side = (
      x0: number,
      y0: number,
      x1: number,
      y1: number
    ): number => (x1 - x0) * (y - y0) - (y1 - y0) * (x - x0);
    const a = side(ax, ay, bx, by);
    const b = side(bx, by, cx, cy);
    const c = side(cx, cy, ax, ay);
    return (a >= 0 && b >= 0 && c >= 0) || (a <= 0 && b <= 0 && c <= 0);
  };

const union =
  (...parts: Inside[]): Inside =>
  (x, y) =>
    parts.some((part) => part(x, y));

const minus =
  (base: Inside, ...holes: Inside[]): Inside =>
  (x, y) =>
    base(x, y) && !holes.some((hole) => hole(x, y));

const both =
  (...parts: Inside[]): Inside =>
  (x, y) =>
    parts.every((part) => part(x, y));

// An eye: the lens is the overlap of two circles, which is what gives
// the almond its two arcs. `inset` pushes the centres further *apart*,
// which is what shrinks the overlap - moving them together would grow
// it, and an inner lens bigger than the outer one erases the ring
// instead of hollowing it. Radius and offset are chosen to give a lens
// roughly 17 wide by 9 tall.
const LENS_R = 10.3;
const LENS_OFFSET = 5.8;
const lens = (inset: number): Inside =>
  both(
    circle(12, 12 + LENS_OFFSET + inset, LENS_R),
    circle(12, 12 - LENS_OFFSET - inset, LENS_R)
  );

export const ICONS: Record<string, Inside> = {
  // A play triangle. The tab is where you start and join games.
  play: triangle(7.5, 4, 7.5, 20, 19.5, 12),

  // An eye: lens outline plus pupil.
  watch: union(minus(lens(0), lens(1.3)), circle(12, 12, 2.4)),

  // A calendar: two hangers, a solid header band, an outlined body, and
  // one filled square for today.
  daily: union(
    rect(7.5, 2.5, 9, 5),
    rect(15, 2.5, 16.5, 5),
    rect(3.5, 4, 20.5, 8),
    minus(rect(3.5, 4, 20.5, 21), rect(5, 9.5, 19, 19.5)),
    rect(10.5, 12.5, 13.5, 15.5)
  ),

  // Three ascending bars, sharing a baseline.
  ranks: union(
    rect(4.5, 14, 8.5, 20.5),
    rect(10, 10, 14, 20.5),
    rect(15.5, 5.5, 19.5, 20.5)
  ),

  // A person: head, and shoulders as a dome clipped to the baseline.
  you: union(
    circle(12, 8, 4),
    both(circle(12, 21.5, 7.5), rect(0, 13.5, 24, 20.5))
  ),
};

// -- PNG encoding ---------------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

const crc32 = (bytes: Uint8Array): number => {
  let c = 0xffffffff;
  for (const byte of bytes) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type: string, data: Uint8Array): Uint8Array => {
  const name = new TextEncoder().encode(type);
  const body = new Uint8Array(name.length + data.length);
  body.set(name);
  body.set(data, name.length);
  const out = new Uint8Array(body.length + 8);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(body, 4);
  view.setUint32(out.length - 4, crc32(body));
  return out;
};

// 8-bit RGBA, no interlacing, filter 0 on every scanline.
const encodePng = (size: number, alpha: Uint8Array): Uint8Array => {
  const raw = new Uint8Array(size * (size * 4 + 1));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0;
    for (let x = 0; x < size; x++) {
      raw[o++] = 255;
      raw[o++] = 255;
      raw[o++] = 255;
      raw[o++] = alpha[y * size + x];
    }
  }
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, size);
  view.setUint32(4, size);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", new Uint8Array(deflateSync(raw, { level: 9 }))),
    chunk("IEND", new Uint8Array(0)),
  ];
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const png = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    png.set(part, at);
    at += part.length;
  }
  return png;
};

export const rasterise = (inside: Inside, size: number): Uint8Array => {
  const alpha = new Uint8Array(size * size);
  const step = GRID / size / SUPERSAMPLE;
  const origin = GRID / size / SUPERSAMPLE / 2;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let hits = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const x = (px * SUPERSAMPLE + sx) * step + origin;
          const y = (py * SUPERSAMPLE + sy) * step + origin;
          if (inside(x, y)) {
            hits++;
          }
        }
      }
      alpha[py * size + px] = Math.round(
        (hits / (SUPERSAMPLE * SUPERSAMPLE)) * 255
      );
    }
  }
  return alpha;
};

// The base size is the point size the bars draw at; @2x/@3x follow.
export const BASE = 28;

if (import.meta.main) {
  const dir = new URL("../src/icons/tabs/", import.meta.url).pathname;
  for (const [name, inside] of Object.entries(ICONS)) {
    for (const { suffix, scale } of SIZES) {
      const size = BASE * scale;
      await Bun.write(
        `${dir}${name}${suffix}.png`,
        encodePng(size, rasterise(inside, size))
      );
      console.log(`${name}${suffix}.png  ${size}x${size}`);
    }
  }
}
