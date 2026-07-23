import GameTile from "./GameTile";
import { useAppSelector } from "../../state/store";
import {
  getCurrentlyPlayingGames,
  getCurrentlySpectatingGames,
} from "../../state/currentPlayer";
import { getLobbyGames } from "../../state/lobby";
import { spectateGame, joinGame } from "../../state/actions";
import { GameSummary, GameStatus } from "../../common/model";
import {
  UserIcon,
  RobotIcon,
  AgentIcon,
  GlassesIcon,
  GridIcon,
} from "../../common/icons";

// One row of the public lobby: name, size, who is at the table. Open games
// offer a seat; everything else can be watched.
const LiveGameTile = ({ summary }: { summary: GameSummary }) => {
  const live = summary.status === GameStatus.GAME_IN_PROGRESS;
  const seatsLeft =
    summary.playerCount -
    (summary.humanCount + summary.robotCount + summary.agentCount);
  const joinable = summary.openSeats && !live && seatsLeft > 0;
  return (
    <div
      className={`tile tile--live ${live ? "tile--active" : ""}`}
      onClick={() => spectateGame(summary.gameId)}
      title={joinable ? "watch, or take a seat" : "spectate"}
    >
      <div>
        <div className="tile-name">
          {summary.name}
          {live && (
            <span className="activity" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          )}
        </div>
        <div className={`badge ${live ? "badge--live" : "badge--wait"}`}>
          {live
            ? "LIVE"
            : `WAITING (${
                summary.humanCount + summary.robotCount + summary.agentCount
              }/${summary.playerCount})`}
        </div>
        {joinable && (
          <button
            className="btn btn--ghost tile-join"
            onClick={(event) => {
              // The tile itself spectates; this takes a seat instead.
              event.stopPropagation();
              joinGame(summary.gameId, true);
            }}
          >
            take a seat ({seatsLeft})
          </button>
        )}
      </div>
      <div className="tile-meta">
        <span>
          <GridIcon />
        </span>
        <span>
          {summary.boardSize}x{summary.boardSize}
        </span>
        {summary.winningSequenceCount > 1 && (
          <span
            title={`${summary.winningSequenceCount} sequences of ${summary.winningSequenceLength} to win`}
          >
            {summary.winningSequenceCount}×{summary.winningSequenceLength}
          </span>
        )}
        {summary.teamCount > 0 && <span>{summary.teamCount} teams</span>}
        <span>
          <UserIcon />
        </span>
        <span>{summary.humanCount}</span>
        {summary.robotCount > 0 && (
          <>
            <span>
              <RobotIcon />
            </span>
            <span>{summary.robotCount}</span>
          </>
        )}
        {summary.agentCount > 0 && (
          <>
            <span title="ai agents connected over mcp">
              <AgentIcon />
            </span>
            <span>{summary.agentCount}</span>
          </>
        )}
        <span>
          <GlassesIcon />
        </span>
        <span>{summary.spectatorCount}</span>
      </div>
    </div>
  );
};

const Listing = () => {
  const playing = useAppSelector(getCurrentlyPlayingGames);
  const spectating = useAppSelector(getCurrentlySpectatingGames);
  const lobby = useAppSelector(getLobbyGames);

  // Everything running on the server that I am not already part of.
  const watchable = lobby.filter(
    (summary) =>
      !spectating.includes(summary.gameId) &&
      !playing.includes(summary.gameId)
  );
  const open = watchable.filter(
    (summary) =>
      summary.openSeats &&
      summary.status === GameStatus.WAITING_FOR_PLAYERS &&
      summary.playerCount >
        summary.humanCount + summary.robotCount + summary.agentCount
  );
  const rest = watchable.filter((summary) => !open.includes(summary));

  return (
    <div>
      {playing.length > 0 && (
        <div>
          <div className="rail-title">your games</div>
          {playing.map((each: string) => (
            <GameTile gameId={each} key={each} />
          ))}
        </div>
      )}
      {spectating.length > 0 && (
        <div>
          <div className="rail-title">spectating</div>
          {spectating.map((each: string) => (
            <GameTile gameId={each} key={each} />
          ))}
        </div>
      )}
      <div>
        <div className="rail-title">open to anyone</div>
        {open.length === 0 ? (
          <p className="dim">
            no open games right now - start one and tick "let strangers
            join"
          </p>
        ) : (
          open.map((summary) => (
            <LiveGameTile key={summary.gameId} summary={summary} />
          ))
        )}
      </div>
      <div>
        <div className="rail-title">live on the server</div>
        {rest.length === 0 ? (
          <p className="dim">nothing else running at the moment</p>
        ) : (
          rest.map((summary) => (
            <LiveGameTile key={summary.gameId} summary={summary} />
          ))
        )}
      </div>
    </div>
  );
};

export default Listing;
