import { useState } from "react";
import { extractValueAndSet } from "../../common/extractValueAndSet";
import { joinGame, spectateGame } from "../../state/actions";
import { GameInteractionTypes } from "../../common/model";

const getGameIdAndInteractionType = (url: string) => {
  const uriComponents = url.split("/");
  if (uriComponents.length === 5) {
    return {
      type: uriComponents[3],
      gameId: uriComponents[4],
    };
  }
};

const Join = () => {
  const [url, setUrl] = useState("");
  const clearGameId = () => setUrl("");

  const gameIdAndType = getGameIdAndInteractionType(url);

  return (
    <div className="panel">
      <h2 className="panel-title">join / spectate</h2>
      <div className="field">
        <label htmlFor="join-link">game link</label>
        <input
          id="join-link"
          type="text"
          placeholder="paste game link"
          onChange={extractValueAndSet(setUrl)}
          value={url}
        />
      </div>
      {gameIdAndType?.type && (
        <button
          className="btn"
          onClick={() => {
            if (gameIdAndType?.type && gameIdAndType?.gameId) {
              if (gameIdAndType.type === GameInteractionTypes.PLAY) {
                joinGame(gameIdAndType.gameId);
              } else if (gameIdAndType.type === GameInteractionTypes.SPECTATE) {
                spectateGame(gameIdAndType.gameId);
              }
            }
            clearGameId();
          }}
        >
          {gameIdAndType?.type === GameInteractionTypes.PLAY
            ? "Join"
            : gameIdAndType?.type === GameInteractionTypes.SPECTATE
            ? "Spectate"
            : "Join / Spectate"}
        </button>
      )}
    </div>
  );
};

export default Join;
