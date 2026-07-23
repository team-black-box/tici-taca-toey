export type RootStackParamList = {
  Tabs: undefined;
  Game: undefined;
  // A finished game replayed from its TTN line - no server round trip.
  Replay: { ttn: string };
  // Browse routes, keyed by public handle.
  Leaderboard: undefined;
  Player: { handle: string };
};

export type TabParamList = {
  play: undefined;
  watch: undefined;
};
