import { useState } from "react";
import { GameStatus, Game } from "../../../common/model";
import { useAppSelector } from "../../../state/store";
import { getLobbyRobots } from "../../../state/lobby";
import { getActiveGame } from "../../../state/games";
import { getCurrentPlayerId } from "../../../state/currentPlayer";
import { requestRobot } from "../../../state/actions";
import Share from "../../share/Share";
import { getStatusForViewer } from "../../../common/status";

interface GameStatusTagProps {
  game: Game;
}

const GameStatusTag = ({ game }: GameStatusTagProps) => {
  const viewerId = useAppSelector(getCurrentPlayerId);
  const players = useAppSelector((state) => state.players);
  const remainingPlayersToJoin = game.playerCount - game.players.length;
  const gameStatus = getStatusForViewer(game, viewerId, players);
  return (
    <div className={gameStatus.className}>
      {gameStatus.text}{" "}
      {game.status === GameStatus.WAITING_FOR_PLAYERS &&
        `(${remainingPlayersToJoin}/${game.playerCount})`}
    </div>
  );
};

// "+ robot" with an optional named pick when several robots fit the game.
const RobotPicker = ({ game }: { game: Game }) => {
  const robots = useAppSelector(getLobbyRobots);
  const [picked, setPicked] = useState("");
  const eligible = robots.filter(
    (robot) =>
      game.boardSize >= robot.boardSizes.min &&
      game.boardSize <= robot.boardSizes.max &&
      game.playerCount >= robot.playerCounts.min &&
      game.playerCount <= robot.playerCounts.max &&
      (!game.timed || robot.timed)
  );
  return (
    <span className="robot-picker">
      {eligible.length > 1 && (
        <select
          value={picked}
          onChange={(event) => setPicked(event.target.value)}
          aria-label="choose a robot"
        >
          <option value="">any robot</option>
          {eligible.map((robot) => (
            <option key={robot.name} value={robot.name}>
              {robot.name}
            </option>
          ))}
        </select>
      )}
      <button
        className="btn btn--ghost"
        onClick={() => requestRobot(game.gameId, picked || undefined)}
      >
        + robot
      </button>
    </span>
  );
};

const Status = () => {
  const game: Game | undefined = useAppSelector(getActiveGame);
  const currentPlayerId = useAppSelector(getCurrentPlayerId);
  if (!game) {
    return null;
  }
  const canAddRobot =
    game.status === GameStatus.WAITING_FOR_PLAYERS &&
    game.players.includes(currentPlayerId);
  return (
    <div className="status-row">
      <div className="game-name">{game.name}</div>
      <GameStatusTag game={game} />
      {canAddRobot && <RobotPicker game={game} />}
      {[GameStatus.GAME_IN_PROGRESS, GameStatus.WAITING_FOR_PLAYERS].includes(
        game.status
      ) && <Share gameId={game.gameId} gameStatus={game.status} />}
    </div>
  );
};

export default Status;
