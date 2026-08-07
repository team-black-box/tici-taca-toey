import { useEffect, useRef, useState } from "react";
import { Linking, Modal, ScrollView, Share, Switch, Text, TextInput, View, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, MONO, getStatusForViewer } from "../theme";
import { Avatar, Badge, Btn, Field, styles as ui } from "../ui";
import { decodeTtn } from "../ttn";
import { describeGoal } from "../rules";
import { GameStatus } from "../model";
import { APP_VERSION, PRIVACY_URL, TERMS_URL } from "../version";
import {
  useAppSelector,
  updateCurrentPlayerName,
  claimHandle,
  startGame,
  startRobotGame,
  joinGame,
  spectateGame,
  setActiveGame,
  exportSyncUrl,
  importIdentity,
} from "../state";
import { FeedbackBanner } from "../ui";
import type { RootStackParamList } from "../navigation";

const LobbyScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const name = useAppSelector((state) => state.currentPlayer.name);
  const you = useAppSelector((state) => state.currentPlayer.playerId);
  const playing = useAppSelector((state) => state.currentPlayer.playing);
  const active = useAppSelector((state) => state.currentPlayer.active);
  const games = useAppSelector((state) => state.games);
  const players = useAppSelector((state) => state.players);
  const connected = useAppSelector((state) => state.currentPlayer.connected);
  const history = useAppSelector((state) => state.history);
  const lobby = useAppSelector((state) => state.lobby);

  // Games whose host opened a seat to strangers, and that still have one.
  const openGames = lobby.filter(
    (summary) =>
      summary.openSeats &&
      !playing.includes(summary.gameId) &&
      summary.status === GameStatus.WAITING_FOR_PLAYERS &&
      summary.playerCount >
        summary.humanCount + summary.robotCount + summary.agentCount
  );

  const [gameName, setGameName] = useState("My Amazing Game");
  const [boardSize, setBoardSize] = useState("3");
  const [playerCount, setPlayerCount] = useState("2");
  const [winSeq, setWinSeq] = useState("3");
  const [winCount, setWinCount] = useState("1");
  const [teams, setTeams] = useState(0);
  const [openToStrangers, setOpenToStrangers] = useState(false);
  const [showCursors, setShowCursors] = useState(false);
  const [timed, setTimed] = useState(false);
  const [minutes, setMinutes] = useState("3");

  // Equal teams only: valid counts divide the players into sides of 2+.
  const teamChoices = Array.from(
    { length: Number(playerCount) || 0 },
    (_, index) => index + 2
  ).filter(
    (count) =>
      Number(playerCount) % count === 0 && count <= Number(playerCount) / 2
  );
  const chosenTeams = teamChoices.includes(teams) ? teams : 0;
  const [link, setLink] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [syncCode, setSyncCode] = useState("");

  // When a new game becomes active (started/joined/resumed), open it.
  const lastActive = useRef(active);
  useEffect(() => {
    if (active && active !== lastActive.current) {
      navigation.navigate("Game");
    }
    lastActive.current = active;
  }, [active, navigation]);

  return (
    <ScrollView
      style={{ backgroundColor: C.bg }}
      // The floating tab bar sits 24pt off the bottom and is not part of
      // the layout, so the scroll content has to leave room for it by
      // hand. 120 cleared the last panel but not the footer added below
      // it - the legal links ended up underneath the pills, which is
      // exactly the thing an app reviewer taps first.
      contentContainerStyle={{ padding: 14, paddingTop: insets.top + 8, paddingBottom: 190 }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <Text style={[MONO, { color: C.accent, fontSize: 18, fontWeight: "700", flex: 1 }]}>
          tici-taca-toey_
        </Text>
        <TextInput
          style={[ui.input, { width: 140, textAlign: "right" }]}
          value={name}
          onChangeText={updateCurrentPlayerName}
          onSubmitEditing={() => {
            if (name.trim()) {
              claimHandle(name.trim());
            }
          }}
          placeholder="handle + return"
          placeholderTextColor={C.dim}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Avatar name={name} size={11} />
      </View>

      {!connected && (
        <Text style={[MONO, { color: C.danger, marginBottom: 10 }]}>
          reconnecting to server…
        </Text>
      )}
      <FeedbackBanner />

      {playing.length === 0 && (
        <View style={ui.panel}>
          <Text style={ui.panelTitle}>{"> welcome"}</Text>
          <Text style={[MONO, { color: C.fg, fontSize: 12, marginBottom: 8 }]}>
            tic-tac-toe, the way it should have shipped: boards 2-12, up to
            10 players, line length you choose, chess clocks optional.
            robots are standing by.
          </Text>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <Btn title="PLAY A ROBOT NOW" onPress={startRobotGame} />
            <Pressable onPress={() => setHelpOpen(true)}>
              <Text style={[MONO, { color: C.dim, fontSize: 12 }]}>? help</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* onRequestClose is what wires up Android's back gesture. Without
          it the modal simply ignores back, which on Android reads as the
          app being stuck - there is no other way out of a full-screen
          overlay there, and it is the first thing anyone tries. iOS has
          no back gesture for this, so the CLOSE button stays. */}
      <Modal
        visible={helpOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setHelpOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", padding: 20 }}>
          {/* Scrolls, because this is the same material the web help
              covers and it does not fit on a phone otherwise - and the
              phone is where a new player most needs it. */}
          <ScrollView
            style={{ maxHeight: "88%" }}
            contentContainerStyle={{ paddingBottom: 4 }}
          >
          <View style={[ui.panel, { borderColor: C.accent }]}>
            <Text style={ui.panelTitle}>{"> how to play"}</Text>
            <Text style={[MONO, { color: C.fg, fontSize: 12, marginBottom: 8 }]}>
              tic-tac-toe with the dials exposed. take turns placing your
              mark; win by making a line - marks in a row across, down, or
              diagonally - before anyone else.
            </Text>
            <Text style={[MONO, { color: C.fg, fontSize: 12, marginBottom: 8 }]}>
              two settings decide what winning means, and the game always
              spells the goal out under its name:
            </Text>
            <Text style={[MONO, { color: C.fg, fontSize: 12, marginBottom: 4 }]}>
              <Text style={{ color: C.accent }}>in a row</Text> - how long a
              line has to be. 3 is classic; on a big board try 4 or 5.
            </Text>
            <Text style={[MONO, { color: C.fg, fontSize: 12, marginBottom: 8 }]}>
              <Text style={{ color: C.accent }}>lines</Text> - how many
              separate lines you need. usually 1. set it higher and the game
              runs until someone completes that many (lines may cross, like
              a crossword).
            </Text>
            <Text style={[MONO, { color: C.fg, fontSize: 12, marginBottom: 8 }]}>
              boards go 2-12, players 2-10. in a team game your teammates'
              marks count toward the same lines. timed games run chess
              clocks: run out and you lose. gg forfeits.
            </Text>

            <Text style={ui.panelTitle}>{"> who you play"}</Text>
            <Text style={[MONO, { color: C.fg, fontSize: 12, marginBottom: 8 }]}>
              play a robot now summons an opponent: rando plays chaos,
              greedo blocks and pounces, minnie-max never loses a 3x3.
              invite humans with the share link. watch anything live from
              the watch tab. play as many boards at once as you dare.
            </Text>

            <Text style={ui.panelTitle}>{"> cursors"}</Text>
            <Text style={[MONO, { color: C.fg, fontSize: 12, marginBottom: 8 }]}>
              while a game is live you can see where the others are
              thinking, as a dim ghost of their mark. teammates and
              spectators always see them; opponents only if the host turned
              "show cursors to everyone" on at the start, which the game
              header then says. a hover you do not mean is a perfectly good
              bluff. your phone shows everyone else's but sends none of its
              own - a finger has no hover.
            </Text>

            <Text style={ui.panelTitle}>{"> your identity"}</Text>
            <Text style={[MONO, { color: C.fg, fontSize: 12, marginBottom: 8 }]}>
              claim a handle (type it top-right, hit return) - claimed
              handles are unique and put you on the leaderboard. every
              finished game replays from its notation line, move by move.
            </Text>

            <Text style={ui.panelTitle}>{"> sync devices"}</Text>
            <Btn
              title="SHARE MY SYNC CODE"
              ghost
              onPress={() => Share.share({ message: exportSyncUrl() })}
            />
            <Text style={[MONO, { color: C.dim, fontSize: 10, marginVertical: 6 }]}>
              the code is your account - share it with no one else. paste a
              code from another device below to import that identity here.
            </Text>
            <TextInput
              style={ui.input}
              value={syncCode}
              onChangeText={setSyncCode}
              placeholder="paste sync code"
              placeholderTextColor={C.dim}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {syncCode.trim().length > 0 && (
              <Btn
                title="IMPORT IDENTITY"
                onPress={() => {
                  importIdentity(syncCode);
                  setSyncCode("");
                  setHelpOpen(false);
                }}
              />
            )}
            <Btn title="CLOSE" ghost onPress={() => setHelpOpen(false)} />
          </View>
          </ScrollView>
        </View>
      </Modal>

      {playing.length > 0 && (
        <View style={{ marginBottom: 4 }}>
          <Text style={ui.panelTitle}>{"> your games"}</Text>
          {playing.map((gameId) => {
            const game = games[gameId];
            if (!game) {
              return null;
            }
            const status = getStatusForViewer(game, you, players);
            const yourMove = game.turn === you && you !== "";
            return (
              <Pressable
                key={gameId}
                style={ui.tile}
                onPress={() => {
                  setActiveGame(gameId);
                  navigation.navigate("Game");
                }}
              >
                <View>
                  <Text style={ui.tileName}>{game.name}</Text>
                  <Badge text={status.text} color={status.color} />
                  {yourMove && (
                    <Text style={[MONO, { color: C.accent, fontSize: 10, marginTop: 6 }]}>
                      ▮ YOUR MOVE
                    </Text>
                  )}
                </View>
                <Text style={ui.tileMeta}>
                  {game.boardSize}x{game.boardSize}
                  {"\n"}
                  {game.players.length}/{game.playerCount} seated
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {openGames.length > 0 && (
        <View style={{ marginBottom: 4 }}>
          <Text style={ui.panelTitle}>{"> open to anyone"}</Text>
          {openGames.map((summary) => {
            const seated =
              summary.humanCount + summary.robotCount + summary.agentCount;
            return (
              <Pressable
                key={summary.gameId}
                style={ui.tile}
                onPress={() => joinGame(summary.gameId, true)}
              >
                <View>
                  <Text style={ui.tileName}>{summary.name}</Text>
                  <Badge
                    text={`TAKE A SEAT (${summary.playerCount - seated})`}
                    color={C.accent}
                  />
                </View>
                <Text style={ui.tileMeta}>
                  {summary.boardSize}x{summary.boardSize}
                  {"\n"}
                  {seated}/{summary.playerCount} seated
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
        <Btn
          title="LEADERBOARD"
          ghost
          onPress={() => navigation.navigate("Leaderboard")}
        />
        <Btn
          title="DAILY"
          ghost
          onPress={() => navigation.navigate("Daily")}
        />
      </View>

      <View style={ui.panel}>
        <Text style={ui.panelTitle}>{"> start new game"}</Text>
        <Field label="GAME NAME" value={gameName} onChange={setGameName} />
        <View style={ui.row}>
          <Field label="BOARD" value={boardSize} onChange={setBoardSize} numeric />
          <Field label="PLAYERS" value={playerCount} onChange={setPlayerCount} numeric />
          <Field label="IN A ROW" value={winSeq} onChange={setWinSeq} numeric />
          <Field label="LINES" value={winCount} onChange={setWinCount} numeric />
        </View>
        {/* Live plain-language preview of the win condition. */}
        <Text style={[MONO, { color: C.accent, fontSize: 11, marginBottom: 8 }]}>
          {"> goal: "}
          {describeGoal({
            boardSize: Number(boardSize) || 0,
            winningSequenceLength: Number(winSeq) || 0,
            winningSequenceCount: Number(winCount) || 1,
            teamCount: chosenTeams,
          })}
        </Text>
        {teamChoices.length > 0 && (
          <View style={{ marginBottom: 8 }}>
            <Text style={ui.label}>TEAMS</Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
              <Btn
                title="NONE"
                ghost={chosenTeams !== 0}
                onPress={() => setTeams(0)}
              />
              {teamChoices.map((count) => (
                <Btn
                  key={count}
                  title={`${count} × ${Number(playerCount) / count}`}
                  ghost={chosenTeams !== count}
                  onPress={() => setTeams(count)}
                />
              ))}
            </View>
          </View>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 8 }}>
          <Switch
            value={openToStrangers}
            onValueChange={setOpenToStrangers}
            trackColor={{ true: C.accent, false: C.border }}
            thumbColor={C.fg}
          />
          <Text style={ui.label}>LET STRANGERS JOIN</Text>
        </View>
        {/* This phone cannot send a cursor - a finger has no hover - but
            it can still host a game where everyone else's are public. */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 8 }}>
          <Switch
            value={showCursors}
            onValueChange={setShowCursors}
            trackColor={{ true: C.accent, false: C.border }}
            thumbColor={C.fg}
          />
          <Text style={ui.label}>SHOW CURSORS TO EVERYONE</Text>
        </View>
        <Text style={[MONO, { color: C.dim, fontSize: 10, marginBottom: 4 }]}>
          {showCursors
            ? "opponents will see each other's cursors - a hover can be a bluff"
            : "only teammates and spectators will see cursors"}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 8 }}>
          <Switch
            value={timed}
            onValueChange={setTimed}
            trackColor={{ true: C.accent, false: C.border }}
            thumbColor={C.fg}
          />
          <Text style={ui.label}>TIMED GAME</Text>
          {timed && (
            <Field label="MINUTES" value={minutes} onChange={setMinutes} numeric />
          )}
        </View>
        <Btn
          title="START NEW GAME ➤"
          onPress={() =>
            startGame(
              gameName,
              Number(boardSize),
              Number(playerCount),
              Number(winSeq),
              timed ? Number(minutes) * 60_000 : undefined,
              timed ? 1000 : undefined,
              Number(winCount) > 1 ? Number(winCount) : undefined,
              chosenTeams > 0 ? chosenTeams : undefined,
              openToStrangers,
              showCursors
            )
          }
        />
      </View>

      {history.length > 0 && (
        <View style={{ marginBottom: 4 }}>
          <Text style={ui.panelTitle}>{"> your finished games"}</Text>
          {history.slice(0, 10).map((game) => {
            const decoded = (() => {
              try {
                return decodeTtn(game.ttn);
              } catch {
                return null;
              }
            })();
            const teams = decoded?.teamCount ?? 0;
            const iWon =
              game.winnerSeat !== null &&
              game.mySeat >= 0 &&
              (teams > 0
                ? game.winnerSeat % teams === game.mySeat % teams
                : game.winnerSeat === game.mySeat);
            const result =
              game.status === GameStatus.GAME_ENDS_IN_A_DRAW
                ? { text: "DRAW", color: C.info }
                : game.status === GameStatus.GAME_ABANDONED
                ? { text: "ABANDONED", color: C.danger }
                : iWon
                ? { text: "WON", color: C.info }
                : { text: "LOST", color: C.danger };
            return (
              <Pressable
                key={game.gameId}
                style={ui.tile}
                onPress={() =>
                  navigation.navigate("Replay", {
                    ttn: game.ttn,
                    roster: game.players,
                  })
                }
              >
                <View>
                  <Badge text={result.text} color={result.color} />
                  <Text style={[MONO, { color: C.dim, fontSize: 10, marginTop: 6 }]}>
                    {game.players.map((player) => player.handle).join(" vs ")}
                  </Text>
                </View>
                <Text style={ui.tileMeta}>
                  {decoded ? `${decoded.boardSize}x${decoded.boardSize}` : ""}
                  {"\n"}
                  {decoded && decoded.winningSequenceCount > 1
                    ? `${decoded.winningSequenceCount}x${decoded.winningSequenceLength}`
                    : teams > 0
                    ? `${teams} teams`
                    : "tap to replay"}
                </Text>
              </Pressable>
            );
          })}
          {name.trim().length > 0 && (
            <Btn
              title={
                history.length > 10
                  ? `SEE ALL ${history.length} GAMES`
                  : "YOUR PROFILE"
              }
              ghost
              onPress={() =>
                navigation.navigate("Player", { handle: name.trim() })
              }
            />
          )}
        </View>
      )}

      <View style={ui.panel}>
        <Text style={ui.panelTitle}>{"> join game"}</Text>
        <Field
          label="GAME LINK OR ID"
          value={link}
          onChange={setLink}
          placeholder="paste game link"
        />
        {link.trim().length > 0 && (
          <Btn
            title="JOIN"
            onPress={() => {
              const parts = link.trim().split("/");
              const gameId = parts[parts.length - 1];
              if (gameId) {
                joinGame(gameId);
              }
              setLink("");
            }}
          />
        )}
      </View>

      {/* The web's footer, in the one place a phone has room for it.
          Both stores require a reachable privacy policy, and the version
          is what makes a support conversation possible. */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 6,
          marginTop: 14,
          marginBottom: 4,
        }}
      >
        <Text style={[MONO, { color: C.dim, fontSize: 10 }]}>
          made with ♥ in Bengaluru
        </Text>
        <Text style={[MONO, { color: C.dim, fontSize: 10 }]}>·</Text>
        <Pressable onPress={() => Linking.openURL(PRIVACY_URL)}>
          <Text style={[MONO, { color: C.accent, fontSize: 10 }]}>privacy</Text>
        </Pressable>
        <Text style={[MONO, { color: C.dim, fontSize: 10 }]}>·</Text>
        <Pressable onPress={() => Linking.openURL(TERMS_URL)}>
          <Text style={[MONO, { color: C.accent, fontSize: 10 }]}>terms</Text>
        </Pressable>
        <Text style={[MONO, { color: C.dim, fontSize: 10 }]}>·</Text>
        <Text style={[MONO, { color: C.dim, fontSize: 10 }]}>
          v{APP_VERSION}
        </Text>
      </View>
    </ScrollView>
  );
};

export default LobbyScreen;
