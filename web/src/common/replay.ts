// Who sat where, carried in the replay link.
//
// A TTN line is the game, not the people: it records board, rules, moves,
// and seats - never names. That is deliberate (the corpus is public, and
// the notation must stay identity-free), so a replay on its own can only
// say "seat 1". The roster therefore rides in the URL's query string, in
// seat order, put there by whoever already knew it - the history rail, a
// player's profile page, a finished lobby tile.
//
// A bare /replay/<ttn> link still replays perfectly. It just labels the
// seats by number instead of by handle.
import { PlayerKind } from "./model";

export interface ReplaySeat {
  seat: number;
  handle: string;
  kind: PlayerKind;
}

const HANDLE_PARAM = "p";
const KIND_PARAM = "k";

// The URL is untrusted input like any other: cap what a hand-typed link can
// put on the page. React escapes the text, so this is about the layout
// staying sane, not about safety.
const MAX_SEATS = 10;
const MAX_HANDLE = 50;

const KINDS: string[] = Object.values(PlayerKind);

export const replayPath = (
  ttn: string,
  roster?: ReadonlyArray<ReplaySeat>
): string => {
  const path = `/replay/${encodeURIComponent(ttn)}`;
  if (!roster || roster.length === 0) {
    return path;
  }
  // Index by seat rather than by array order: the seat is the join key
  // between the roster and the notation, and a gap must stay a gap.
  const seats = Math.min(
    MAX_SEATS,
    Math.max(...roster.map((player) => player.seat)) + 1
  );
  if (!Number.isFinite(seats) || seats <= 0) {
    return path;
  }
  const bySeat = new Array<ReplaySeat | undefined>(seats);
  roster.forEach((player) => {
    if (player.seat >= 0 && player.seat < seats) {
      bySeat[player.seat] = player;
    }
  });
  const params = new URLSearchParams();
  bySeat.forEach((player) => {
    params.append(HANDLE_PARAM, player?.handle ?? "");
    params.append(KIND_PARAM, player?.kind ?? "");
  });
  return `${path}?${params.toString()}`;
};

// Read the roster back out of a query string. Seats we were not told about
// come back as undefined so the caller can fall back to a seat label.
export const readRoster = (search: string): Array<ReplaySeat | undefined> => {
  const params = new URLSearchParams(search);
  const kinds = params.getAll(KIND_PARAM);
  return params
    .getAll(HANDLE_PARAM)
    .slice(0, MAX_SEATS)
    .map((handle, seat) => {
      const trimmed = handle.trim().slice(0, MAX_HANDLE);
      if (trimmed.length === 0) {
        return undefined;
      }
      const kind = kinds[seat];
      return {
        seat,
        handle: trimmed,
        kind: KINDS.includes(kind) ? (kind as PlayerKind) : PlayerKind.HUMAN,
      };
    });
};
