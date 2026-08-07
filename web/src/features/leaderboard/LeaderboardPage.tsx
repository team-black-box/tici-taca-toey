import { useEffect, useMemo, useState } from "react";
import { getServerHttpBase } from "../../state/socket";
import { navigate } from "../../common/router";
import { KindIcon, kindLabel } from "../../common/kind";
import { PlayerKind } from "../../common/model";

// The full standings, as a table you can sort. Rows are keyed by handle -
// the identity a player chose to publish - so every row is clickable
// through to that player's games.

export interface LeaderboardRow {
  handle: string;
  kind: PlayerKind;
  rating: number;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
}

type SortKey = keyof Omit<LeaderboardRow, "kind">;

interface Column {
  key: SortKey;
  label: string;
  numeric: boolean;
}

const COLUMNS: Column[] = [
  { key: "handle", label: "player", numeric: false },
  { key: "rating", label: "rating", numeric: true },
  { key: "games", label: "games", numeric: true },
  { key: "wins", label: "won", numeric: true },
  { key: "draws", label: "drawn", numeric: true },
  { key: "losses", label: "lost", numeric: true },
  { key: "winRate", label: "win %", numeric: true },
];

const LeaderboardPage = () => {
  const [pool, setPool] = useState("global");
  const [pools, setPools] = useState<string[]>([]);
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("rating");
  const [ascending, setAscending] = useState(false);
  const [who, setWho] = useState<"all" | "humans" | "machines">("all");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(
          `${getServerHttpBase()}/api/leaderboard?pool=${encodeURIComponent(
            pool
          )}&limit=200`
        );
        const data = await response.json();
        if (!cancelled) {
          setRows(data.rows ?? []);
          setPools(data.pools ?? []);
          setLoaded(true);
        }
      } catch {
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
  }, [pool]);

  // Humans and machines share one board on purpose - a robot beating you
  // should sting - but "how am I doing against people" and "how good are
  // the machines" are different questions, and mixing them answers
  // neither. Filtering is a view, never a separate rating.
  const visible = useMemo(
    () =>
      rows.filter((row) =>
        who === "all"
          ? true
          : who === "humans"
          ? row.kind === PlayerKind.HUMAN
          : row.kind !== PlayerKind.HUMAN
      ),
    [rows, who]
  );

  const sorted = useMemo(() => {
    const copy = [...visible];
    copy.sort((a, b) => {
      const left = a[sortKey];
      const right = b[sortKey];
      const compared =
        typeof left === "string" && typeof right === "string"
          ? left.localeCompare(right)
          : Number(left) - Number(right);
      return ascending ? compared : -compared;
    });
    return copy;
  }, [visible, sortKey, ascending]);

  const sortBy = (key: SortKey) => {
    if (key === sortKey) {
      setAscending(!ascending);
      return;
    }
    setSortKey(key);
    // Names read naturally A-Z; everything else is most-first.
    setAscending(key === "handle");
  };

  return (
    <div>
      <div className="status-row">
        <div className="game-name">leaderboard</div>
        {pools.length > 0 && (
          <select
            value={pool}
            onChange={(event) => setPool(event.target.value)}
            aria-label="rating pool"
          >
            {(pools.includes(pool) ? pools : [pool, ...pools]).map((name) => (
              <option key={name} value={name}>
                {name === "global" ? "global (all games)" : name}
              </option>
            ))}
          </select>
        )}
        <span className="seg">
          {(["all", "humans", "machines"] as const).map((option) => (
            <button
              key={option}
              className={`btn btn--ghost ${who === option ? "is-on" : ""}`}
              onClick={() => setWho(option)}
            >
              {option}
            </button>
          ))}
        </span>
        <button className="btn btn--ghost" onClick={() => navigate("/")}>
          &lt; lobby
        </button>
      </div>

      {who === "machines" && (
        <p className="dim">
          robots play through the{" "}
          <a
            href="https://github.com/team-black-box/tici-taca-toey/tree/main/sdk"
            target="_blank"
            rel="noopener noreferrer"
          >
            robot sdk
          </a>{" "}
          in about ten lines; agents connect over{" "}
          <a
            href="https://github.com/team-black-box/tici-taca-toey/tree/main/mcp"
            target="_blank"
            rel="noopener noreferrer"
          >
            mcp
          </a>{" "}
          with just a url. <b>cloney</b> was trained on the public game
          corpus - every finished game here feeds it.
        </p>
      )}

      {pool === "global" && (
        <p className="dim">
          one rating across every game, weighted by how hard the game was -
          bigger boards, longer sequences, more players and clocks all move
          it further. pick a pool above for a single configuration.
        </p>
      )}

      {loaded && sorted.length === 0 && (
        <div className="stage-empty">
          no rated games yet - play one and you are on the board
        </div>
      )}

      {sorted.length > 0 && (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th className="table-rank">#</th>
                {COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    className={column.numeric ? "table-num" : ""}
                  >
                    <button
                      className={`table-sort ${
                        sortKey === column.key ? "is-active" : ""
                      }`}
                      onClick={() => sortBy(column.key)}
                      aria-label={`sort by ${column.label}`}
                    >
                      {column.label}
                      {sortKey === column.key && (
                        <span aria-hidden="true">{ascending ? "▲" : "▼"}</span>
                      )}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, index) => (
                <tr
                  key={row.handle}
                  className="table-row"
                  onClick={() => navigate(`/player/${row.handle}`)}
                  title={`${row.handle} - ${kindLabel(row.kind)} - see their games`}
                >
                  <td className="table-rank dim">{index + 1}</td>
                  <td>
                    <span className="table-handle">
                      {row.handle}
                      <KindIcon kind={row.kind} />
                    </span>
                  </td>
                  <td className="table-num accent">{row.rating}</td>
                  <td className="table-num">{row.games}</td>
                  <td className="table-num">{row.wins}</td>
                  <td className="table-num">{row.draws}</td>
                  <td className="table-num">{row.losses}</td>
                  <td className="table-num">{row.winRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="dim">click a player to watch their games</p>
    </div>
  );
};

export default LeaderboardPage;
