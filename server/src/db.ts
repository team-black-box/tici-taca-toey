// Persistence for identities, handles, the game archive, and Elo ratings.
// Built on bun:sqlite (ships with Bun - zero new dependencies). One file,
// WAL mode, written only at registration/completion - gameplay itself never
// touches the database. See tasks/leaderboards-auth-replays.md.
import { Database } from "bun:sqlite";
import { Game, GameStatus, PlayerKind } from "./model";
import { generateHandle } from "../../shared/handles";

export const HANDLE_PATTERN = /^[a-z0-9_-]{2,20}$/i;
const ELO_K = 32;
const DEFAULT_RATING = 1000;
// Abandoned games rate as a loss for the abandoner only when the game had
// substance (>= 4 moves), else they are unrated.
const RATED_ABANDON_MIN_MOVES = 4;

// The headline rating: every game settles into this pool with the K-factor
// scaled by the game's difficulty, so hard configurations move the global
// number more. Per-configuration pools settle alongside it, unscaled.
export const GLOBAL_POOL = "global";

// How much a game should move the global rating, relative to the classic
// 3x3 / one sequence of 3 / two players / untimed baseline of 1.0. Each
// term reflects something that genuinely makes winning harder; the clamp
// keeps any single exotic configuration from dominating a rating.
export const difficultyOf = (game: Game): number => {
  const difficulty =
    1 +
    (game.winningSequenceLength - 3) * 0.35 + // longer runs are harder
    (game.winningSequenceCount - 1) * 0.5 + // each extra required sequence
    (game.playerCount - 2) * 0.25 + // more players, more chaos
    (game.teamCount > 0 ? 0.25 : 0) + // coordination without communication
    (game.timed ? 0.25 : 0); // clock pressure
  return Math.min(Math.max(difficulty, 0.5), 3);
};

// No playerId here on purpose: public rows carry handles only, so nobody
// can lift ids off the leaderboard (they matter only in-game). The handle
// is the public identity, and the only key the browse pages need.
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

export interface ArchivedGame {
  gameId: string;
  ttn: string;
  status: string;
  winnerSeat: number | null;
  startedAt: number;
  completedAt: number;
  players: Array<{
    seat: number;
    playerId: string;
    handle: string;
    kind: PlayerKind;
  }>;
}

export class GameDb {
  #db: Database;

