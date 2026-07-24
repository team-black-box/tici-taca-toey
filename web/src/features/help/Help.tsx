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
              tic-tac-toe with the dials exposed. take turns placing your
              mark; win by making a <b>line</b> - marks in a row across,
              down, or diagonally - before anyone else.
            </p>
            <p>
              two settings decide what winning means, and the game always
              spells the goal out under its name:
            </p>
            <ul>
              <li>
                <b>in a row</b> - how long a line has to be. 3 is classic
                tic-tac-toe; on a big board try 4 or 5.
              </li>
              <li>
                <b>lines to win</b> - how many separate lines you need.
                usually 1. set it to 2+ and the game keeps going until
                someone completes that many (lines may cross, like a
                crossword).
              </li>
            </ul>
            <p>
              boards go 2-12, players 2-10. in a <b>team</b> game your
              teammates' marks count toward the same lines. timed games run
              chess clocks: run out and you lose. <b>gg</b> forfeits.
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
