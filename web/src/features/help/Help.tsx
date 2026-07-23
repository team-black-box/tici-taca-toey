import { useEffect, useState } from "react";
import QrCode from "../../common/qr";
import { getPlayerKey } from "../../state/identity";

// The `> help` overlay: rules, robots, sharing, and device sync. Opens with
// the ? key, closes with Esc. Nothing modal ever blocks the board for long.
const Help = () => {
  const [open, setOpen] = useState(false);
  const [showSync, setShowSync] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        return;
      }
      if (event.key === "?") {
        setOpen((value) => !value);
      }
      if (event.key === "Escape") {
        setOpen(false);
        setShowSync(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const syncUrl = `${window.location.origin}/sync#${getPlayerKey()}`;

  return (
    <>
      <button
        className="help-toggle"
        onClick={() => setOpen(true)}
        aria-label="help"
      >
        ? help
      </button>
      {open && (
        <div className="overlay" onClick={() => setOpen(false)}>
          <div
            className="overlay-panel"
            role="dialog"
            aria-label="how to play"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-title">how to play</div>
            <p>
              line up <b>win sequence</b> marks in a row - across, down, or
              diagonal - before anyone else. boards go 2-12, players 2-10,
              and the win length is yours to pick. timed games run chess
              clocks: run out and you lose.
            </p>
            <p>
              press <b>+ robot</b> to summon an opponent: rando plays chaos,
              greedo blocks and pounces, minnie-max never loses a 3x3.
              share the invite link or QR to summon humans. watch anything
              under <b>live on the server</b>. play as many boards at once as
              you dare - tiles blink when it is your move.
            </p>
            <p>
              claim your handle by typing it top-right and pressing enter -
              claimed handles are unique and put you on the leaderboard.
              finished games replay from their notation line - press replay
              on any finished tile, or paste a TTN line at{" "}
              <code>/replay/&lt;ttn&gt;</code>.
            </p>
            <p>
              build your own robot in ~10 lines with the{" "}
              <a
                href="https://github.com/team-black-box/tici-taca-toey/tree/main/sdk"
                target="_blank"
                rel="noopener noreferrer"
              >
                robot sdk
              </a>
              .
            </p>
            <div className="panel-title">sync to another device</div>
            {showSync ? (
              <div className="sync-block">
                <div className="qr-card">
                  <QrCode value={syncUrl} />
                </div>
                <p className="dim">
                  scan on your phone to carry your identity, games, and
                  rating over. this code <b>is</b> your account - share it
                  with no one.
                </p>
              </div>
            ) : (
              <button className="btn btn--ghost" onClick={() => setShowSync(true)}>
                reveal sync code
              </button>
            )}
            <button className="btn overlay-close" onClick={() => setOpen(false)}>
              close [esc]
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Help;