  constructor(path: string = ":memory:") {
    this.#db = new Database(path, { create: true });
    this.#db.exec("PRAGMA journal_mode = WAL;");
    this.#db.exec(`
      CREATE TABLE IF NOT EXISTS players (
        player_id  TEXT PRIMARY KEY,
        key_hash   TEXT NOT NULL DEFAULT '',
        handle     TEXT NOT NULL DEFAULT '',
        kind       TEXT NOT NULL DEFAULT '${PlayerKind.HUMAN}',
        created_at INTEGER NOT NULL,
        last_seen  INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_players_handle
        ON players (handle COLLATE NOCASE) WHERE handle != '';
      CREATE INDEX IF NOT EXISTS idx_players_key_hash
        ON players (key_hash) WHERE key_hash != '';
      CREATE TABLE IF NOT EXISTS games (
        game_id      TEXT PRIMARY KEY,
        ttn          TEXT NOT NULL,
        status       TEXT NOT NULL,
        winner_seat  INTEGER,
        started_at   INTEGER NOT NULL,
        completed_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS game_players (
        game_id   TEXT NOT NULL,
        seat      INTEGER NOT NULL,
        player_id TEXT NOT NULL,
        PRIMARY KEY (game_id, seat)
      );
      CREATE INDEX IF NOT EXISTS idx_game_players_player
        ON game_players (player_id);
      CREATE TABLE IF NOT EXISTS ratings (
        player_id TEXT NOT NULL,
        pool      TEXT NOT NULL,
        rating    REAL NOT NULL DEFAULT ${DEFAULT_RATING},
        games     INTEGER NOT NULL DEFAULT 0,
        wins      INTEGER NOT NULL DEFAULT 0,
        draws     INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (player_id, pool)
      );
    `);
    this.#migrate();
  }

  // CREATE TABLE IF NOT EXISTS does nothing to a table that already
  // exists, so a box carrying an older database needs its new columns
  // added explicitly. Each step is idempotent and additive - the database
  // on the box holds real games, and a deploy must never drop them.
  #migrate() {
    const columns = (table: string): string[] =>
      (this.#db.query(`PRAGMA table_info(${table})`).all() as Array<{
        name: string;
      }>).map((row) => row.name);

    const add = (table: string, column: string, definition: string) => {
      if (!columns(table).includes(column)) {
        this.#db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      }
    };

    try {
      // 2026-07: is_robot (0/1) became kind (human|robot|agent), so that a
      // seat taken over MCP is distinguishable from an SDK robot.
      add("players", "kind", `TEXT NOT NULL DEFAULT '${PlayerKind.HUMAN}'`);
      if (columns("players").includes("is_robot")) {
        this.#db.exec(
          `UPDATE players SET kind = '${PlayerKind.ROBOT}'
           WHERE is_robot = 1 AND kind = '${PlayerKind.HUMAN}'`
        );
      }
      // 2026-07: draws are counted so the standings table can show a real
      // win/draw/loss split.
      add("ratings", "draws", "INTEGER NOT NULL DEFAULT 0");
    } catch (error) {
      // A failed migration must not stop the server booting: it runs
      // without whatever the new column powers rather than not at all.
      console.error("Database migration failed", error);
    }
  }

  upsertPlayer(playerId: string, keyHash: string, kind: PlayerKind) {
    const now = Date.now();
    this.#db
      .query(
        `INSERT INTO players (player_id, key_hash, handle, kind, created_at, last_seen)
         VALUES (?, ?, '', ?, ?, ?)
         ON CONFLICT(player_id) DO UPDATE SET
           key_hash = CASE WHEN excluded.key_hash != '' THEN excluded.key_hash ELSE players.key_hash END,
           kind = excluded.kind,
           last_seen = excluded.last_seen`
      )
      .run(playerId, keyHash, kind, now, now);
  }

  // Give a player a handle if they have none, so nobody ever shows up as
  // "anonymous". Retries on the (rare) collision, then gives up rather
  // than looping - a player with no handle is a cosmetic problem, and
  // gameplay must never depend on this succeeding.
  ensureHandle(playerId: string): string {
    const existing = this.getHandle(playerId);
    if (existing) {
      return existing;
    }
    for (let attempt = 0; attempt < 8; attempt++) {
      const candidate = generateHandle();
      const result = this.claimHandle(playerId, candidate);
      if (result.ok) {
        return result.handle;
      }
    }
    return "";
  }

  kindOf(playerId: string): PlayerKind {
    const row = this.#db
      .query(`SELECT kind FROM players WHERE player_id = ?`)
      .get(playerId) as { kind: string } | null;
    return (row?.kind as PlayerKind) ?? PlayerKind.HUMAN;
  }

  claimHandle(
    playerId: string,
    handle: string
  ): { ok: true; handle: string } | { ok: false; reason: "invalid" | "taken" } {
    if (!HANDLE_PATTERN.test(handle)) {
      return { ok: false, reason: "invalid" };
    }
    const holder = this.#db
      .query(
        `SELECT player_id FROM players WHERE handle = ? COLLATE NOCASE AND player_id != ?`
      )
      .get(handle, playerId) as { player_id: string } | null;
    if (holder) {
      return { ok: false, reason: "taken" };
    }
    this.#db
      .query(`UPDATE players SET handle = ?, last_seen = ? WHERE player_id = ?`)
      .run(handle, Date.now(), playerId);
    return { ok: true, handle };
  }

  // Durable identity across server restarts: the in-memory key map is
  // rebuilt lazily from this lookup (see engine.resolvePlayerKey).
  playerIdByKeyHash(keyHash: string): string | null {
    if (!keyHash) {
      return null;
    }
    const row = this.#db
      .query(
        "SELECT player_id FROM players WHERE key_hash = ? ORDER BY last_seen DESC LIMIT 1"
      )
      .get(keyHash) as { player_id: string } | null;
    return row?.player_id ?? null;
  }

  getHandle(playerId: string): string {
    const row = this.#db
      .query(`SELECT handle FROM players WHERE player_id = ?`)
      .get(playerId) as { handle: string } | null;
    return row?.handle ?? "";
  }

  static poolOf(game: Game): string {
    return `${game.boardSize}x${game.winningSequenceLength}x${game.playerCount}${
      game.winningSequenceCount > 1 ? `-s${game.winningSequenceCount}` : ""
    }${game.teamCount > 0 ? `-t${game.teamCount}` : ""}${
      game.timed ? "-timed" : ""
    }`;
  }

  // Archive a finished game and settle ratings, atomically.
  recordGame(game: Game) {
    if (!game.notation) {
      return;
    }
    const winnerSeat = game.winner ? game.players.indexOf(game.winner) : null;
    const record = this.#db.transaction(() => {
      this.#db
        .query(
          `INSERT OR REPLACE INTO games (game_id, ttn, status, winner_seat, started_at, completed_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          game.gameId,
          game.notation as string,
          game.status,
          winnerSeat,
          game.createdAt,
          game.completedAt ?? Date.now()
        );
      game.players.forEach((playerId, seat) => {
        this.#db
          .query(
            `INSERT OR REPLACE INTO game_players (game_id, seat, player_id) VALUES (?, ?, ?)`
          )
          .run(game.gameId, seat, playerId);
      });
      this.#settleRatings(game);
    });
    record();
  }

