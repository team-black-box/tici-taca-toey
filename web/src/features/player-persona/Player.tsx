import { useAppSelector } from "../../state/store";
import { getCurrentPlayerName } from "../../state/currentPlayer";
import { updateCurrentPlayerName, claimHandle } from "../../state/actions";
import Avatar from "../../common/avatar";

const Player = () => {
  const name = useAppSelector(getCurrentPlayerName);

  return (
    <div className="persona">
      <input
        id="handle"
        name="handle"
        type="text"
        autoComplete="off"
        value={name}
        onChange={(event) => updateCurrentPlayerName(event.target.value)}
        onKeyDown={(event) => {
          // Enter claims the handle: unique, leaderboard-worthy.
          if (event.key === "Enter" && name.trim()) {
            claimHandle(name.trim());
          }
        }}
        placeholder="handle + enter to claim"
        aria-label="your handle - press enter to claim it"
      />
      <Avatar name={name} />
    </div>
  );
};

export default Player;
