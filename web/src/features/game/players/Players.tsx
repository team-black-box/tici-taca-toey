import { useAppSelector } from "../../../state/store";
import {
  getActiveGamePlayers,
  getActiveGameSpectator,
  getActiveGameTurn,
} from "../../../state/games";
import ActivePlayer from "./ActivePlayer";
import Spectator from "./Spectator";

const Players = () => {
  const players = useAppSelector(getActiveGamePlayers);
  const spectators = useAppSelector(getActiveGameSpectator);
  const turn = useAppSelector(getActiveGameTurn);
  return (
    <div>
      <div className="roster">
        <div className="roster-title">players</div>
        <div className="roster-row">
          {players &&
            players.map((each: string) => (
              <ActivePlayer
                key={each}
                playerId={each}
                players={players}
                turn={turn ?? ""}
              />
            ))}
        </div>
      </div>
      {spectators && spectators.length > 0 && (
        <div className="roster">
          <div className="roster-title">spectators</div>
          <div className="roster-row">
            {spectators.map((each: string) => (
              <Spectator key={each} playerId={each} players={players ?? []} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Players;
