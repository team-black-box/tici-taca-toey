import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, MONO, kindMark } from "../theme";
import { Btn, styles as ui } from "../ui";
import { fetchLeaderboard } from "../state";
import { PlayerKind } from "../model";
import type { RootStackParamList } from "../navigation";

// The full standings, sortable on any column. Rows are keyed by handle -
// the identity a player chose to publish - so each one opens that
// player's games.

interface Row {
  handle: string;
  kind: string;
  rating: number;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
}

type SortKey = keyof Omit<Row, "kind">;

const COLUMNS: Array<{ key: SortKey; label: string; width: number }> = [
  { key: "handle", label: "player", width: 130 },
  { key: "rating", label: "rating", width: 62 },
  { key: "games", label: "games", width: 56 },
  { key: "wins", label: "won", width: 46 },
  { key: "draws", label: "drew", width: 48 },
  { key: "losses", label: "lost", width: 48 },
  { key: "winRate", label: "win %", width: 56 },
];

const LeaderboardScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [rows, setRows] = useState<Row[]>([]);
  const [pool, setPool] = useState("global");
  const [pools, setPools] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("rating");
  const [ascending, setAscending] = useState(false);
  // Humans and machines share one board - a robot beating you should
  // sting - but "how am I doing against people" and "how good are the
  // machines" are different questions. A view, never a separate rating.
  const [who, setWho] = useState<"all" | "humans" | "machines">("all");

  useEffect(() => {
    let cancelled = false;
    fetchLeaderboard(pool)
      .then((data) => {
        if (!cancelled) {
          setRows(data.rows ?? []);
          setPools(data.pools ?? []);
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
  }, [pool]);

  const visible = useMemo(
    () =>
      rows.filter((row) =>
        who === "all"
          ? true
          : who === "humans"
          ? row.kind === "human"
          : row.kind !== "human"
      ),
    [rows, who]
  );

  const sorted = useMemo(() => {
    const copy = [...visible];
    copy.sort((a, b) => {
      const left = a[sortKey];
      const right = b[sortKey];
      const compared =
        typeof left === "string" && typeof right === "string"
          ? left.localeCompare(right)
          : Number(left) - Number(right);
      return ascending ? compared : -compared;
    });
    return copy;
  }, [visible, sortKey, ascending]);

  const sortBy = (key: SortKey) => {
    if (key === sortKey) {
      setAscending(!ascending);
      return;
    }
    setSortKey(key);
    setAscending(key === "handle");
  };

  // Keyed by column, never by content. It used to be `width + value`,
  // which collides the moment two columns share a width and a value -
  // and "drew" and "lost" are both 48 wide, so every player with equal
  // draws and losses (i.e. almost everyone, both being 0) rendered two
  // children with the same key. React warns and reserves the right to
  // duplicate or drop them.
  const cell = (
    column: SortKey,
    value: string,
    width: number,
    color = C.fg
  ) => (
    <Text
      style={[MONO, { width, color, fontSize: 11 }]}
      numberOfLines={1}
      key={column}
    >
      {value}
    </Text>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 14, paddingTop: insets.top + 8, paddingBottom: 120 }}
      >
        <View style={{ flexDirection: "row", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          {(["all", "humans", "machines"] as const).map((option) => (
            <Btn
              key={option}
              title={option.toUpperCase()}
              ghost={who !== option}
              onPress={() => setWho(option)}
            />
          ))}
        </View>
        <Text style={[MONO, { color: C.accent, fontSize: 18, fontWeight: "700", marginBottom: 4 }]}>
          {"> leaderboard"}
        </Text>
        <Text style={[MONO, { color: C.dim, fontSize: 11, marginBottom: 10 }]}>
          {pool === "global"
            ? "one rating across every game, weighted by how hard it was"
            : `pool ${pool}`}
        </Text>

        {pools.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
              {pools.map((name) => (
                <Btn
                  key={name}
                  title={name}
                  ghost={pool !== name}
                  onPress={() => setPool(name)}
                />
              ))}
            </View>
          </ScrollView>
        )}

        {/* The point of the machines view is not the filter, it is that
            anyone can add one. Same line the web carries. */}
        {who === "machines" && (
          <View style={{ marginBottom: 10 }}>
            <Text style={[MONO, { color: C.dim, fontSize: 11, lineHeight: 16 }]}>
              robots play through the SDK in about ten lines; agents connect
              over MCP with just a url. cloney was trained on the public game
              corpus - every finished game here feeds it.
            </Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <Btn
                title="BUILD A ROBOT >"
                ghost
                onPress={() =>
                  Linking.openURL(
                    "https://github.com/team-black-box/tici-taca-toey/tree/main/sdk"
                  )
                }
              />
              <Btn
                title="MCP >"
                ghost
                onPress={() =>
                  Linking.openURL(
                    "https://github.com/team-black-box/tici-taca-toey/tree/main/mcp"
                  )
                }
              />
            </View>
          </View>
        )}

        {loaded && sorted.length === 0 && (
          <Text style={[MONO, { color: C.dim }]}>
            $ no rated games yet - play one and you are on the board
          </Text>
        )}

        {sorted.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              {/* header: tap to sort */}
              <View
                style={{
                  flexDirection: "row",
                  borderBottomWidth: 1,
                  borderBottomColor: C.border,
                  paddingBottom: 6,
                  marginBottom: 4,
                }}
              >
                {COLUMNS.map((column) => (
                  <Pressable
                    key={column.key}
                    onPress={() => sortBy(column.key)}
                    style={{ width: column.width }}
                  >
                    <Text
                      style={[
                        MONO,
                        {
                          fontSize: 10,
                          letterSpacing: 1,
                          color: sortKey === column.key ? C.accent : C.dim,
                        },
                      ]}
                    >
                      {column.label}
                      {sortKey === column.key ? (ascending ? " ▲" : " ▼") : ""}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {sorted.map((row, index) => (
                <Pressable
                  key={row.handle}
                  onPress={() =>
                    navigation.navigate("Player", { handle: row.handle })
                  }
                  style={{
                    flexDirection: "row",
                    paddingVertical: 7,
                    borderBottomWidth: 1,
                    borderBottomColor: C.border,
                  }}
                >
                  {cell(
                    COLUMNS[0].key,
                    `${index + 1}. ${row.handle}${kindMark(
                      row.kind as PlayerKind
                    )}`,
                    COLUMNS[0].width
                  )}
                  {cell(COLUMNS[1].key, String(row.rating), COLUMNS[1].width, C.accent)}
                  {cell(COLUMNS[2].key, String(row.games), COLUMNS[2].width, C.dim)}
                  {cell(COLUMNS[3].key, String(row.wins), COLUMNS[3].width, C.dim)}
                  {cell(COLUMNS[4].key, String(row.draws), COLUMNS[4].width, C.dim)}
                  {cell(COLUMNS[5].key, String(row.losses), COLUMNS[5].width, C.dim)}
                  {cell(COLUMNS[6].key, `${row.winRate}%`, COLUMNS[6].width, C.dim)}
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}
        {sorted.length > 0 && (
          <Text style={[MONO, { color: C.dim, fontSize: 10, marginTop: 10 }]}>
            tap a player to watch their games
          </Text>
        )}
      </ScrollView>
    </View>
  );
};

export default LeaderboardScreen;
