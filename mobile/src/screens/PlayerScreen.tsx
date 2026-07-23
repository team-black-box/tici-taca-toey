import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, MONO, kindMark } from "../theme";
import { Badge, styles as ui } from "../ui";
import { GlassPill } from "../glass";
import { fetchPlayerGames } from "../state";
import { decodeTtn } from "../ttn";
import { ArchivedGameSummary, GameStatus } from "../model";
import type { RootStackParamList } from "../navigation";

// Anyone's finished games, by their public handle. Each replays on-device
// from its TTN line - the notation is the game.

const describe = (ttn: string): string => {
  try {
    const decoded = decodeTtn(ttn);
    return [
      `${decoded.boardSize}x${decoded.boardSize}`,
      decoded.winningSequenceCount > 1
        ? `${decoded.winningSequenceCount}x${decoded.winningSequenceLength} to win`
        : `win ${decoded.winningSequenceLength}`,
      decoded.teamCount > 0 ? `${decoded.teamCount} teams` : null,
      decoded.timed ? "timed" : null,
    ]
      .filter(Boolean)
      .join(" · ");
  } catch {
    return "";
  }
};

// The result from this player's seat, so a row reads as it would for them.
const outcomeFor = (game: ArchivedGameSummary, handle: string) => {
  if (game.status === GameStatus.GAME_ENDS_IN_A_DRAW) {
    return { text: "DREW", color: C.info };
  }
  if (game.status === GameStatus.GAME_ABANDONED) {
    return { text: "ABANDONED", color: C.danger };
  }
  const seat = game.players.find(
    (player) => player.handle.toLowerCase() === handle.toLowerCase()
  )?.seat;
  if (game.winnerSeat === null || seat === undefined) {
    return { text: "FINISHED", color: C.info };
  }
  let won = game.winnerSeat === seat;
  try {
    const teams = decodeTtn(game.ttn).teamCount;
    if (teams > 0) {
      won = game.winnerSeat % teams === seat % teams;
    }
  } catch {
    // undecodable line - the seat comparison stands
  }
  return won
    ? { text: "WON", color: C.info }
    : { text: "LOST", color: C.danger };
};

const PlayerScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<RouteProp<RootStackParamList, "Player">>();
  const [games, setGames] = useState<ArchivedGameSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPlayerGames(params.handle)
      .then((data) => {
        if (!cancelled) {
          setGames(data.games ?? []);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [params.handle]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 14, paddingTop: insets.top + 8, paddingBottom: 120 }}
      >
        <View style={{ flexDirection: "row", marginBottom: 12 }}>
          <GlassPill title="< back" onPress={() => navigation.goBack()} />
        </View>
        <Text style={[MONO, { color: C.accent, fontSize: 18, fontWeight: "700", marginBottom: 10 }]}>
          {`> ${params.handle}`}
        </Text>

        {loaded && games.length === 0 && (
          <Text style={[MONO, { color: C.dim }]}>
            $ no finished games yet
          </Text>
        )}

        {games.map((game) => {
          const outcome = outcomeFor(game, params.handle);
          return (
            <Pressable
              key={game.gameId}
              style={ui.tile}
              onPress={() => navigation.navigate("Replay", { ttn: game.ttn })}
            >
              <View>
                <Badge text={outcome.text} color={outcome.color} />
                <Text style={[MONO, { color: C.dim, fontSize: 10, marginTop: 6 }]}>
                  {game.players
                    .map((player) => player.handle + kindMark(player.kind))
                    .join(" vs ")}
                </Text>
              </View>
              <Text style={ui.tileMeta}>{describe(game.ttn)}</Text>
            </Pressable>
          );
        })}
        {games.length > 0 && (
          <Text style={[MONO, { color: C.dim, fontSize: 10 }]}>
            tap a game to replay it
          </Text>
        )}
      </ScrollView>
    </View>
  );
};

export default PlayerScreen;
