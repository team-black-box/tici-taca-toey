import { CSSProperties, useMemo, useState } from "react";
import { dailyPuzzle, dayKey, shareDaily } from "../../common/daily";
import { cellName } from "../../common/analysis";
import { GAME_SYMBOL } from "../../common/symbol";
import { navigate } from "../../common/router";

// One position a day, the same for everyone, and nobody else required.
// Every other route into this game needs an opponent - which is a lot
// to ask of a first visit, and more on a quiet afternoon.
//
// Entirely local: the puzzle comes from the date, and so does everyone
// else's, so there is nothing to fetch and nothing to store. Progress
// lives in localStorage under the day, which also stops the board from
// resetting itself if you wander off and come back.
const storageKey = (day: string) => `daily:${day}`;

interface Progress {
  solved: boolean;
  guesses: number;
  wrong: string[];
}

const loadProgress = (day: string): Progress => {
  try {
    const raw = window.localStorage.getItem(storageKey(day));
    if (raw) {
      return JSON.parse(raw) as Progress;
    }
  } catch {
    // A blocked or full localStorage is not a reason to withhold a
    // puzzle - it just means today will not be remembered.
  }
  return { solved: false, guesses: 0, wrong: [] };
};

const saveProgress = (day: string, progress: Progress) => {
  try {
    window.localStorage.setItem(storageKey(day), JSON.stringify(progress));
  } catch {
    // see above
  }
};

const Daily = () => {
  const day = dayKey();
  const puzzle = useMemo(() => dailyPuzzle(day), [day]);
  const [progress, setProgress] = useState<Progress>(() => loadProgress(day));
  const [copied, setCopied] = useState(false);

  const mark = GAME_SYMBOL[0];
  const theirs = GAME_SYMBOL[1];

  const guess = (x: number, y: number) => {
    if (progress.solved || puzzle.positions[x][y] !== "-") {
      return;
    }
    const key = `${x}:${y}`;
    if (progress.wrong.includes(key)) {
      return;
    }
    const right = x === puzzle.solution.x && y === puzzle.solution.y;
    const next: Progress = {
      solved: right,
      guesses: progress.guesses + 1,
      wrong: right ? progress.wrong : [...progress.wrong, key],
    };
    setProgress(next);
    saveProgress(day, next);
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(
        shareDaily(puzzle, progress.solved, progress.guesses)
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard refused; the text is on screen to copy by hand.
    }
  };

  return (
    <div>
      <div className="status-row">
        <div className="game-name">daily</div>
        <div className="badge badge--done">{day}</div>
        {progress.solved && (
          <div className="badge badge--live">
            solved in {progress.guesses}{" "}
            {progress.guesses === 1 ? "try" : "tries"}
          </div>
        )}
        <button className="btn btn--ghost" onClick={() => navigate("/")}>
          &lt; lobby
        </button>
      </div>

      <div className="objective">
        goal: you are{" "}
        <span className={mark.color}>{mark.symbol}</span> - find the one move
        that wins, {puzzle.winningSequenceLength} in a row
      </div>

      <div
        className="board"
        style={{ "--n": puzzle.boardSize } as CSSProperties}
      >
        {puzzle.positions.flat().map((cell, index) => {
          const x = Math.floor(index / puzzle.boardSize);
          const y = index % puzzle.boardSize;
          const seat = cell === "-" ? -1 : Number(cell);
          const symbol = seat >= 0 ? GAME_SYMBOL[seat % 10] : null;
          const isWrong = progress.wrong.includes(`${x}:${y}`);
          const isSolution =
            progress.solved &&
            x === puzzle.solution.x &&
            y === puzzle.solution.y;
          const open = seat < 0 && !progress.solved && !isWrong;
          return (
            <button
              key={index}
              className={`cell ${
                isSolution ? mark.color : symbol ? symbol.color : ""
              } ${open ? "is-open" : ""} ${isWrong ? "is-wrong" : ""} ${
                isSolution ? "is-win" : ""
              }`}
              disabled={!open}
              aria-label={`${cellName(x, y)}${
                symbol ? `, ${symbol.symbol}` : ", empty"
              }`}
              onClick={() => guess(x, y)}
            >
              {isSolution ? mark.symbol : symbol?.symbol ?? ""}
            </button>
          );
        })}
      </div>

      {progress.solved ? (
        <>
          <p className="replay-note">
            <b>{cellName(puzzle.solution.x, puzzle.solution.y)}</b> - that is
            the one. see you tomorrow.
          </p>
          <div className="replay-controls">
            <button className="btn" onClick={share}>
              {copied ? "copied ✓" : "share result"}
            </button>
            <button className="btn btn--ghost" onClick={() => navigate("/")}>
              play a real game &gt;
            </button>
          </div>
        </>
      ) : (
        <p className="dim">
          {progress.wrong.length === 0
            ? `${theirs.symbol} moved last. one square ends it - tap it.`
            : `${progress.wrong.length} wrong so far. the win is still there.`}
        </p>
      )}
    </div>
  );
};

export default Daily;
