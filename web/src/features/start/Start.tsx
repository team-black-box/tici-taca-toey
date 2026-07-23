import { useState } from "react";
import { startGame } from "../../state/actions";
import { extractValueAndSet } from "../../common/extractValueAndSet";
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

const Start = () => {
  const [name, setName] = useState(DEFAULT_GAME_NAME);
  const [boardSize, setBoardSize] = useState("3");
  const [playerCount, setPlayerCount] = useState("2");
  const [winningSequenceLength, setWinningSequenceLength] = useState("3");
  const [timed, setTimed] = useState(false);
  const [timePerPlayer, setTimePerPlayer] = useState("180000");
  const [incrementPerPlayer, setIncrementPerPlayer] = useState("1000");

  const startGameDelegate = () => {
    startGame(
      name,
      Number(boardSize),
      Number(playerCount),
      Number(winningSequenceLength),
      timed ? Number(timePerPlayer) : undefined,
      timed ? Number(incrementPerPlayer) : undefined
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
      <div className="field">
        <label htmlFor="start-winlen">win sequence</label>
        <input
          id="start-winlen"
          type="number"
          max={Number(boardSize)}
          min={3}
          value={winningSequenceLength}
          onChange={extractValueAndSet(setWinningSequenceLength)}
        />
      </div>
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
