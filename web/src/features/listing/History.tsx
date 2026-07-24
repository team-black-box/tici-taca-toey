import { useMemo } from "react";
import { useAppSelector } from "../../state/store";
import { getMyGames } from "../../state/history";
import { getCurrentPlayerName } from "../../state/currentPlayer";
import { navigate } from "../../common/router";
import { replayPath } from "../../common/replay";
import { decodeTtn } from "../../common/ttn";
import { ArchivedGameSummary, GameStatus } from "../../common/model";

// The rail shows only the most recent handful; the rest live on the
// player's own profile page.
const RAIL_LIMIT = 10;

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
  const handle = useAppSelector(getCurrentPlayerName);
  const rows = useMemo(
    () =>
      games.slice(0, RAIL_LIMIT).map((game) => ({
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
          onClick={() => navigate(replayPath(game.ttn, game.players))}
          title="replay this game"
        >
          <div>
            <div className={result.className}>{result.text}</div>
            <div className="tile-meta">
              <span>{config}</span>
              <span>{when(game.completedAt)}</span>
            </div>
          </div>
          <div className="tile-side">
            {game.players.map((player) => player.handle).join(" vs ")}
          </div>
        </div>
      ))}
      {handle && (
        <button
          className="btn btn--ghost"
          onClick={() => navigate(`/player/${handle}`)}
        >
          {games.length > RAIL_LIMIT
            ? `see all ${games.length} games >`
            : "your profile >"}
        </button>
      )}
    </div>
  );
};

export default History;
