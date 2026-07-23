import { useEffect, useState } from "react";
import { getServerHttpBase } from "../../state/socket";
import { navigate } from "../../common/router";
import { KindIcon } from "../../common/kind";
import { PlayerKind } from "../../common/model";

// Public rows carry handles only - the server never exposes player ids.
interface Row {
  handle: string;
  kind: PlayerKind;
  rating: number;
  games: number;
}

// The top few, as a teaser for the full standings page. "global" is the
// headline pool: every game feeds it, with rating movement scaled by the
// game's difficulty.
const Leaderboard = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(
          `${getServerHttpBase()}/api/leaderboard?pool=global&limit=5`
        );
        const data = await response.json();
        if (!cancelled) {
          setRows(data.rows ?? []);
          setLoaded(true);
        }
      } catch {
        // server without a db, or offline - the panel shows its empty state
        if (!cancelled) {
          setLoaded(true);
        }
      }
    };
    load();
    const interval = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="panel">
      <h2 className="panel-title">leaderboard</h2>
      {loaded && rows.length === 0 && (
        <p className="dim">
          no rated games yet - win one and you are on the board
        </p>
      )}
      <ol className="board-list">
        {rows.map((row, index) => (
          <li
            key={row.handle}
            className="board-row board-row--link"
            onClick={() => navigate(`/player/${row.handle}`)}
            title={`${row.handle} - see their games`}
          >
            <span className="dim">{index + 1}</span>
            <span className="board-handle">
              {row.handle}
              <KindIcon kind={row.kind} />
            </span>
            <span className="board-rating">{row.rating}</span>
          </li>
        ))}
      </ol>
      <button
        className="btn btn--ghost"
        onClick={() => navigate("/leaderboard")}
      >
        full standings &gt;
      </button>
    </div>
  );
};

export default Leaderboard;
