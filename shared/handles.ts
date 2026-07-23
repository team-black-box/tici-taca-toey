// Default handles, in the house style. Nobody should have to think of a
// name to appear on a leaderboard, and "anonymous" is not a name - so a
// player is given one the moment they first sit down, and it sticks.
//
// The shape is <name>-<3 chars of base36>, which keeps collisions rare and
// still fits the handle rules (2-20 chars of a-z 0-9 _ -).

const CREW = [
  "neo",
  "trinity",
  "morpheus",
  "cypher",
  "tank",
  "dozer",
  "switch",
  "apoc",
  "mouse",
  "niobe",
  "ghost",
  "seraph",
  "oracle",
  "sati",
  "rama",
  "link",
  "lock",
  "jax",
  "roland",
  "ballard",
  "sparks",
  "mifune",
  "kid",
  "bane",
  "smith",
  "keymaker",
  "merovingian",
  "persephone",
  "architect",
];

const PLACES = [
  "zion",
  "nebuchadnezzar",
  "logos",
  "mjolnir",
  "construct",
  "dojo",
  "sentinel",
  "squiddy",
  "glitch",
  "redpill",
  "bluepill",
  "whiterabbit",
  "dejavu",
  "cascade",
  "mainframe",
  "kernel",
  "daemon",
  "cipher",
  "payload",
  "phosphor",
  "cathode",
  "subroutine",
  "wireframe",
  "downlink",
  "hardline",
  "residual",
  "anomaly",
  "loopback",
];

export const HANDLE_WORDS: string[] = [...CREW, ...PLACES];

// A random suffix so two people can both be trinity. Base36 keeps it short
// and inside the handle character set.
const suffix = (random: () => number): string =>
  Math.floor(random() * 36 ** 3)
    .toString(36)
    .padStart(3, "0");

export const generateHandle = (random: () => number = Math.random): string => {
  const word = HANDLE_WORDS[Math.floor(random() * HANDLE_WORDS.length)];
  return `${word}-${suffix(random)}`;
};
