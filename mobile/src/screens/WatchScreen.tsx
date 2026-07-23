import { ScrollView, Text, Pressable, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, MONO } from "../theme";
import { Activity, Badge, styles as ui } from "../ui";
import { useAppSelector, spectateGame, setActiveGame } from "../state";
import { GameStatus } from "../model";
import type { RootStackParamList } from "../navigation";

const WatchScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const lobby = useAppSelector((state) => state.lobby);
  const playing = useAppSelector((state) => state.currentPlayer.playing);
  const spectating = useAppSelector((state) => state.currentPlayer.spectating);

  const watchable = lobby.filter(
    (summary) => !playing.includes(summary.gameId)
  );

  return (
    <ScrollView
      style={{ backgroundColor: C.bg }}
      contentContainerStyle={{ padding: 14, paddingTop: insets.top + 8, paddingBottom: 120 }}
    >
      <Text style={[MONO, { color: C.accent, fontSize: 18, fontWeight: "700", marginBottom: 14 }]}>
        {"> live on the server"}
      </Text>
      {watchable.length === 0 && (
        <Text style={[MONO, { color: C.dim }]}>
          $ nothing running right now - start one from the play tab
        </Text>
      )}
      {watchable.map((summary) => {
        const live = summary.status === GameStatus.GAME_IN_PROGRESS;
        return (
          <Pressable
            key={summary.gameId}
            style={ui.tile}
            onPress={() => {
              if (spectating.includes(summary.gameId)) {
                setActiveGame(summary.gameId);
              } else {
                spectateGame(summary.gameId);
              }
              navigation.navigate("Game");
            }}
          >
            <View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={ui.tileName}>{summary.name}</Text>
                {live && <Activity />}
              </View>
              <Badge
                text={
                  live
                    ? "LIVE"
                    : `WAITING (${summary.humanCount + summary.robotCount}/${summary.playerCount})`
                }
                color={live ? C.accent : C.warn}
              />
            </View>
            <Text style={ui.tileMeta}>
              {summary.boardSize}x{summary.boardSize}
              {summary.openSeats ? "  · open" : ""}
              {"\n"}
              {summary.humanCount} 웃  {summary.robotCount} ⚙  {summary.agentCount} ✦  {summary.spectatorCount} 👁
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

export default WatchScreen;
