// Hacker avatars: a deterministic 5x3 grid of block glyphs in one of the
// neon player colors, generated from a name hash. Pure text, no images,
// instant. Replaces the old identicons.

const GLYPHS = [" ", "░", "▒", "▓", "█"];
const COLOR_CLASSES = [
  "sym-0",
  "sym-1",
  "sym-2",
  "sym-3",
  "sym-4",
  "sym-5",
  "sym-6",
  "sym-7",
  "sym-8",
  "sym-9",
];

const hashString = (value: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
};

export interface AvatarFace {
  rows: string[];
  colorClass: string;
}

export const generateAvatar = (name: string): AvatarFace => {
  // Short names get padded with the project's name - a charm kept from the
  // identicon era.
  const key =
    name.length >= 16
      ? name
      : `${name}${"ticitacatoeyhash".substring(0, 16 - name.length)}`;
  const colorClass = COLOR_CLASSES[hashString(key) % COLOR_CLASSES.length];

  const rows: string[] = [];
  let bits = hashString(`${key}:face`);
  for (let row = 0; row < 3; row++) {
    let left = "";
    for (let column = 0; column < 3; column++) {
      left += GLYPHS[bits % GLYPHS.length];
      bits = (bits >>> 3) ^ Math.imul(bits, 0x9e3779b1);
      bits >>>= 0;
    }
    // mirror for that face-like symmetry
    rows.push(left + left[1] + left[0]);
  }
  return { rows, colorClass };
};

interface AvatarProps {
  name: string;
  className?: string;
}

const Avatar = ({ name, className = "" }: AvatarProps) => {
  const face = generateAvatar(name);
  return (
    <pre className={`avatar ${face.colorClass} ${className}`} aria-hidden="true">
      {face.rows.join("\n")}
    </pre>
  );
};

export default Avatar;
