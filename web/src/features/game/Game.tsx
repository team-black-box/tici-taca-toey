import Status from "./status/Status";
import Board from "./board/Board";
import Players from "./players/Players";
import { useAppSelector } from "../../state/store";
import { getActiveGameId } from "../../state/currentPlayer";
import { startRobotGame } from "../../state/actions";
import { RobotIcon } from "../../common/icons";

// First run: teach the game and get a visitor into a match in one click.
const Welcome = () => (
  <div className="welcome panel">
    <h2 className="panel-title">welcome</h2>
    <p>
      tic-tac-toe, the way it should have shipped: boards from 2 to 12,
      up to 10 players, win sequences you choose, chess clocks optional.
    </p>
    <p>
      robots are standing by. humans join by link. spectators lurk. every
      finished game becomes a replayable one-liner.
    </p>
    <div className="welcome-actions">
      <button className="btn" onClick={startRobotGame}>
        play a robot now <RobotIcon />
      </button>
      <span className="dim">
        or start a custom game on the left · press ? for help
      </span>
    </div>
  </div>
);

const Game = () => {
  const activeGameId: string = useAppSelector(getActiveGameId);
  return activeGameId ? (
    <div>
      <Status />
      <Board />
      <Players />
    </div>
  ) : (
    <Welcome />
  );
};

export default Game;
