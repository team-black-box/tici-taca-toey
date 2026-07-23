// The terminal identity, mirrored from web/src/styles/app.css. Dark only.
import { Platform } from "react-native";
import { ErrorCodes, Game, GameStatus, StaticPlayerStore } from "./model";

export const C = {
  bg: "#050905",
  panel: "#0a120a",
  border: "#1e3320",
  fg: "#b9e6bb",
  dim: "#62895f",
  accent: "#00ff66",
  accentSoft: "rgba(0,255,102,0.14)",
  danger: "#ff5050",
  warn: "#ffc24d",
  info: "#59d8ff",
  syms: [
    "#00ff66",
    "#00d2ff",
    "#ff9d00",
    "#ffe600",
    "#b3ff00",
    "#8a8aff",
    "#4da6ff",
    "#ff4d6a",
    "#c45dff",
    "#ff6bd6",
  ],
};

export const MONO = {
  fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
};

export const SYMBOLS = ["X", "O", "Y", "Z", "W", "T", "E", "H", "M", "I"];

export const formatClock = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
};

// --- feedback copy (mirrors web/src/state/feedback.ts) ---

export type FeedbackKind = "ok" | "info" | "warn" | "err";

export const FEEDBACK_COLOR: Record<FeedbackKind, string> = {
  ok: C.accent,
  info: C.info,
  warn: C.warn,
  err: C.danger,
};

export { ERROR_COPY } from "../../shared/copy";

// --- hacker avatars (mirrors web/src/common/avatar.tsx) ---

const GLYPHS = [" ", "░", "▒", "▓", "█"];

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
  color: string;
}

export const generateAvatar = (name: string): AvatarFace => {
  const key =
    name.length >= 16
      ? name
      : `${name}${"ticitacatoeyhash".substring(0, 16 - name.length)}`;
  const color = C.syms[hashString(key) % C.syms.length];
  const rows: string[] = [];
  let bits = hashString(`${key}:face`);
  for (let row = 0; row < 3; row++) {
    let left = "";
    for (let column = 0; column < 3; column++) {
      left += GLYPHS[bits % GLYPHS.length];
      bits = (bits >>> 3) ^ Math.imul(bits, 0x9e3779b1);
      bits >>>= 0;
    }
    rows.push(left + left[1] + left[0]);
  }
  return { rows, color };
};

// --- viewer-perspective status (mirrors web/src/common/status.ts) ---

export interface StatusDescriptor {
  text: string;
  color: string;
}

const PLAIN_STATUS: Record<GameStatus, StatusDescriptor> = {
  [GameStatus.WAITING_FOR_PLAYERS]: { text: "WAITING", color: C.warn },
  [GameStatus.GAME_IN_PROGRESS]: { text: "LIVE", color: C.accent },
  [GameStatus.GAME_WON]: { text: "WON", color: C.info },
  [GameStatus.GAME_ENDS_IN_A_DRAW]: { text: "DRAW", color: C.info },
  [GameStatus.GAME_WON_BY_TIMEOUT]: { text: "TIMEOUT", color: C.info },
  [GameStatus.GAME_ABANDONED]: { text: "ABANDONED", color: C.danger },
};

export const getStatusForViewer = (
  game: Game,
  viewerId: string,
  players: StaticPlayerStore
): StatusDescriptor => {
  const won =
    game.status === GameStatus.GAME_WON ||
    game.status === GameStatus.GAME_WON_BY_TIMEOUT;
  if (!won) {
    return PLAIN_STATUS[game.status];
  }
  const onTime = game.status === GameStatus.GAME_WON_BY_TIMEOUT;
  if (game.winner === viewerId) {
    return { text: onTime ? "WON ON TIME" : "GAME WON", color: C.info };
  }
  if (game.players.includes(viewerId)) {
    return { text: onTime ? "LOST ON TIME" : "GAME LOST", color: C.danger };
  }
  const winnerName = players[game.winner]?.name;
  return {
    text: `WON BY ${(winnerName || "ANON").toUpperCase()}`,
    color: C.info,
  };
};
