import { useEffect, useRef, useState } from "react";
import { getSideSymbol } from "../../../common/symbol";
import Avatar from "../../../common/avatar";
import { useAppSelector } from "../../../state/store";
import { getPlayer } from "../../../state/players";
import { getActiveGame } from "../../../state/games";

const LOW_TIME_MS = 10_000;

const formatClock = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

// Renders the server-authoritative clock, ticking locally between NOTIFY_TIME
// updates so a running clock looks alive. Server values snap it back.
const Clock = ({ timeLeft, isRunning }: { timeLeft: number; isRunning: boolean }) => {
  const [, setTick] = useState(0);
  const baseRef = useRef({ value: timeLeft, at: Date.now() });
  if (baseRef.current.value !== timeLeft) {
    baseRef.current = { value: timeLeft, at: Date.now() };
  }

  useEffect(() => {
    if (!isRunning) {
      return;
    }
    const interval = setInterval(() => setTick((count) => count + 1), 250);
    return () => clearInterval(interval);
  }, [isRunning]);

  const displayed = isRunning
    ? baseRef.current.value - (Date.now() - baseRef.current.at)
    : timeLeft;

  return (
    <div
      className={`clock ${isRunning ? "is-running" : ""} ${
        displayed < LOW_TIME_MS ? "is-low" : ""
      }`}
    >
      {formatClock(displayed)}
    </div>
  );
};

interface ActivePlayerProps {
  playerId: string;
  players: string[];
  turn: string;
  teamCount?: number;
}

const ActivePlayer = ({
  playerId,
  players,
  turn,
  teamCount = 0,
}: ActivePlayerProps) => {
  const symbol = getSideSymbol(playerId, players, teamCount);
  const playerName = useAppSelector(getPlayer(playerId))?.name;
  const timer = useAppSelector(
    (state) => getActiveGame(state)?.timers?.[playerId]
  );
  const activePlayerTurn = turn === playerId;
  return (
    <div
      className={`player-card ${symbol.color} ${
        activePlayerTurn ? "is-turn" : ""
      }`}
    >
      <div className="sym">{symbol.symbol}</div>
      <Avatar name={playerName ?? ""} />
      {playerName && <div className="name">{playerName}</div>}
      {timer && <Clock timeLeft={timer.timeLeft} isRunning={timer.isRunning} />}
      {activePlayerTurn && <div className="turn-tag">▮ turn</div>}
    </div>
  );
};

export default ActivePlayer;
