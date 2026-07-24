import { useState } from "react";
import { startGame } from "../../state/actions";
import { extractValueAndSet } from "../../common/extractValueAndSet";
import { describeGoal } from "../../common/rules";
import { PaperPlaneIcon } from "../../common/icons";

const DEFAULT_GAME_NAME = "My Amazing Game";

const TIME_CHOICES = [
  { label: "1 min", ms: 60_000 },
  { label: "3 min", ms: 180_000 },
  { label: "5 min", ms: 300_000 },
  { label: "10 min", ms: 600_000 },
];

const INCREMENT_CHOICES = [
  { label: "+0s", ms: 0 },
  { label: "+1s", ms: 1_000 },
  { label: "+2s", ms: 2_000 },
  { label: "+5s", ms: 5_000 },
];

// Equal teams only: valid team counts divide the players into sides of at
// least two.
const teamChoicesFor = (playerCount: number): number[] =>
  Array.from({ length: playerCount }, (_, index) => index + 2).filter(
    (teams) => playerCount % teams === 0 && teams <= playerCount / 2
  );

const Start = () => {
  const [name, setName] = useState(DEFAULT_GAME_NAME);
  const [boardSize, setBoardSize] = useState("3");
  const [playerCount, setPlayerCount] = useState("2");
  const [winningSequenceLength, setWinningSequenceLength] = useState("3");
  const [winningSequenceCount, setWinningSequenceCount] = useState("1");
  const [teamCount, setTeamCount] = useState("0");
  const [openToStrangers, setOpenToStrangers] = useState(false);
  const [showCursors, setShowCursors] = useState(false);
  const [timed, setTimed] = useState(false);
  const [timePerPlayer, setTimePerPlayer] = useState("180000");
  const [incrementPerPlayer, setIncrementPerPlayer] = useState("1000");

  const teamChoices = teamChoicesFor(Number(playerCount));
  const chosenTeams = teamChoices.includes(Number(teamCount))
    ? Number(teamCount)
    : 0;

  const startGameDelegate = () => {
    startGame(
      name,
      Number(boardSize),
      Number(playerCount),
      Number(winningSequenceLength),
      timed ? Number(timePerPlayer) : undefined,
      timed ? Number(incrementPerPlayer) : undefined,
      Number(winningSequenceCount) > 1
        ? Number(winningSequenceCount)
        : undefined,
      chosenTeams > 0 ? chosenTeams : undefined,
      openToStrangers,
      showCursors
    );
  };

  return (
    <div className="panel">
      <h2 className="panel-title">start new game</h2>
      <div className="field">
        <label htmlFor="start-name">game name</label>
        <input
          id="start-name"
          type="text"
          placeholder="name your game"
          value={name}
          onChange={extractValueAndSet(setName)}
        />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="start-board">board size</label>
          <input
            id="start-board"
            type="number"
            max={12}
            min={3}
            value={boardSize}
            onChange={extractValueAndSet(setBoardSize)}
          />
        </div>
        <div className="field">
          <label htmlFor="start-players">players</label>
          <input
            id="start-players"
            type="number"
            min={2}
            max={10}
            value={playerCount}
            onChange={extractValueAndSet(setPlayerCount)}
          />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="start-winlen">in a row</label>
          <input
            id="start-winlen"
            type="number"
            max={Number(boardSize)}
            min={2}
            value={winningSequenceLength}
            onChange={extractValueAndSet(setWinningSequenceLength)}
            title="how many of your marks in a line - across, down, or diagonal - make one sequence"
          />
        </div>
        <div className="field">
          <label htmlFor="start-wincount">lines to win</label>
          <input
            id="start-wincount"
            type="number"
            min={1}
            max={10}
            value={winningSequenceCount}
            onChange={extractValueAndSet(setWinningSequenceCount)}
            title="how many separate lines you need to win - usually 1"
          />
        </div>
      </div>
      {/* Live plain-language preview of the win condition. */}
      <p className="goal-preview">
        goal:{" "}
        {describeGoal({
          boardSize: Number(boardSize) || 0,
          winningSequenceLength: Number(winningSequenceLength) || 0,
          winningSequenceCount: Number(winningSequenceCount) || 1,
          teamCount: chosenTeams,
        })}
      </p>
      {teamChoices.length > 0 && (
        <div className="field">
          <label htmlFor="start-teams">teams</label>
          <select
            id="start-teams"
            value={String(chosenTeams)}
            onChange={extractValueAndSet(setTeamCount)}
          >
            <option value="0">no teams</option>
            {teamChoices.map((teams) => (
              <option key={teams} value={teams}>
                {teams} teams of {Number(playerCount) / teams}
              </option>
            ))}
          </select>
        </div>
      )}
      <label className="check">
        <input
          type="checkbox"
          checked={openToStrangers}
          onChange={(event) => setOpenToStrangers(event.target.checked)}
        />
        let strangers join
      </label>
      <label
        className="check"
        title="everyone sees where everyone is hovering - including your opponents, so a hover can be a bluff"
      >
        <input
          type="checkbox"
          checked={showCursors}
          onChange={(event) => setShowCursors(event.target.checked)}
        />
        show cursors to everyone
      </label>
      {/* Say what it actually costs you, since it cannot be turned off
          once the game starts. Teammates and spectators see cursors
          either way - this is only about opponents. */}
      <p className="check-note">
        {showCursors
          ? "opponents will see your cursor - hover somewhere you do not mean it and that is a bluff"
          : "only teammates and spectators will see your cursor"}
      </p>
      <label className="check">
        <input
          type="checkbox"
          checked={timed}
          onChange={(event) => setTimed(event.target.checked)}
        />
        timed game
      </label>
      {timed && (
        <div className="field-row">
          <div className="field">
            <label htmlFor="start-time">time / player</label>
            <select
              id="start-time"
              value={timePerPlayer}
              onChange={extractValueAndSet(setTimePerPlayer)}
            >
              {TIME_CHOICES.map((choice) => (
                <option key={choice.ms} value={choice.ms}>
                  {choice.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="start-increment">increment</label>
            <select
              id="start-increment"
              value={incrementPerPlayer}
              onChange={extractValueAndSet(setIncrementPerPlayer)}
            >
              {INCREMENT_CHOICES.map((choice) => (
                <option key={choice.ms} value={choice.ms}>
                  {choice.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      <button className="btn" onClick={startGameDelegate}>
        start game <PaperPlaneIcon />
      </button>
    </div>
  );
};

export default Start;
