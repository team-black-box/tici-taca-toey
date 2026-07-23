import GameTile from "./GameTile";
import { useAppSelector } from "../../state/store";
import {
  getCurrentlyPlayingGames,
  getCurrentlySpectatingGames,
} from "../../state/currentPlayer";
import { getLobbyGames } from "../../state/lobby";
import { spectateGame } from "../../state/actions";
import { GameSummary, GameStatus } from "../../common/model";
import { UserIcon, RobotIcon, GlassesIcon, GridIcon } from "../../common/icons";

// One row of the public lobby: name, size, who is at the table, one click
// to watch.
const LiveGameTile = ({ summary }: { summary: GameSummary }) => {
  const live = summary.status === GameStatus.GAME_IN_PROGRESS;
  return (
    <div
      className="tile tile--live"
      onClick={() => spectateGame(summary.gameId)}
      title="spectate"
    >
      <div>
        <div className="tile-name">{summary.name}</div>
        <div className={`badge ${live ? "badge--live" : "badge--wait"}`}>
          {live ? "LIVE" : `WAITING (${summary.humanCount + summary.robotCount}/${summary.playerCount})`}
        </div>
      </div>
      <div className="tile-meta">
        <span>
          <GridIcon />
        </span>
        <span>
          {summary.boardSize}x{summary.boardSize}
        </span>
        {summary.winningSequenceCount > 1 && (
          <span title={`${summary.winningSequenceCount} sequences of ${summary.winningSequenceLength} to win`}>
            {summary.winningSequenceCount}×{summary.winningSequenceLength}
          </span>
        )}
        {summary.teamCount > 0 && (
          <span>{summary.teamCount} teams</span>
        )}
        <span>
          <UserIcon />
        </span>
        <span>{summary.humanCount}</span>
        <span>
          <RobotIcon />
        </span>
        <span>{summary.robotCount}</span>
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
      {watchable.length > 0 && (
        <div>
          <div className="rail-title">live on the server</div>
          {watchable.map((summary) => (
            <LiveGameTile key={summary.gameId} summary={summary} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Listing;
