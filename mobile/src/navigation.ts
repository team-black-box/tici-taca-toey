export type RootStackParamList = {
  Tabs: undefined;
  Game: undefined;
  // A finished game replayed from its TTN line - no server round trip.
  Replay: { ttn: string };
};

export type TabParamList = {
  play: undefined;
  watch: undefined;
};