  #getRating(playerId: string, pool: string): number {
    const row = this.#db
      .query(`SELECT rating FROM ratings WHERE player_id = ? AND pool = ?`)
      .get(playerId, pool) as { rating: number } | null;
    return row?.rating ?? DEFAULT_RATING;
  }

  #applyResult(pool: string, a: string, b: string, scoreA: number, k = ELO_K) {
    const ratingA = this.#getRating(a, pool);
    const ratingB = this.#getRating(b, pool);
    const expectedA = 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
    const delta = k * (scoreA - expectedA);
    const bump = this.#db.query(
      `INSERT INTO ratings (player_id, pool, rating, games, wins, draws)
       VALUES (?, ?, ?, 1, ?, ?)
       ON CONFLICT(player_id, pool) DO UPDATE SET
         rating = ratings.rating + ?,
         games = ratings.games + 1,
         wins = ratings.wins + ?,
         draws = ratings.draws + ?`
    );
    const winA = scoreA === 1 ? 1 : 0;
    const winB = scoreA === 0 ? 1 : 0;
    const drawn = scoreA === 0.5 ? 1 : 0;
    bump.run(a, pool, DEFAULT_RATING + delta, winA, drawn, delta, winA, drawn);
    bump.run(b, pool, DEFAULT_RATING - delta, winB, drawn, -delta, winB, drawn);
  }

  // Apply one pairwise result to the configuration pool (unscaled) and the
  // global pool (K scaled by difficulty).
  #applyEverywhere(game: Game, a: string, b: string, scoreA: number) {
    this.#applyResult(GameDb.poolOf(game), a, b, scoreA);
    this.#applyResult(GLOBAL_POOL, a, b, scoreA, ELO_K * difficultyOf(game));
  }

  // In a team game the winners are the whole winning team; teamless games
  // make each seat its own team, so this covers both.
  #teamOf(game: Game, playerId: string): number {
    const seat = game.players.indexOf(playerId);
    return game.teamCount > 0 ? seat % game.teamCount : seat;
  }

  #settleRatings(game: Game) {
    const moveCount = game.moveLog.length / 2;
    if (game.status === GameStatus.GAME_ABANDONED) {
      // Rated only with substance; the abandoner is whoever is absent from
      // the surviving set - the engine abandons on a specific player, but
      // by this point we only know the game died. Skip rating entirely for
      // low-substance games; otherwise rate nothing (fair default: an
      // abandon punishes nobody until the engine attributes it).
      return;
    }
    if (moveCount < 1) {
      return;
    }
    if (
      game.status === GameStatus.GAME_WON ||
      game.status === GameStatus.GAME_WON_BY_TIMEOUT
    ) {
      const winningTeam = this.#teamOf(game, game.winner);
      const winners = game.players.filter(
        (playerId) => this.#teamOf(game, playerId) === winningTeam
      );
      const losers = game.players.filter(
        (playerId) => this.#teamOf(game, playerId) !== winningTeam
      );
      winners.forEach((winner) => {
        losers.forEach((loser) => {
          this.#applyEverywhere(game, winner, loser, 1);
        });
      });
      return;
    }
    if (game.status === GameStatus.GAME_ENDS_IN_A_DRAW) {
      // Draws settle across opposing sides only - teammates never rate
      // against each other.
      for (let i = 0; i < game.players.length; i++) {
        for (let j = i + 1; j < game.players.length; j++) {
          if (
            this.#teamOf(game, game.players[i]) !==
            this.#teamOf(game, game.players[j])
          ) {
            this.#applyEverywhere(game, game.players[i], game.players[j], 0.5);
          }
        }
      }
    }
  }

  // Attribute an abandonment: the leaver loses to every opponent (never to
  // a teammate) when the game had substance.
  recordAbandonment(game: Game, abandonerId: string) {
    const moveCount = game.moveLog.replaceAll("--", "").length / 2;
    if (moveCount < RATED_ABANDON_MIN_MOVES) {
      return;
    }
    game.players.forEach((playerId) => {
      if (
        playerId !== abandonerId &&
        this.#teamOf(game, playerId) !== this.#teamOf(game, abandonerId)
      ) {
        this.#applyEverywhere(game, playerId, abandonerId, 1);
      }
    });
  }

  // Anonymous players are excluded on purpose: the full table is a browse
  // surface keyed by handle, and a row you cannot click is just noise.
  leaderboard(pool: string, limit: number = 25): LeaderboardRow[] {
    const rows = this.#db
      .query(
        `SELECT p.handle, p.kind, r.rating, r.games, r.wins, r.draws
         FROM ratings r JOIN players p ON p.player_id = r.player_id
         WHERE r.pool = ? AND p.handle != ''
         ORDER BY r.rating DESC
         LIMIT ?`
      )
      .all(pool, Math.min(Math.max(limit, 1), 500)) as Array<{
      handle: string;
      kind: string;
      rating: number;
      games: number;
      wins: number;
      draws: number;
    }>;
    return rows.map((row) => ({
      handle: row.handle,
      kind: (row.kind as PlayerKind) ?? PlayerKind.HUMAN,
      rating: Math.round(row.rating),
      games: row.games,
      wins: row.wins,
      draws: row.draws,
      losses: Math.max(0, row.games - row.wins - row.draws),
      winRate: row.games > 0 ? Math.round((row.wins / row.games) * 100) : 0,
    }));
  }

  // Someone else's finished games, looked up by their public handle. TTN
  // lines carry no identity, so replaying another player's game exposes
  // nothing beyond what the leaderboard already shows.
  gamesByHandle(handle: string, limit: number = 25): ArchivedGame[] {
    const player = this.#db
      .query(`SELECT player_id FROM players WHERE handle = ? COLLATE NOCASE`)
      .get(handle) as { player_id: string } | null;
    return player ? this.playerGames(player.player_id, limit) : [];
  }

  pools(): string[] {
    const rows = this.#db
      .query(`SELECT DISTINCT pool FROM ratings ORDER BY pool`)
      .all() as Array<{ pool: string }>;
    return rows.map((row) => row.pool);
  }

  getGame(gameId: string): ArchivedGame | null {
    const game = this.#db
      .query(`SELECT * FROM games WHERE game_id = ?`)
      .get(gameId) as {
      game_id: string;
      ttn: string;
      status: string;
      winner_seat: number | null;
      started_at: number;
      completed_at: number;
    } | null;
    if (!game) {
      return null;
    }
    const players = this.#db
      .query(
        `SELECT gp.seat, gp.player_id, p.handle, p.kind
         FROM game_players gp LEFT JOIN players p ON p.player_id = gp.player_id
         WHERE gp.game_id = ? ORDER BY gp.seat`
      )
      .all(gameId) as Array<{
      seat: number;
      player_id: string;
      handle: string;
      kind: string | null;
    }>;
    return {
      gameId: game.game_id,
      ttn: game.ttn,
      status: game.status,
      winnerSeat: game.winner_seat,
      startedAt: game.started_at,
      completedAt: game.completed_at,
      players: players.map((row) => ({
        seat: row.seat,
        playerId: row.player_id,
        handle: row.handle ?? "",
        kind: (row.kind as PlayerKind) ?? PlayerKind.HUMAN,
      })),
    };
  }

  playerGames(playerId: string, limit: number = 25): ArchivedGame[] {
    const ids = this.#db
      .query(
        `SELECT g.game_id FROM games g
         JOIN game_players gp ON gp.game_id = g.game_id
         WHERE gp.player_id = ?
         ORDER BY g.completed_at DESC LIMIT ?`
      )
      .all(playerId, Math.min(Math.max(limit, 1), 100)) as Array<{
      game_id: string;
    }>;
    return ids
      .map((row) => this.getGame(row.game_id))
      .filter((game): game is ArchivedGame => game !== null);
  }

  playerProfile(playerId: string) {
    const player = this.#db
      .query(
        `SELECT player_id, handle, kind, created_at FROM players WHERE player_id = ?`
      )
      .get(playerId) as {
      player_id: string;
      handle: string;
      kind: string;
      created_at: number;
    } | null;
    if (!player) {
      return null;
    }
    const ratings = this.#db
      .query(
        `SELECT pool, rating, games, wins, draws FROM ratings WHERE player_id = ?`
      )
      .all(playerId) as Array<{
      pool: string;
      rating: number;
      games: number;
      wins: number;
      draws: number;
    }>;
    return {
      playerId: player.player_id,
      handle: player.handle || "anonymous",
      kind: (player.kind as PlayerKind) ?? PlayerKind.HUMAN,
      createdAt: player.created_at,
      ratings: ratings.map((row) => ({ ...row, rating: Math.round(row.rating) })),
    };
  }

  close() {
    this.#db.close();
  }
}
