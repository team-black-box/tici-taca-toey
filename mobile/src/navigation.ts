import type { PlayerKind } from "./model";

// A TTN line records seats, never names, so a replay is handed the roster
// separately by whoever already knew it - the history list, a profile
// page. Optional: a replay opened without it labels seats by number.
export interface ReplaySeat {
  seat: number;
  handle: string;
  kind: PlayerKind;
}

export type RootStackParamList = {
  Tabs: undefined;
  Game: undefined;
  // A finished game replayed from its TTN line - no server round trip.
  Replay: { ttn: string; roster?: ReplaySeat[] };
  // Browse routes, keyed by public handle.
  Leaderboard: undefined;
  Player: { handle: string };
};

export type TabParamList = {
  play: undefined;
  watch: undefined;
};
