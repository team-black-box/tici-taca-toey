// A dependency-free QR code generator replacing react-qr-code.
//
// Implements the QR Model 2 specification for byte mode at error correction
// level M, versions 1-10 (plenty for share links). The algorithm follows the
// public-domain-style reference by Project Nayuki (https://www.nayuki.io/page/qr-code-generator-library,
// MIT licensed). Output is verified in test/qr.test.ts against fixtures that
// were decoded with an independent QR reader.

// --- Galois field GF(2^8) arithmetic for Reed-Solomon error correction ---

const gfMultiply = (a: number, b: number): number => {
  let result = 0;
  for (let i = 7; i >= 0; i--) {
    result = (result << 1) ^ ((result >>> 7) * 0x11d);
    result ^= ((b >>> i) & 1) * a;
  }
  return result;
};

const reedSolomonDivisor = (degree: number): number[] => {
  const result = new Array(degree - 1).fill(0);
  result.push(1); // monic polynomial x^0
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < result.length) {
        result[j] ^= result[j + 1];
      }
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
};

const reedSolomonRemainder = (data: number[], divisor: number[]): number[] => {
  const result = divisor.map(() => 0);
  for (const byte of data) {
    const factor = byte ^ (result.shift() as number);
    result.push(0);
    divisor.forEach((coefficient, index) => {
      result[index] ^= gfMultiply(coefficient, factor);
    });
  }
  return result;
};

// --- Version tables (error correction level M, versions 1-10) ---

const ECC_CODEWORDS_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const NUM_ERROR_CORRECTION_BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
const MAX_VERSION = 10;

const getNumRawDataModules = (version: number): number => {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) {
      result -= 36;
    }
  }
  return result;
};

const getNumDataCodewords = (version: number): number =>
  Math.floor(getNumRawDataModules(version) / 8) -
  ECC_CODEWORDS_PER_BLOCK[version] * NUM_ERROR_CORRECTION_BLOCKS[version];

// --- Encoding ---

const toUtf8Bytes = (text: string): number[] =>
  Array.from(new TextEncoder().encode(text));

const chooseVersion = (dataLength: number): number => {
  for (let version = 1; version <= MAX_VERSION; version++) {
    const charCountBits = version <= 9 ? 8 : 16;
    const neededBits = 4 + charCountBits + dataLength * 8;
    if (neededBits <= getNumDataCodewords(version) * 8) {
      return version;
    }
  }
  throw new Error("Text too long to encode as a QR code");
};

const buildCodewords = (data: number[], version: number): number[] => {
  const bits: number[] = [];
  const appendBits = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) {
      bits.push((value >>> i) & 1);
    }
  };

  appendBits(0b0100, 4); // byte mode
  appendBits(data.length, version <= 9 ? 8 : 16);
  data.forEach((byte) => appendBits(byte, 8));

  const capacityBits = getNumDataCodewords(version) * 8;
  appendBits(0, Math.min(4, capacityBits - bits.length)); // terminator
  appendBits(0, (8 - (bits.length % 8)) % 8); // byte align
  for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) {
    appendBits(pad, 8);
  }

  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    codewords.push(
      bits
        .slice(i, i + 8)
        .reduce((accumulator, bit) => (accumulator << 1) | bit, 0)
    );
  }
  return codewords;
};

const addEccAndInterleave = (data: number[], version: number): number[] => {
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[version];
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[version];
  const rawCodewords = Math.floor(getNumRawDataModules(version) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);

  const divisor = reedSolomonDivisor(blockEccLen);
  const blocks: number[][] = [];
  const eccs: number[][] = [];
  let offset = 0;
  for (let blockIndex = 0; blockIndex < numBlocks; blockIndex++) {
    const dataLength =
      shortBlockLen - blockEccLen + (blockIndex < numShortBlocks ? 0 : 1);
    const blockData = data.slice(offset, offset + dataLength);
    offset += dataLength;
    blocks.push(blockData);
    eccs.push(reedSolomonRemainder(blockData, divisor));
  }

  const result: number[] = [];
  const maxDataLength = shortBlockLen - blockEccLen + 1;
  for (let i = 0; i < maxDataLength; i++) {
    blocks.forEach((block) => {
      if (i < block.length) {
        result.push(block[i]);
      }
    });
  }
  for (let i = 0; i < blockEccLen; i++) {
    eccs.forEach((ecc) => result.push(ecc[i]));
  }
  return result;
};

