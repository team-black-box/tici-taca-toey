import { useMemo, useState } from "react";
import { Pressable, ScrollView, Share, Text, View, useWindowDimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, MONO, SYMBOLS } from "../theme";
import { Badge, Btn, styles as ui } from "../ui";
import { GlassPill } from "../glass";
import { dailyPuzzle, dayKey, shareDaily } from "../daily";
import { cellName } from "../analysis";
import * as storage from "../storage";
import type { RootStackParamList } from "../navigation";

// One position a day, the same for everyone, and nobody else required.
// The one screen in this app that works with no opponent, no lobby, and
// - once loaded - no server at all: the board comes from the date.
//
// Progress is stored per day so wandering off and back does not reset
// it. Async storage means a first paint without it, which is fine: an
// unsolved board is the correct thing to show while it loads.
const DailyScreen = () => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const day = dayKey();
  const puzzle = useMemo(() => dailyPuzzle(day), [day]);
  const [solved, setSolved] = useState(false);
  const [guesses, setGuesses] = useState(0);
  const [wrong, setWrong] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  if (!loaded) {
    setLoaded(true);
    storage
      .getString(`daily:${day}`)
      .then((raw) => {
        if (!raw) {
          return;
        }
        const saved = JSON.parse(raw) as {
          solved: boolean;
          guesses: number;
          wrong: string[];
        };
        setSolved(saved.solved);
        setGuesses(saved.guesses);
        setWrong(saved.wrong ?? []);
      })
      .catch(() => undefined);
  }

  const cell = Math.floor(
    (width - 28 - (puzzle.boardSize - 1) * 4) / puzzle.boardSize
  );

  const guess = (x: number, y: number) => {
    if (solved || puzzle.positions[x][y] !== "-") {
      return;
    }
    const key = `${x}:${y}`;
    if (wrong.includes(key)) {
      return;
    }
    const right = x === puzzle.solution.x && y === puzzle.solution.y;
    const nextWrong = right ? wrong : [...wrong, key];
    const nextGuesses = guesses + 1;
    setSolved(right);
    setGuesses(nextGuesses);
    setWrong(nextWrong);
    storage.setString(
      `daily:${day}`,
      JSON.stringify({ solved: right, guesses: nextGuesses, wrong: nextWrong })
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 14, paddingTop: insets.top + 8, paddingBottom: 150 }}>
        <View style={{ flexDirection: "row", marginBottom: 12 }}>
          <GlassPill title="< back" onPress={() => navigation.goBack()} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Text style={[MONO, { color: C.fg, fontSize: 17, fontWeight: "700" }]}>
            daily
          </Text>
          <Badge text={day} color={C.info} />
          {solved && (
            <Badge
              text={`SOLVED IN ${guesses} ${guesses === 1 ? "TRY" : "TRIES"}`}
              color={C.accent}
            />
          )}
        </View>
        <Text style={[MONO, { color: C.dim, fontSize: 11, marginTop: 4, marginBottom: 10 }]}>
          {`> goal: you are ${SYMBOLS[0]} - find the one move that wins, ${puzzle.winningSequenceLength} in a row`}
        </Text>

        <View>
          {puzzle.positions.map((row, x) => (
            <View key={x} style={{ flexDirection: "row", gap: 4, marginBottom: 4 }}>
              {row.map((value, y) => {
                const seat = value === "-" ? -1 : Number(value);
                const isWrong = wrong.includes(`${x}:${y}`);
                const isSolution =
                  solved && x === puzzle.solution.x && y === puzzle.solution.y;
                const open = seat < 0 && !solved && !isWrong;
                return (
                  <Pressable
                    key={y}
                    onPress={() => guess(x, y)}
                    style={{
                      width: cell,
                      height: cell,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: isSolution
                        ? C.accent
                        : isWrong
                        ? C.danger
                        : C.border,
                      backgroundColor: isSolution ? C.accentSoft : C.panel,
                      opacity: open || isSolution || seat >= 0 ? 1 : 0.55,
                    }}
                  >
                    <Text
                      style={[
                        MONO,
                        {
                          fontSize: cell * 0.45,
                          fontWeight: "700",
                          color: isSolution
                            ? C.syms[0]
                            : isWrong
                            ? C.danger
                            : seat >= 0
                            ? C.syms[seat % 10]
                            : C.fg,
                        },
                      ]}
                    >
                      {isSolution
                        ? SYMBOLS[0]
                        : isWrong
                        ? "×"
                        : seat >= 0
                        ? SYMBOLS[seat % 10]
                        : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {solved ? (
          <>
            <Text style={[MONO, { color: C.warn, fontSize: 12, marginTop: 10 }]}>
              {`> ${cellName(puzzle.solution.x, puzzle.solution.y)} - that is the one. see you tomorrow.`}
            </Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <Btn
                title="SHARE RESULT"
                onPress={() =>
                  Share.share({ message: shareDaily(puzzle, true, guesses) })
                }
              />
              <Btn
                title="PLAY A REAL GAME >"
                ghost
                onPress={() => navigation.goBack()}
              />
            </View>
          </>
        ) : (
          <Text style={[MONO, { color: C.dim, fontSize: 11, marginTop: 10 }]}>
            {wrong.length === 0
              ? `${SYMBOLS[1]} moved last. one square ends it - tap it.`
              : `${wrong.length} wrong so far. the win is still there.`}
          </Text>
        )}
      </ScrollView>
    </View>
  );
};

export default DailyScreen;
