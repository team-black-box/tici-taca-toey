import { useEffect, useState } from "react";
import { getServerHttpBase } from "../../state/socket";
import { navigate } from "../../common/router";
import { replayPath } from "../../common/replay";
import { KindIcon } from "../../common/kind";
import { decodeTtn } from "../../common/ttn";
import { ArchivedGameSummary, GameStatus } from "../../common/model";

// Anyone's finished games, looked up by their public handle. Every row
// replays client-side from its TTN line - the notation is the game, so
// watching someone else's match costs the server nothing and reveals
// nothing beyond what the leaderboard already shows.

const describe = (ttn: string): string => {
  try {
    const decoded = decodeTtn(ttn);
    return [
      `${decoded.boardSize}x${decoded.boardSize}`,
      decoded.winningSequenceCount > 1
        ? `${decoded.winningSequenceCount}x${decoded.winningSequenceLength} to win`
        : `win ${decoded.winningSequenceLength}`,
      decoded.teamCount > 0 ? `${decoded.teamCount} teams` : null,
      decoded.timed ? "timed" : null,
      `${decoded.moves.filter((move) => !move.skip).length} moves`,
    ]
      .filter(Boolean)
      .join(" · ");
  } catch {
    return "";
  }
};

// The result from this player's seat, so a row reads the way it would for
// them: won, lost, drew.
const outcomeFor = (
  game: ArchivedGameSummary,
  handle: string
): { text: string; className: string } => {
  if (game.status === GameStatus.GAME_ENDS_IN_A_DRAW) {
    return { text: "DREW", className: "badge badge--done" };
  }
  if (game.status === GameStatus.GAME_ABANDONED) {
    return { text: "ABANDONED", className: "badge badge--dead" };
  }
  const seat = game.players.find(
    (player) => player.handle.toLowerCase() === handle.toLowerCase()
  )?.seat;
  if (game.winnerSeat === null || seat === undefined) {
    return { text: "FINISHED", className: "badge badge--done" };
  }
  let won = game.winnerSeat === seat;
  try {
    const teams = decodeTtn(game.ttn).teamCount;
    if (teams > 0) {
      won = game.winnerSeat % teams === seat % teams;
    }
  } catch {
    // undecodable line - the seat comparison stands
  }
  return won
    ? { text: "WON", className: "badge badge--done" }
    : { text: "LOST", className: "badge badge--dead" };
};

const PlayerPage = ({ handle }: { handle: string }) => {
  const [games, setGames] = useState<ArchivedGameSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(
          `${getServerHttpBase()}/api/handles/${encodeURIComponent(
            handle
          )}/games?limit=50`
        );
        const data = await response.json();
        if (!cancelled) {
          setGames(data.games ?? []);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [handle]);

  return (
    <div>
      <div className="status-row">
        <div className="game-name">{handle}</div>
        <button
          className="btn btn--ghost"
          onClick={() => navigate("/leaderboard")}
        >
          &lt; leaderboard
        </button>
      </div>

      {loaded && games.length === 0 && (
        <div className="stage-empty">
          no finished games for {handle} yet
        </div>
      )}

      {games.map((game) => {
        const outcome = outcomeFor(game, handle);
        return (
          <div
            key={game.gameId}
            className="tile tile--live"
            onClick={() => navigate(replayPath(game.ttn, game.players))}
            title="replay this game"
          >
            <div>
              <div className={outcome.className}>{outcome.text}</div>
              <div className="tile-meta">
                <span>{describe(game.ttn)}</span>
              </div>
            </div>
            <div className="tile-side">
              {game.players.map((player, index) => (
                <span key={player.seat} className="table-handle">
                  {index > 0 && <span className="dim">vs&nbsp;</span>}
                  {player.handle}
                  <KindIcon kind={player.kind} />
                </span>
              ))}
            </div>
          </div>
        );
      })}
      {games.length > 0 && (
        <p className="dim">click any game to replay it move by move</p>
      )}
    </div>
  );
};

export default PlayerPage;
