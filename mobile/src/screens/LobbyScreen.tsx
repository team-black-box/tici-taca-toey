import { useEffect, useRef, useState } from "react";
import { Modal, ScrollView, Share, Switch, Text, TextInput, View, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, MONO, getStatusForViewer } from "../theme";
import { Avatar, Badge, Btn, Field, styles as ui } from "../ui";
import { decodeTtn } from "../ttn";
import { GameStatus } from "../model";
import {
  useAppSelector,
  updateCurrentPlayerName,
  claimHandle,
  startGame,
  startRobotGame,
  joinGame,
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

  const [gameName, setGameName] = useState("My Amazing Game");
  const [boardSize, setBoardSize] = useState("3");
  const [playerCount, setPlayerCount] = useState("2");
  const [winSeq, setWinSeq] = useState("3");
  const [winCount, setWinCount] = useState("1");
  const [teams, setTeams] = useState(0);
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
      contentContainerStyle={{ padding: 14, paddingTop: insets.top + 8, paddingBottom: 120 }}
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
            10 players, win sequences you choose, chess clocks optional.
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

      <Modal visible={helpOpen} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", padding: 20 }}>
          <View style={[ui.panel, { borderColor: C.accent }]}>
            <Text style={ui.panelTitle}>{"> how to play"}</Text>
            <Text style={[MONO, { color: C.fg, fontSize: 12, marginBottom: 8 }]}>
              line up your win sequence before anyone else. press + robot to
              summon rando, greedo, or minnie-max. share invites to summon
              humans. claim your handle (type it and hit return) to join the
              leaderboard. finished games replay from their notation line.
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

      <View style={ui.panel}>
        <Text style={ui.panelTitle}>{"> start new game"}</Text>
        <Field label="GAME NAME" value={gameName} onChange={setGameName} />
        <View style={ui.row}>
          <Field label="BOARD" value={boardSize} onChange={setBoardSize} numeric />
          <Field label="PLAYERS" value={playerCount} onChange={setPlayerCount} numeric />
          <Field label="WIN SEQ" value={winSeq} onChange={setWinSeq} numeric />
          <Field label="# TO WIN" value={winCount} onChange={setWinCount} numeric />
        </View>
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
              chosenTeams > 0 ? chosenTeams : undefined
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
                  navigation.navigate("Replay", { ttn: game.ttn })
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
    </ScrollView>
  );
};

export default LobbyScreen;
