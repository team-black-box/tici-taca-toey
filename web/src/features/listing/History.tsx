import { useMemo } from "react";
import { useAppSelector } from "../../state/store";
import { getMyGames } from "../../state/history";
import { navigate } from "../../common/router";
import { decodeTtn } from "../../common/ttn";
import { ArchivedGameSummary, GameStatus } from "../../common/model";

// The result of an archived game from its owner's seat. Team games win or
// lose as a side: my team = mySeat % teamCount.
const resultFor = (game: ArchivedGameSummary): { text: string; className: string } => {
  if (game.status === GameStatus.GAME_ENDS_IN_A_DRAW) {
    return { text: "draw", className: "badge badge--done" };
  }
  if (game.status === GameStatus.GAME_ABANDONED) {
    return { text: "abandoned", className: "badge badge--dead" };
  }
  if (game.winnerSeat === null || game.mySeat < 0) {
    return { text: "finished", className: "badge badge--done" };
  }
  let iWon = game.winnerSeat === game.mySeat;
  try {
    const teams = decodeTtn(game.ttn).teamCount;
    if (teams > 0) {
      iWon = game.winnerSeat % teams === game.mySeat % teams;
    }
  } catch {
    // undecodable line - fall back to the seat comparison
  }
  return iWon
    ? { text: "won", className: "badge badge--done" }
    : { text: "lost", className: "badge badge--dead" };
};

const configOf = (game: ArchivedGameSummary): string => {
  try {
    const decoded = decodeTtn(game.ttn);
    return [
      `${decoded.boardSize}x${decoded.boardSize}`,
      decoded.winningSequenceCount > 1
        ? `${decoded.winningSequenceCount}×${decoded.winningSequenceLength}`
        : `win ${decoded.winningSequenceLength}`,
      decoded.teamCount > 0 ? `${decoded.teamCount} teams` : null,
      decoded.timed ? "timed" : null,
    ]
      .filter(Boolean)
      .join(" · ");
  } catch {
    return "";
  }
};

const when = (timestamp: number): string => {
  const minutes = Math.floor((Date.now() - timestamp) / 60_000);
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.floor(hours / 24)}d ago`;
};

// The player's finished games, newest first, one click to replay. Rows come
// from the MY_GAMES websocket response (see state/history.ts).
const History = () => {
  const games = useAppSelector(getMyGames);
  const rows = useMemo(
    () =>
      games.map((game) => ({
        game,
        result: resultFor(game),
        config: configOf(game),
      })),
    [games]
  );

  if (rows.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="rail-title">your finished games</div>
      {rows.map(({ game, result, config }) => (
        <div
          key={game.gameId}
          className="tile tile--live"
          onClick={() => navigate(`/replay/${encodeURIComponent(game.ttn)}`)}
          title="replay this game"
        >
          <div>
            <div className={result.className}>{result.text}</div>
            <div className="tile-meta">
              <span>{config}</span>
              <span>{when(game.completedAt)}</span>
            </div>
          </div>
          <div className="tile-meta">
            <span>
              {game.players
                .map((player) => player.handle)
                .join(" vs ")}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default History;
