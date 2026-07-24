import { Game } from "../../common/model";
import { getStatusForViewer } from "../../common/status";
import { useAppSelector } from "../../state/store";
import { getGame } from "../../state/games";
import {
  getActiveGameId,
  getCurrentPlayerId,
} from "../../state/currentPlayer";
import { setActiveGame } from "../../state/actions";
import { GridIcon, UserIcon, GlassesIcon } from "../../common/icons";
import { navigate } from "../../common/router";
import { replayPath } from "../../common/replay";
import { GameStatus, PlayerKind } from "../../common/model";

interface GameTileProps {
  gameId: string;
}

const GameTile = ({ gameId }: GameTileProps) => {
  const game: Game | undefined = useAppSelector((state) =>
    getGame(state, gameId)
  );
  const activeGameId: string = useAppSelector(getActiveGameId);
  const viewerId: string = useAppSelector(getCurrentPlayerId);
  const players = useAppSelector((state) => state.players);
  if (!game) {
    return null;
  }
  const gameStatus = getStatusForViewer(game, viewerId, players);
  const yourMove =
    game.turn === viewerId && activeGameId !== gameId && viewerId !== "";
  return (
    <div
      className={`tile ${activeGameId === gameId ? "is-active" : ""} ${
        game.status === GameStatus.GAME_IN_PROGRESS ? "tile--active" : ""
      }`}
      onClick={() => setActiveGame(gameId)}
    >
      <div>
        <div className="tile-name">
          {game.name}
          {/* A game in play shows a little life, so the rail reads as busy
              at a glance without opening anything. */}
          {game.status === GameStatus.GAME_IN_PROGRESS && (
            <span className="activity" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          )}
        </div>
        <div className={gameStatus.className}>{gameStatus.text}</div>
        {yourMove && <div className="your-move">▮ your move</div>}
        {game.notation &&
          [
            GameStatus.GAME_WON,
            GameStatus.GAME_ENDS_IN_A_DRAW,
            GameStatus.GAME_WON_BY_TIMEOUT,
          ].includes(game.status) && (
            <button
              className="btn btn--ghost tile-replay"
              onClick={(event) => {
                event.stopPropagation();
                // The notation knows the seats; the store knows who sat in
                // them. Hand both to the replay.
                navigate(
                  replayPath(
                    game.notation as string,
                    game.players.map((playerId, seat) => ({
                      seat,
                      handle: players[playerId]?.name ?? "",
                      kind: players[playerId]?.kind ?? PlayerKind.HUMAN,
                    }))
                  )
                );
              }}
            >
              replay
            </button>
          )}
      </div>
      <div className="tile-meta">
        <span>
          <GridIcon />
        </span>
        <span>
          {game.boardSize}x{game.boardSize}
        </span>
        <span>
          <UserIcon />
        </span>
        <span>{game.playerCount}</span>
        <span>
          <GlassesIcon />
        </span>
        <span>{game.spectators.length}</span>
      </div>
    </div>
  );
};

export default GameTile;
