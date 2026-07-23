import { useEffect } from "react";
import Header from "../features/header/Header";
import Start from "../features/start/Start";
import Game from "../features/game/Game";
import Join from "../features/join/Join";
import Listing from "../features/listing/Listing";
import Leaderboard from "../features/listing/Leaderboard";
import History from "../features/listing/History";
import Replay from "../features/replay/Replay";
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
} from "../common/model";
import { HeartIcon } from "../common/icons";
import { setPlayerKey } from "../state/identity";
import { APP_VERSION, RELEASE_URL } from "../common/version";

export default function App() {
  const { type, gameId } = useRoute();
  const currentlyPlayingGames = useAppSelector(getCurrentlyPlayingGames);
  const currentlySpectatingGames = useAppSelector(getCurrentlySpectatingGames);
  const isConnected = useAppSelector(isConnectedToServer);

  const activeGame = useAppSelector(getActiveGameId);
  const activeGameMode = useAppSelector(getActiveGameMode);
  const activeGameStatus = useAppSelector(getActiveGameStatus);

  const isReplay = type === "replay";
  const isSync = type === "sync";
  const activeGameName = useAppSelector((state) =>
    state.currentPlayer.active
      ? state.games[state.currentPlayer.active]?.name
      : undefined
  );

  useEffect(() => {
    document.title = isReplay
      ? "replay - tici-taca-toey"
      : activeGameName
      ? `${activeGameName} - tici-taca-toey`
      : "tici-taca-toey";
  }, [isReplay, activeGameName]);

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

  useEffect(() => {
    if (activeGame && activeGameMode && !isReplay && !isSync) {
      navigate(`/${activeGameMode}/${activeGame}`);
    }
  }, [activeGame, activeGameMode, isReplay, isSync]);

  useEffect(() => {
    if (isConnected && !isReplay && !isSync) {
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
    isReplay,
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
          {isReplay && gameId ? <Replay ttn={gameId} /> : <Game />}
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
