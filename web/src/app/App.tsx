import { useEffect, useRef } from "react";
import Header from "../features/header/Header";
import Start from "../features/start/Start";
import Game from "../features/game/Game";
import Join from "../features/join/Join";
import Listing from "../features/listing/Listing";
import Leaderboard from "../features/listing/Leaderboard";
import History from "../features/listing/History";
import Replay from "../features/replay/Replay";
import Daily from "../features/daily/Daily";
import LeaderboardPage from "../features/leaderboard/LeaderboardPage";
import PlayerPage from "../features/leaderboard/PlayerPage";
import Help from "../features/help/Help";
import StatusLine from "../features/feedback/StatusLine";
import { useRoute, navigate } from "../common/router";
import { useAppSelector, say } from "../state/store";
import {
  getCurrentlyPlayingGames,
  getCurrentlySpectatingGames,
  isConnectedToServer,
  getActiveGameId,
  getActiveGameMode,
} from "../state/currentPlayer";
import { getActiveGameStatus } from "../state/games";
import { joinGame, spectateGame } from "../state/actions";
import {
  COMPLETED_GAME_STATUS,
  GameInteractionTypes,
  GameStatus,
} from "../common/model";
import { updateTurnAlerts } from "../state/turn-alerts";
import TurnAlertToggle from "../features/feedback/TurnAlertToggle";
import { HeartIcon } from "../common/icons";
import { setPlayerKey } from "../state/identity";
import { APP_VERSION, RELEASE_URL } from "../common/version";

