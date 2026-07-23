import { useAppSelector } from "../../../state/store";
import { getActiveGame } from "../../../state/games";
import ActivePlayer from "./ActivePlayer";
import Spectator from "./Spectator";

const Players = () => {
  const game = useAppSelector(getActiveGame);
  if (!game) {
    return null;
  }
  const { players, spectators, turn, teamCount } = game;

  // Team games group the roster by side; each side already shares a color
  // via getSideSymbol. Teamless games keep the single row.
  const teams =
    teamCount > 0
      ? Array.from({ length: teamCount }, (_, team) =>
          players.filter((_, seat) => seat % teamCount === team)
        )
      : [players];

  return (
    <div>
      {teams.map((teamPlayers, team) => (
        <div className="roster" key={team}>
          <div className="roster-title">
            {teamCount > 0 ? `team ${team + 1}` : "players"}
          </div>
          <div className="roster-row">
            {teamPlayers.map((each: string) => (
              <ActivePlayer
                key={each}
                playerId={each}
                players={players}
                turn={turn ?? ""}
                teamCount={teamCount}
              />
            ))}
          </div>
        </div>
      ))}
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
