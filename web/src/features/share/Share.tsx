import { useState, useEffect } from "react";
import QrCode from "../../common/qr";
import { GameInteractionTypes, GameStatus } from "../../common/model";
import { ShareIcon, LinkIcon } from "../../common/icons";

interface ShareProps {
  gameId: string;
  gameStatus: GameStatus;
}

const Share = ({ gameId, gameStatus }: ShareProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [interactionType, setInteractionType] = useState(
    gameStatus === GameStatus.WAITING_FOR_PLAYERS
      ? GameInteractionTypes.PLAY
      : GameInteractionTypes.SPECTATE
  );

  useEffect(() => {
    if (gameStatus !== GameStatus.WAITING_FOR_PLAYERS) {
      setInteractionType(GameInteractionTypes.SPECTATE);
    }
  }, [gameStatus]);

  const url = `${window.location.origin}/${interactionType}/${gameId}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch (error) {
      console.error("Could not copy to clipboard", error);
    }
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setIsOpen(false);
    }, 900);
  };

  return (
    <div className="share">
      <button
        className={`btn ${isOpen ? "" : "btn--ghost"}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        invite <ShareIcon />
      </button>
      {isOpen && (
        <div className="popover">
          <div className="qr-card">
            <QrCode value={url} />
          </div>
          <div className="pills">
            {gameStatus === GameStatus.WAITING_FOR_PLAYERS && (
              <span
                className={`pill ${
                  interactionType === GameInteractionTypes.PLAY ? "is-on" : ""
                }`}
                onClick={() => setInteractionType(GameInteractionTypes.PLAY)}
              >
                play
              </span>
            )}
            <span
              className={`pill ${
                interactionType === GameInteractionTypes.SPECTATE
                  ? "is-on"
                  : ""
              }`}
              onClick={() => setInteractionType(GameInteractionTypes.SPECTATE)}
            >
              spectate
            </span>
          </div>
          <button className="btn" onClick={copyLink}>
            {copied ? (
              "copied!"
            ) : (
              <>
                copy link <LinkIcon />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default Share;