// --- Module placement ---

type Grid = boolean[][];

const getAlignmentPatternPositions = (version: number): number[] => {
  if (version === 1) {
    return [];
  }
  const numAlign = Math.floor(version / 7) + 2;
  const size = version * 4 + 17;
  const step = Math.ceil((version * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result = [6];
  for (let position = size - 7; result.length < numAlign; position -= step) {
    result.splice(1, 0, position);
  }
  return result;
};

interface ModuleField {
  size: number;
  modules: Grid;
  isFunction: Grid;
}

const drawFunctionPatterns = (version: number): ModuleField => {
  const size = version * 4 + 17;
  const modules: Grid = Array.from({ length: size }, () =>
    new Array(size).fill(false)
  );
  const isFunction: Grid = Array.from({ length: size }, () =>
    new Array(size).fill(false)
  );

  const setFunctionModule = (x: number, y: number, isDark: boolean) => {
    modules[y][x] = isDark;
    isFunction[y][x] = true;
  };

  // timing patterns
  for (let i = 0; i < size; i++) {
    setFunctionModule(6, i, i % 2 === 0);
    setFunctionModule(i, 6, i % 2 === 0);
  }

  // finder patterns with separators
  const drawFinder = (x: number, y: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && xx < size && yy >= 0 && yy < size) {
          setFunctionModule(xx, yy, distance !== 2 && distance !== 4);
        }
      }
    }
  };
  drawFinder(3, 3);
  drawFinder(size - 4, 3);
  drawFinder(3, size - 4);

  // alignment patterns
  const alignPositions = getAlignmentPatternPositions(version);
  const numAlign = alignPositions.length;
  for (let i = 0; i < numAlign; i++) {
    for (let j = 0; j < numAlign; j++) {
      const cornersWithFinders =
        (i === 0 && j === 0) ||
        (i === 0 && j === numAlign - 1) ||
        (i === numAlign - 1 && j === 0);
      if (cornersWithFinders) {
        continue;
      }
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          setFunctionModule(
            alignPositions[i] + dx,
            alignPositions[j] + dy,
            Math.max(Math.abs(dx), Math.abs(dy)) !== 1
          );
        }
      }
    }
  }

  // reserve format info areas (filled in per-mask later)
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      isFunction[i][8] = true;
      isFunction[8][i] = true;
    }
    if (i < 8) {
      isFunction[8][size - 1 - i] = true;
      isFunction[size - 1 - i][8] = true;
    }
  }
  isFunction[8][8] = true;
  modules[size - 8][8] = true; // dark module
  isFunction[size - 8][8] = true;

  // version information for versions 7-10
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) {
      rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    }
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = ((bits >>> i) & 1) !== 0;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFunctionModule(a, b, bit);
      setFunctionModule(b, a, bit);
    }
  }

  return { size, modules, isFunction };
};

const drawCodewords = (field: ModuleField, codewords: number[]) => {
  const { size, modules, isFunction } = field;
  let bitIndex = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) {
      right = 5;
    }
    for (let vertical = 0; vertical < size; vertical++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vertical : vertical;
        if (!isFunction[y][x] && bitIndex < codewords.length * 8) {
          modules[y][x] =
            ((codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) !== 0;
          bitIndex++;
        }
      }
    }
  }
};

const MASKS: Array<(x: number, y: number) => boolean> = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

const applyMask = (field: ModuleField, mask: number) => {
  const { size, modules, isFunction } = field;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!isFunction[y][x] && MASKS[mask](x, y)) {
        modules[y][x] = !modules[y][x];
      }
    }
  }
};

