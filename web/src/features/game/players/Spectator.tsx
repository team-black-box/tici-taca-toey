import { useAppSelector } from "../../../state/store";
import { getPlayer } from "../../../state/players";
import Avatar from "../../../common/avatar";

export interface SpectatorProps {
  playerId: string;
  players: string[];
}

const Spectator = ({ playerId }: SpectatorProps) => {
  const playerName = useAppSelector(getPlayer(playerId))?.name;
  return (
    <div className="player-card">
      <Avatar name={playerName ?? ""} />
      {playerName && <div className="name">{playerName}</div>}
    </div>
  );
};

export default Spectator;