export default function App() {
  const { type, gameId, search } = useRoute();
  const currentlyPlayingGames = useAppSelector(getCurrentlyPlayingGames);
  const currentlySpectatingGames = useAppSelector(getCurrentlySpectatingGames);
  const isConnected = useAppSelector(isConnectedToServer);

  const activeGame = useAppSelector(getActiveGameId);
  const activeGameMode = useAppSelector(getActiveGameMode);
  const activeGameStatus = useAppSelector(getActiveGameStatus);

  const isReplay = type === "replay";
  const isSync = type === "sync";
  // Browse routes: the full standings, and one player's finished games.
  const isLeaderboard = type === "leaderboard";
  const isPlayer = type === "player";
  // One position a day - the only route that needs no opponent.
  const isDaily = type === "daily";
  // Any route that takes over the stage instead of showing a game.
  const isBrowsing = isReplay || isLeaderboard || isPlayer || isDaily;
  const activeGameName = useAppSelector((state) =>
    state.currentPlayer.active
      ? state.games[state.currentPlayer.active]?.name
      : undefined
  );

  // Games waiting on this player, right now. Recomputed from the store
  // rather than tracked separately so it cannot drift from the board.
  const waitingGames = useAppSelector((state) =>
    state.currentPlayer.playing
      .map((id) => state.games[id])
      .filter(
        (game) =>
          game !== undefined &&
          game.status === GameStatus.GAME_IN_PROGRESS &&
          game.turn === state.currentPlayer.playerId
      )
      // Flattened to a string because a useSyncExternalStore snapshot has
      // to be referentially stable - returning a fresh array on every
      // read is an infinite render. Tab and newline separate, since game
      // names contain spaces ("My Amazing Game") and would not survive
      // being split on one.
      .map((game) => `${game.gameId}\t${game.name}`)
      .join("\n")
  );

  useEffect(() => {
    // The favicon always carries it; a system notification only fires
    // when the tab is hidden and you have opted in.
    updateTurnAlerts(
      waitingGames
        .split("\n")
        .filter(Boolean)
        .map((entry) => {
          const tab = entry.indexOf("\t");
          return { id: entry.slice(0, tab), name: entry.slice(tab + 1) };
        })
    );
  }, [waitingGames]);

  const waitingCount = waitingGames.split("\n").filter(Boolean).length;

  useEffect(() => {
    const base = isDaily
      ? "daily - tici-taca-toey"
      : isReplay
      ? "replay - tici-taca-toey"
      : isLeaderboard
      ? "leaderboard - tici-taca-toey"
      : isPlayer && gameId
      ? `${gameId} - tici-taca-toey`
      : activeGameName
      ? `${activeGameName} - tici-taca-toey`
      : "tici-taca-toey";
    // A tab you are not looking at should still say you are holding
    // somebody up.
    document.title = waitingCount > 0 ? `(${waitingCount}) ${base}` : base;
  }, [
    isReplay,
    isLeaderboard,
    isPlayer,
    isDaily,
    gameId,
    activeGameName,
    waitingCount,
  ]);

  useEffect(() => {
    // Importing an identity: /sync#<playerKey> - the fragment never reaches
    // any server. Confirm, store, reload as that player.
    if (isSync && window.location.hash.length > 1) {
      const key = window.location.hash.slice(1);
      if (
        window.confirm(
          "import this identity onto this device? your current anonymous identity here will be replaced."
        )
      ) {
        setPlayerKey(key);
        window.location.replace("/");
      } else {
        navigate("/");
      }
    } else if (isSync) {
      say("warn", "sync links carry the code after a # - nothing to import");
      navigate("/");
    }
  }, [isSync]);

  // Go to a game whenever its identity *or its mode* changes - so starting
  // or joining one from a browse page takes you straight to it, and
  // upgrading from spectator to player flips the URL from /spectate to
  // /play. The ref is seeded with the mounting target so an ambient game
  // already open does not re-navigate on mount.
  const lastNavRef = useRef(
    activeGame && activeGameMode ? `${activeGameMode}/${activeGame}` : ""
  );
  useEffect(() => {
    if (!activeGame || !activeGameMode || isSync) {
      return;
    }
    const target = `${activeGameMode}/${activeGame}`;
    if (target !== lastNavRef.current) {
      lastNavRef.current = target;
      navigate(`/${target}`);
    }
  }, [activeGame, activeGameMode, isSync]);

  useEffect(() => {
    if (isConnected && !isBrowsing && !isSync) {
      if (type && gameId) {
        // A finished game is removed from `playing`, but the URL still
        // points at it - so without the completed check this re-fires
        // joinGame on a game we are still seated in and the server
        // answers "you are already in this game" every time one ends.
        const finished =
          activeGameStatus !== undefined &&
          COMPLETED_GAME_STATUS.includes(activeGameStatus);
        if (
          !currentlyPlayingGames.includes(gameId) &&
          !currentlySpectatingGames.includes(gameId) &&
          !finished
        ) {
          switch (type) {
            case GameInteractionTypes.PLAY:
              joinGame(gameId);
              break;
            case GameInteractionTypes.SPECTATE:
              spectateGame(gameId);
              break;
            default:
              break;
          }
        }
      }
    }
  }, [
    type,
    gameId,
    currentlyPlayingGames,
    currentlySpectatingGames,
    activeGame,
    isConnected,
    activeGameStatus,
    isBrowsing,
    isSync,
  ]);

  return (
    <div className="app">
      <Header />
      <main className="app-main">
        <aside className="sidebar">
          <Start />
          <Join />
          <Leaderboard />
        </aside>
        <section className="stage">
          {isDaily ? (
            <Daily />
          ) : isReplay && gameId ? (
            <Replay ttn={gameId} search={search} />
          ) : isLeaderboard ? (
            <LeaderboardPage />
          ) : isPlayer && gameId ? (
            <PlayerPage handle={gameId} />
          ) : (
            <Game />
          )}
        </section>
        <aside className="rail">
          <Listing />
          <History />
        </aside>
      </main>
      <StatusLine />
      <footer className="footer">
        {isConnected ? (
          <>
            Made with <HeartIcon className="heart" /> in Bengaluru, India
            {" · "}
            <Help />
            {" · "}
            <button
              className="footer-link footer-button"
              onClick={() => navigate("/daily")}
              title="one position a day, the same for everyone"
            >
              daily
            </button>
            <TurnAlertToggle />
            {" · "}
            <a className="footer-link" href="/privacy.html">
              privacy
            </a>
            {" · "}
            <a className="footer-link" href="/terms.html">
              terms
            </a>
            {" · "}
            <a
              className="footer-link"
              href={RELEASE_URL}
              title="the release this page was built from"
            >
              {APP_VERSION}
            </a>
          </>
        ) : (
          <span className="reconnecting">reconnecting to server&hellip;</span>
        )}
      </footer>
    </div>
  );
}
