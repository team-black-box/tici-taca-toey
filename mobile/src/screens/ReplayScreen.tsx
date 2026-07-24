import { useMemo, useState } from "react";
import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, MONO, SYMBOLS, kindMark, sideOfSeat } from "../theme";
import { Btn, styles as ui } from "../ui";
import { GlassPill } from "../glass";
import { decodeTtn, boardAtFrame } from "../ttn";
import { describeGoal } from "../rules";
import type { RootStackParamList } from "../navigation";

// Replay any finished game from its TTN line, entirely on-device - the
// notation is the replay, exactly as on the web.
const ReplayScreen = () => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<RouteProp<RootStackParamList, "Replay">>();
  const decoded = useMemo(() => {
    try {
      return decodeTtn(params.ttn);
    } catch {
      return null;
    }
  }, [params.ttn]);
  const [frame, setFrame] = useState(0);

  if (!decoded) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <Text style={[MONO, { color: C.dim }]}>$ not a valid TTN line</Text>
      </View>
    );
  }

  const total = decoded.moves.length;
  const positions = boardAtFrame(decoded, frame);
  const cell = Math.floor(
    (width - 28 - (decoded.boardSize - 1) * 4) / decoded.boardSize
  );
  const resultText =
    decoded.result.kind === "draw"
      ? "draw"
      : decoded.result.kind === "abandoned"
      ? "abandoned"
      : `${
          decoded.result.winnerTeam !== undefined
            ? `team ${decoded.result.winnerTeam + 1}`
            : SYMBOLS[(decoded.result.winnerSeat ?? 0) % 10]
        } wins${decoded.result.kind === "timeout" ? " on time" : ""}`;
  // The same words the game header showed while it was being played.
  const goal =
    describeGoal({
      boardSize: decoded.boardSize,
      winningSequenceLength: decoded.winningSequenceLength,
      winningSequenceCount: decoded.winningSequenceCount,
      teamCount: decoded.teamCount,
    }) + (decoded.timed ? " · timed" : "");
  // Who won, per seat: a team result crowns everyone on that team.
  const isWinner = (seat: number): boolean => {
    if (decoded.result.kind !== "win" && decoded.result.kind !== "timeout") {
      return false;
    }
    return decoded.result.winnerTeam !== undefined
      ? sideOfSeat(seat, decoded.teamCount) === decoded.result.winnerTeam
      : seat === decoded.result.winnerSeat;
  };
  const roster = params.roster ?? [];
  const seats = Array.from({ length: decoded.playerCount }, (_, seat) => seat);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 14, paddingTop: insets.top + 8 }}>
        <View style={{ flexDirection: "row", marginBottom: 12 }}>
          <GlassPill title="< back" onPress={() => navigation.goBack()} />
        </View>
        <Text style={[MONO, { color: C.fg, fontSize: 17, fontWeight: "700" }]}>
          replay
        </Text>
        <Text style={[MONO, { color: C.dim, fontSize: 12, marginTop: 2 }]}>
          {frame}/{total} · {resultText}
        </Text>
        <Text style={[MONO, { color: C.dim, fontSize: 11, marginTop: 2 }]}>
          {"> goal: "}
          {goal}
        </Text>
        {/* Who was which symbol. Without a roster this reads as seat
            numbers, which is still better than an unlabelled board. */}
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 6,
            marginTop: 8,
            marginBottom: 8,
          }}
        >
          {seats.map((seat) => {
            const side = sideOfSeat(seat, decoded.teamCount);
            const player = roster.find((entry) => entry.seat === seat);
            const won = isWinner(seat);
            return (
              <View
                key={seat}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderWidth: 1,
                  borderColor: won ? C.accent : C.border,
                  backgroundColor: C.panel,
                }}
              >
                <Text
                  style={[
                    MONO,
                    {
                      color: C.syms[side % 10],
                      fontSize: 14,
                      fontWeight: "700",
                    },
                  ]}
                >
                  {SYMBOLS[side % 10]}
                </Text>
                <Text style={[MONO, { color: C.fg, fontSize: 11 }]}>
                  {player ? player.handle : `seat ${seat + 1}`}
                  {player ? kindMark(player.kind) : ""}
                </Text>
                {decoded.teamCount > 0 && (
                  <Text style={[MONO, { color: C.dim, fontSize: 10 }]}>
                    team {side + 1}
                  </Text>
                )}
                {won && (
                  <Text style={[MONO, { color: C.accent, fontSize: 9 }]}>
                    WON
                  </Text>
                )}
              </View>
            );
          })}
        </View>
        <View>
          {positions.map((row, x) => (
            <View key={x} style={{ flexDirection: "row", gap: 4, marginBottom: 4 }}>
              {row.map((value, y) => {
                const seat =
                  value === "-"
                    ? -1
                    : sideOfSeat(Number(value), decoded.teamCount);
                return (
                  <View
                    key={y}
                    style={{
                      width: cell,
                      height: cell,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: C.border,
                      backgroundColor: C.panel,
                    }}
                  >
                    <Text
                      style={[
                        MONO,
                        {
                          fontSize: cell * 0.45,
                          fontWeight: "700",
                          color: seat >= 0 ? C.syms[seat % 10] : C.fg,
                        },
                      ]}
                    >
                      {seat >= 0 ? SYMBOLS[seat % 10] : ""}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
          <Btn title="|<" ghost onPress={() => setFrame(0)} />
          <Btn title="<" ghost onPress={() => setFrame(Math.max(0, frame - 1))} />
          <Btn title=">" ghost onPress={() => setFrame(Math.min(total, frame + 1))} />
          <Btn title=">|" ghost onPress={() => setFrame(total)} />
        </View>
        <Text style={[MONO, { color: C.dim, fontSize: 10, marginTop: 10 }]}>
          the notation line is the whole game - nothing is fetched
        </Text>
      </ScrollView>
    </View>
  );
};

export default ReplayScreen;
