import { useEffect, useState } from "react";
import { getServerHttpBase } from "../../state/socket";
import { RobotIcon } from "../../common/icons";

// Public rows carry handles only - the server never exposes player ids.
interface Row {
  handle: string;
  isRobot: boolean;
  rating: number;
  games: number;
}

// Top hackers, from the server's HTTP API. "global" is the headline pool:
// every game feeds it, with rating movement scaled by the game's
// difficulty; the per-configuration pools remain selectable.
const Leaderboard = () => {
  const [pool, setPool] = useState("global");
  const [pools, setPools] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(
          `${getServerHttpBase()}/leaderboard?pool=${encodeURIComponent(pool)}&limit=10`
        );
        const data = await response.json();
        if (!cancelled) {
          setRows(data.rows ?? []);
          setPools(data.pools ?? []);
        }
      } catch {
        // server without a db, or offline - the panel just stays empty
      }
    };
    load();
    const interval = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pool]);

  if (rows.length === 0 && pools.length === 0) {
    return null;
  }

  return (
    <div className="panel">
      <h2 className="panel-title">leaderboard</h2>
      {pools.length > 1 && (
        <select value={pool} onChange={(event) => setPool(event.target.value)}>
          {(pools.includes(pool) ? pools : [pool, ...pools]).map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      )}
      <ol className="board-list">
        {rows.map((row, index) => (
          <li key={`${row.handle}-${index}`} className="board-row">
            <span className="dim">{index + 1}</span>
            <span className="board-handle">
              {row.handle}
              {row.isRobot && <RobotIcon className="dim" />}
            </span>
            <span className="board-rating">{row.rating}</span>
          </li>
        ))}
      </ol>
    </div>
  );
};

export default Leaderboard;
