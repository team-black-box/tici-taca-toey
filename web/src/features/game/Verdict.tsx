import { useMemo } from "react";
import { useAppSelector } from "../../state/store";
import { getActiveGame } from "../../state/games";
import { Game, COMPLETED_GAME_STATUS, PlayerKind } from "../../common/model";
import { decodeTtn } from "../../common/ttn";
import { analyseGame, cellName } from "../../common/analysis";
import { replayPath } from "../../common/replay";
import { navigate } from "../../common/router";

// What decided the game you just finished, on the screen you are already
// looking at.
//
// The analysis shipped only inside the replay viewer, which meant you
// had to already know it existed and go looking - and the one moment
// anybody actually wants to hear "here is where you lost it" is the
// moment the board stops. So it is said here, and the button takes you
// to that exact move rather than to the start of a replay.
const Verdict = () => {
  const game: Game | undefined = useAppSelector(getActiveGame);
  const players = useAppSelector((state) => state.players);

  const analysis = useMemo(() => {
    if (!game?.notation) {
      return null;
    }
    try {
      return analyseGame(decodeTtn(game.notation));
    } catch {
      // An unreadable line is not worth breaking the endgame screen for.
      return null;
    }
  }, [game?.notation]);

  if (
    !game ||
    !game.notation ||
    !COMPLETED_GAME_STATUS.includes(game.status) ||
    !analysis?.turningPoint
  ) {
    return null;
  }

  const turningPoint = analysis.turningPoint;
  const cell = turningPoint.missedWin ?? turningPoint.missedBlock!;
  const who =
    players[game.players[turningPoint.seat]]?.name ??
    `seat ${turningPoint.seat + 1}`;

  const roster = game.players.map((playerId, seat) => ({
    seat,
    handle: players[playerId]?.name ?? "",
    kind: players[playerId]?.kind ?? PlayerKind.HUMAN,
  }));

  return (
    <p className="replay-note">
      {turningPoint.missedWin ? (
        <>
          <b>{who}</b> could have won at <b>{cellName(cell.x, cell.y)}</b> on
          move {turningPoint.index + 1}.
        </>
      ) : (
        <>
          <b>{who}</b> left <b>{cellName(cell.x, cell.y)}</b> open on move{" "}
          {turningPoint.index + 1} - that is where it turned.
        </>
      )}{" "}
      <button
        className="btn btn--ghost btn--tiny"
        onClick={() =>
          navigate(
            replayPath(game.notation as string, roster, turningPoint.index + 1)
          )
        }
      >
        see it
      </button>
    </p>
  );
};

export default Verdict;
