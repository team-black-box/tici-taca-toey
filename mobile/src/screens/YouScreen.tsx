import { useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, MONO } from "../theme";
import { Avatar, Badge, Btn, styles as ui } from "../ui";
import { decodeTtn } from "../ttn";
import { GameStatus } from "../model";
import { APP_VERSION, PRIVACY_URL, TERMS_URL } from "../version";
import {
  useAppSelector,
  updateCurrentPlayerName,
  claimHandle,
  exportSyncUrl,
  importIdentity,
} from "../state";
import type { RootStackParamList } from "../navigation";

// Everything about *you*, in the place a phone puts it.
//
// All of this used to live on the lobby, because the lobby was a
// transcription of the web layout - where a persistent sidebar and rail
// give the handle, your history, help, and the legal links somewhere to
// sit without being in the way. A phone has no sidebar, so on mobile
// that all became one long scroll in front of the thing you came to do,
// which is play. It belongs behind a tab instead.
const YouScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const name = useAppSelector((state) => state.currentPlayer.name);
  const history = useAppSelector((state) => state.history);
  const [syncCode, setSyncCode] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <ScrollView
      style={{ backgroundColor: C.bg }}
      contentContainerStyle={{
        padding: 14,
        paddingTop: insets.top + 8,
        paddingBottom: 190,
      }}
    >
      <View style={ui.panel}>
        <Text style={ui.panelTitle}>{"> your handle"}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <TextInput
            style={[ui.input, { flex: 1 }]}
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
          <Avatar name={name} size={13} />
        </View>
        <Text style={[MONO, { color: C.dim, fontSize: 10, marginTop: 8 }]}>
          type a handle and hit return to claim it. claimed handles are
          unique and put you on the leaderboard.
        </Text>
        {name.trim().length > 0 && (
          <View style={{ marginTop: 10 }}>
            <Btn
              title="YOUR PUBLIC PROFILE >"
              ghost
              onPress={() =>
                navigation.navigate("Player", { handle: name.trim() })
              }
            />
          </View>
        )}
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
          {history.length > 10 && name.trim().length > 0 && (
            <Btn
              title={`SEE ALL ${history.length} GAMES`}
              ghost
              onPress={() =>
                navigation.navigate("Player", { handle: name.trim() })
              }
            />
          )}
        </View>
      )}

      <View style={ui.panel}>
        <Text style={ui.panelTitle}>{"> sync devices"}</Text>
        <Btn
          title="SHARE MY SYNC CODE"
          ghost
          onPress={() => Share.share({ message: exportSyncUrl() })}
        />
        <Text style={[MONO, { color: C.dim, fontSize: 10, marginVertical: 6 }]}>
          the code is your account - share it with no one else. paste a code
          from another device below to import that identity here.
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
            }}
          />
        )}
      </View>

      <View style={ui.panel}>
        <Pressable onPress={() => setHelpOpen(!helpOpen)}>
          <Text style={ui.panelTitle}>
            {helpOpen ? "> how to play (tap to close)" : "> how to play"}
          </Text>
        </Pressable>
        {/* Inline rather than a modal: this is a tab now, so there is
            nothing to get back to and nothing to trap. */}
        {helpOpen && (
          <>
            <Text style={[MONO, { color: C.fg, fontSize: 12, marginBottom: 8 }]}>
              tic-tac-toe with the dials exposed. take turns placing your
              mark; win by making a line - marks in a row across, down, or
              diagonally - before anyone else.
            </Text>
            <Text style={[MONO, { color: C.fg, fontSize: 12, marginBottom: 4 }]}>
              <Text style={{ color: C.accent }}>in a row</Text> - how long a
              line has to be. 3 is classic; on a big board try 4 or 5.
            </Text>
            <Text style={[MONO, { color: C.fg, fontSize: 12, marginBottom: 8 }]}>
              <Text style={{ color: C.accent }}>lines</Text> - how many
              separate lines you need. usually 1. set it higher and the game
              runs until someone completes that many (lines may cross, like a
              crossword).
            </Text>
            <Text style={[MONO, { color: C.fg, fontSize: 12, marginBottom: 8 }]}>
              boards go 2-12, players 2-10. in a team game your teammates'
              marks count toward the same lines. timed games run chess
              clocks: run out and you lose. gg forfeits.
            </Text>
            <Text style={[MONO, { color: C.fg, fontSize: 12, marginBottom: 8 }]}>
              play a robot now summons an opponent: rando plays chaos, greedo
              blocks and pounces, minnie-max never loses a 3x3. invite humans
              with the share link. watch anything live from the watch tab.
            </Text>
            <Text style={[MONO, { color: C.fg, fontSize: 12, marginBottom: 8 }]}>
              while a game is live you can see where the others are thinking,
              as a dim ghost of their mark. teammates and spectators always
              see them; opponents only if the host turned "show cursors to
              everyone" on at the start. a hover you do not mean is a
              perfectly good bluff. your phone shows everyone else's but
              sends none of its own - a finger has no hover.
            </Text>
          </>
        )}
      </View>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 6,
          marginTop: 10,
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
        <Text style={[MONO, { color: C.dim, fontSize: 10 }]}>v{APP_VERSION}</Text>
      </View>
    </ScrollView>
  );
};

export default YouScreen;
