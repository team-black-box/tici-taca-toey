import type { NavigatorScreenParams } from "@react-navigation/native";
import type { PlayerKind } from "./model";

// A TTN line records seats, never names, so a replay is handed the roster
// separately by whoever already knew it - the history list, a profile
// page. Optional: a replay opened without it labels seats by number.
export interface ReplaySeat {
  seat: number;
  handle: string;
  kind: PlayerKind;
}

// The stack sits *over* the tabs and holds the places you go into and
// come back from: a game, a replay, somebody else's profile.
export type RootStackParamList = {
  // Nested so a screen can send you to a specific tab, e.g. the
  // daily's "play a real game" landing on the lobby.
  Tabs: NavigatorScreenParams<TabParamList>;
  // Opened with no params for the game you are already in, or with them
  // when a link put you here - in which case the screen asks the server
  // to seat you. `mode` is "play" or "spectate"; anything else is
  // ignored, since the path pattern is deliberately loose.
  Game: { mode?: string; gameId?: string } | undefined;
  // A finished game replayed from its TTN line - no server round trip.
  Replay: { ttn: string; roster?: ReplaySeat[] };
  // Somebody else's public profile, keyed by handle. Yours is the "you"
  // tab; this is for tapping a name on the leaderboard.
  Player: { handle: string };
};

// The tabs are the places you *are*. Leaderboard and daily used to be
// stack screens reachable only through buttons stacked on the lobby,
// which is how the web does it - the web has a sidebar to put them in.
// A phone has a tab bar, so they live there and the lobby gets to be
// about playing.
export type TabParamList = {
  play: undefined;
  watch: undefined;
  daily: undefined;
  ranks: undefined;
  you: undefined;
};
