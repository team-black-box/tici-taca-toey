import { CSSProperties, useEffect, useMemo, useState } from "react";
import { decodeTtn, boardAtFrame } from "../../common/ttn";
import { GAME_SYMBOL } from "../../common/symbol";
import { describeGoal } from "../../common/rules";
import { navigate } from "../../common/router";
import { readRoster } from "../../common/replay";
import { KindIcon, kindLabel } from "../../common/kind";

// Step through any TTN line. Pure client-side: the URL is the replay.
// `search` carries the roster when the link was made from somewhere that
// knew it - see common/replay.ts.
const Replay = ({ ttn, search }: { ttn: string; search: string }) => {
  const decoded = useMemo(() => {
    try {
      return decodeTtn(decodeURIComponent(ttn));
    } catch {
      return null;
    }
  }, [ttn]);
  const roster = useMemo(() => readRoster(search), [search]);

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
  // Team games render by side: teammates share a symbol, and the result
  // names the team.
  const sideOf = (seat: number) =>
    decoded.teamCount > 0 ? seat % decoded.teamCount : seat;
  const resultText =
    decoded.result.kind === "draw"
      ? "draw"
      : decoded.result.kind === "abandoned"
      ? "abandoned"
      : `${
          decoded.result.winnerTeam !== undefined
            ? `team ${decoded.result.winnerTeam + 1}`
            : GAME_SYMBOL[decoded.result.winnerSeat! % 10].symbol
        } wins${decoded.result.kind === "timeout" ? " on time" : ""}`;
  // Who won, per seat: a team result crowns everyone on that team.
  const isWinner = (seat: number): boolean => {
    if (decoded.result.kind !== "win" && decoded.result.kind !== "timeout") {
      return false;
    }
    return decoded.result.winnerTeam !== undefined
      ? sideOf(seat) === decoded.result.winnerTeam
      : seat === decoded.result.winnerSeat;
  };
  const seats = Array.from({ length: decoded.playerCount }, (_, seat) => seat);
  // Whoever is about to move: replays are watched to see what someone did
  // next, so the seat on the clock is worth pointing at.
  const upNext =
    frame < total ? decoded.moves[frame]?.seat : undefined;

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
      {/* The same words the game header used while it was being played. */}
      <div className="objective">
        goal:{" "}
        {describeGoal({
          boardSize: decoded.boardSize,
          winningSequenceLength: decoded.winningSequenceLength,
          winningSequenceCount: decoded.winningSequenceCount,
          teamCount: decoded.teamCount,
        })}
        {decoded.timed ? " · timed" : ""}
      </div>
      {/* Who was which symbol. Without the roster in the link this still
          reads, as "seat 1" and friends. */}
      <div className="replay-seats">
        {seats.map((seat) => {
          const symbol = GAME_SYMBOL[sideOf(seat) % 10];
          const player = roster[seat];
          const won = isWinner(seat);
          return (
            <div
              key={seat}
              className={`replay-seat${won ? " is-winner" : ""}${
                seat === upNext ? " is-next" : ""
              }`}
              title={
                player
                  ? `${player.handle} (${kindLabel(player.kind)}) played ${
                      symbol.symbol
                    }`
                  : `seat ${seat + 1} played ${symbol.symbol}`
              }
            >
              <span className={`replay-seat-mark ${symbol.color}`}>
                {symbol.symbol}
              </span>
              <span className="replay-seat-name">
                {player ? player.handle : `seat ${seat + 1}`}
                {player ? <KindIcon kind={player.kind} /> : null}
              </span>
              {decoded.teamCount > 0 && (
                <span className="dim">team {sideOf(seat) + 1}</span>
              )}
              {won && <span className="replay-seat-won">won</span>}
            </div>
          );
        })}
      </div>
      <div
        className="board"
        style={{ "--n": decoded.boardSize } as CSSProperties}
      >
        {positions.flat().map((cell, index) => {
          const seat = cell === "-" ? -1 : Number(cell);
          const symbol = seat >= 0 ? GAME_SYMBOL[sideOf(seat) % 10] : null;
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
