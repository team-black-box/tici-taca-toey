export const EMPTY_CELL = "-";

interface SymbolDescriptors {
  symbol: string;
  // CSS class from styles/app.css that colors the symbol (neon per player).
  color: string;
}

export const GAME_SYMBOL: SymbolDescriptors[] = [
  { symbol: "X", color: "sym-0" },
  { symbol: "O", color: "sym-1" },
  { symbol: "Y", color: "sym-2" },
  { symbol: "Z", color: "sym-3" },
  { symbol: "W", color: "sym-4" },
  { symbol: "T", color: "sym-5" },
  { symbol: "E", color: "sym-6" },
  { symbol: "H", color: "sym-7" },
  { symbol: "M", color: "sym-8" },
  { symbol: "I", color: "sym-9" },
];

export const getSymbol = (
  playerId: string,
  players: string[]
): SymbolDescriptors => {
  return playerId === EMPTY_CELL
    ? { symbol: "", color: "" }
    : GAME_SYMBOL[players.indexOf(playerId) % 10];
};

// Team games color and mark by side, not seat: teammates share one symbol
// so the board reads as team vs team. Teamless games fall through to the
// per-seat mapping.
export const getSideSymbol = (
  playerId: string,
  players: string[],
  teamCount: number
): SymbolDescriptors => {
  if (teamCount <= 0 || playerId === EMPTY_CELL) {
    return getSymbol(playerId, players);
  }
  const seat = players.indexOf(playerId);
  if (seat < 0) {
    return { symbol: "", color: "" };
  }
  return GAME_SYMBOL[(seat % teamCount) % 10];
};
