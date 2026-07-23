import { CSSProperties, useEffect, useMemo, useState } from "react";
import { decodeTtn, boardAtFrame } from "../../common/ttn";
import { GAME_SYMBOL } from "../../common/symbol";
import { navigate } from "../../common/router";

// Step through any TTN line. Pure client-side: the URL is the replay.
const Replay = ({ ttn }: { ttn: string }) => {
  const decoded = useMemo(() => {
    try {
      return decodeTtn(decodeURIComponent(ttn));
    } catch {
      return null;
    }
  }, [ttn]);

  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);
  const total = decoded?.moves.length ?? 0;

  useEffect(() => {
    if (!playing || !decoded) {
      return;
    }
    const interval = setInterval(() => {
      setFrame((value) => {
        if (value >= total) {
          setPlaying(false);
          return value;
        }
        return value + 1;
      });
    }, 900);
    return () => clearInterval(interval);
  }, [playing, decoded, total]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        setFrame((value) => Math.min(total, value + 1));
      }
      if (event.key === "ArrowLeft") {
        setFrame((value) => Math.max(0, value - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total]);

  if (!decoded) {
    return (
      <div className="stage-empty">
        that is not a valid TTN line - nothing to replay
      </div>
    );
  }

  const positions = boardAtFrame(decoded, frame);
  const lastMove = frame > 0 ? decoded.moves[frame - 1] : null;
  const thinkTime =
    lastMove && !lastMove.skip && lastMove.clockMs > 0
      ? `${(lastMove.clockMs / 1000).toFixed(1)}s`
      : null;
  const resultText =
    decoded.result.kind === "draw"
      ? "draw"
      : decoded.result.kind === "abandoned"
      ? "abandoned"
      : `${GAME_SYMBOL[decoded.result.winnerSeat! % 10].symbol} wins${
          decoded.result.kind === "timeout" ? " on time" : ""
        }`;

  return (
    <div>
      <div className="status-row">
        <div className="game-name">replay</div>
        <div className="badge badge--done">
          {frame}/{total} · {resultText}
          {thinkTime ? ` · thought ${thinkTime}` : ""}
        </div>
        <button className="btn btn--ghost" onClick={() => navigate("/")}>
          &lt; lobby
        </button>
      </div>
      <div
        className="board"
        style={{ "--n": decoded.boardSize } as CSSProperties}
      >
        {positions.flat().map((cell, index) => {
          const seat = cell === "-" ? -1 : Number(cell);
          const symbol = seat >= 0 ? GAME_SYMBOL[seat % 10] : null;
          return (
            <div
              key={index}
              className={`cell ${symbol ? symbol.color : ""}`}
            >
              {symbol?.symbol ?? ""}
            </div>
          );
        })}
      </div>
      <div className="replay-controls">
        <button className="btn btn--ghost" onClick={() => { setPlaying(false); setFrame(0); }}>
          |&lt;
        </button>
        <button className="btn btn--ghost" onClick={() => { setPlaying(false); setFrame(Math.max(0, frame - 1)); }}>
          &lt;
        </button>
        <button className="btn" onClick={() => setPlaying(!playing)}>
          {playing ? "pause" : "play"}
        </button>
        <button className="btn btn--ghost" onClick={() => { setPlaying(false); setFrame(Math.min(total, frame + 1)); }}>
          &gt;
        </button>
        <button className="btn btn--ghost" onClick={() => { setPlaying(false); setFrame(total); }}>
          &gt;|
        </button>
      </div>
      <p className="dim">arrow keys step · the URL is the replay - share it</p>
    </div>
  );
};

export default Replay;
