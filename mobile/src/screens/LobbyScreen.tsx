import { useEffect, useRef, useState } from "react";
import { ScrollView, Switch, Text, View, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, MONO, getStatusForViewer } from "../theme";
import { Badge, Btn, Field, styles as ui } from "../ui";
import { decodeTtn } from "../ttn";
import { describeGoal } from "../rules";
import { GameStatus } from "../model";
import {
  useAppSelector,
  startGame,
  startRobotGame,
  joinGame,
  spectateGame,
  setActiveGame,
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
      {/* Just the brand. The handle moved to the "you" tab - it is
          identity, not a thing you need in front of you while choosing
          a board. */}
      <Text
        style={[MONO, { color: C.accent, fontSize: 18, fontWeight: "700", marginBottom: 14 }]}
      >
        tici-taca-toey_
      </Text>

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
          <Btn title="PLAY A ROBOT NOW" onPress={startRobotGame} />
          <Text style={[MONO, { color: C.dim, fontSize: 10, marginTop: 8 }]}>
            or set up your own below. today's puzzle, the standings, and
            your games are in the tabs.
          </Text>
        </View>
      )}


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

    </ScrollView>
  );
};

export default LobbyScreen;