const drawFormatBits = (field: ModuleField, mask: number) => {
  const { size, modules } = field;
  // error correction level M has format bits 00
  const data = (0b00 << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) {
    rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  }
  const bits = ((data << 10) | rem) ^ 0x5412;
  const getBit = (index: number) => ((bits >>> index) & 1) !== 0;

  for (let i = 0; i <= 5; i++) {
    modules[i][8] = getBit(i);
  }
  modules[7][8] = getBit(6);
  modules[8][8] = getBit(7);
  modules[8][7] = getBit(8);
  for (let i = 9; i < 15; i++) {
    modules[8][14 - i] = getBit(i);
  }
  for (let i = 0; i < 8; i++) {
    modules[8][size - 1 - i] = getBit(i);
  }
  for (let i = 8; i < 15; i++) {
    modules[size - 15 + i][8] = getBit(i);
  }
  modules[size - 8][8] = true; // dark module
};

// Penalty score steers mask selection only; every mask yields a valid code.
const computePenalty = (field: ModuleField): number => {
  const { size, modules } = field;
  let penalty = 0;

  const scoreLine = (line: boolean[]) => {
    let score = 0;
    let runColor = line[0];
    let runLength = 1;
    const finderHistory: number[] = [];
    const checkFinderPattern = () => {
      // pattern dark:light ratios 1:1:3:1:1 flanked by 4 light modules
      const n = finderHistory.length;
      if (n >= 7) {
        const [a, b, c, d, e, f, g] = finderHistory.slice(n - 7);
        if (
          c === a &&
          d === a &&
          f === a &&
          e === 3 * a &&
          (b >= 4 * a || g >= 4 * a)
        ) {
          score += 40;
        }
      }
    };
    for (let i = 1; i <= line.length; i++) {
      if (i < line.length && line[i] === runColor) {
        runLength++;
        continue;
      }
      if (runLength >= 5) {
        score += 3 + (runLength - 5);
      }
      if (runColor) {
        // record light-dark-light pattern transitions for finder-like check
        finderHistory.push(runLength);
        checkFinderPattern();
      } else {
        finderHistory.push(runLength);
      }
      runColor = i < line.length ? line[i] : runColor;
      runLength = 1;
    }
    return score;
  };

  for (let y = 0; y < size; y++) {
    penalty += scoreLine(modules[y]);
  }
  for (let x = 0; x < size; x++) {
    penalty += scoreLine(modules.map((row) => row[x]));
  }

  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const color = modules[y][x];
      if (
        color === modules[y][x + 1] &&
        color === modules[y + 1][x] &&
        color === modules[y + 1][x + 1]
      ) {
        penalty += 3;
      }
    }
  }

  let dark = 0;
  modules.forEach((row) =>
    row.forEach((module) => {
      if (module) {
        dark++;
      }
    })
  );
  const total = size * size;
  const k = Math.floor(Math.abs(dark * 20 - total * 10) / total);
  penalty += 10 * k;

  return penalty;
};

export const encodeQr = (text: string): boolean[][] => {
  const data = toUtf8Bytes(text);
  const version = chooseVersion(data.length);
  const codewords = addEccAndInterleave(buildCodewords(data, version), version);

  const field = drawFunctionPatterns(version);
  drawCodewords(field, codewords);

  let bestMask = 0;
  let bestPenalty = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    applyMask(field, mask);
    drawFormatBits(field, mask);
    const penalty = computePenalty(field);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestMask = mask;
    }
    applyMask(field, mask); // un-apply (XOR is its own inverse)
  }
  applyMask(field, bestMask);
  drawFormatBits(field, bestMask);

  return field.modules;
};

// --- React component, a drop-in for <QRCode value={...} /> ---

interface QrCodeProps {
  value: string;
  className?: string;
}

const QrCode = ({ value, className }: QrCodeProps) => {
  const modules = encodeQr(value);
  const size = modules.length;
  const quietZone = 4;
  const total = size + quietZone * 2;
  let path = "";
  modules.forEach((row, y) => {
    row.forEach((isDark, x) => {
      if (isDark) {
        path += `M${x + quietZone} ${y + quietZone}h1v1h-1z`;
      }
    });
  });
  return (
    <svg
      className={className}
      viewBox={`0 0 ${total} ${total}`}
      style={{ width: 256, height: 256 }}
      shapeRendering="crispEdges"
      role="img"
      aria-label={value}
    >
      <rect width={total} height={total} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  );
};

export default QrCode;
