import { useMemo, useState } from "react";
import { Pressable, ScrollView, Share, Text, View, useWindowDimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, MONO, SYMBOLS, getStatusForViewer, sideOfSeat } from "../theme";
import { sequenceCounts } from "../rules";
import { Avatar, Badge, Btn, Clock, styles as ui } from "../ui";
import { GlassPill } from "../glass";
import { useAppSelector, makeMove, requestRobot, getShareUrl } from "../state";
import { Game, GameInteractionTypes, GameStatus } from "../model";
import { decodeTtn, boardAtFrame } from "../ttn";
import type { RootStackParamList } from "../navigation";

const Board = ({ game, you }: { game: Game; you: string }) => {
  const { width } = useWindowDimensions();
  const cell = Math.floor(
    (width - 28 - (game.boardSize - 1) * 4) / game.boardSize
  );
  return (
    <View style={{ marginVertical: 10 }}>
      {game.positions.map((row, x) => (
        <View key={x} style={{ flexDirection: "row", gap: 4, marginBottom: 4 }}>
          {row.map((value, y) => {
            const rawSeat = game.players.indexOf(value);
            // Team games render by side: teammates share symbol and color.
            const seat =
              rawSeat >= 0 ? sideOfSeat(rawSeat, game.teamCount) : -1;
            const open =
              game.status === GameStatus.GAME_IN_PROGRESS &&
              value === "-" &&
              game.turn === you;
            const winning = game.winningSequence?.some(
              (each) => each.x === x && each.y === y
            );
            return (
              <Pressable
                key={y}
                onPress={() => {
                  if (open) {
                    makeMove(game.gameId, x, y);
                  }
                }}
                style={{
                  width: cell,
                  height: cell,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: winning ? C.accent : C.border,
                  backgroundColor: winning ? C.accentSoft : C.panel,
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
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
};

// Step through a finished game from its TTN line, entirely on-device.
const ReplayView = ({ ttn }: { ttn: string }) => {
  const { width } = useWindowDimensions();
  const decoded = useMemo(() => {
    try {
      return decodeTtn(ttn);
    } catch {
      return null;
    }
  }, [ttn]);
  const [frame, setFrame] = useState(0);
  if (!decoded) {
    return null;
  }
  const total = decoded.moves.length;
  const positions = boardAtFrame(decoded, frame);
  const cell = Math.floor(
    (width - 28 - (decoded.boardSize - 1) * 4) / decoded.boardSize
  );
  const replaySide = (seat: number) => sideOfSeat(seat, decoded.teamCount);
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={[MONO, { color: C.dim, fontSize: 12, marginBottom: 6 }]}>
        {"> replay "}{frame}/{total}
      </Text>
      <View>
        {positions.map((row, x) => (
          <View key={x} style={{ flexDirection: "row", gap: 4, marginBottom: 4 }}>
            {row.map((value, y) => {
              const seat = value === "-" ? -1 : replaySide(Number(value));
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
      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
        <Btn title="|<" ghost onPress={() => setFrame(0)} />
        <Btn title="<" ghost onPress={() => setFrame(Math.max(0, frame - 1))} />
        <Btn title=">" ghost onPress={() => setFrame(Math.min(total, frame + 1))} />
        <Btn title=">|" ghost onPress={() => setFrame(total)} />
      </View>
    </View>
  );
};

const GameScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const you = useAppSelector((state) => state.currentPlayer.playerId);
  const game = useAppSelector((state) =>
    state.currentPlayer.active
      ? state.games[state.currentPlayer.active]
      : undefined
  );
  const players = useAppSelector((state) => state.players);

  if (!game) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <Text style={[MONO, { color: C.dim }]}>$ loading game…</Text>
      </View>
    );
  }

  const status = getStatusForViewer(game, you, players);
  const canAddRobot =
    game.status === GameStatus.WAITING_FOR_PLAYERS &&
    game.players.includes(you);
  const shareable = [
    GameStatus.WAITING_FOR_PLAYERS,
    GameStatus.GAME_IN_PROGRESS,
  ].includes(game.status);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 14, paddingTop: insets.top + 8 }}>
        {/* app-level controls: liquid glass on iOS 26+, terminal fallback */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <GlassPill title="< back" onPress={() => navigation.goBack()} />
          {shareable && (
            <GlassPill
              title="invite ↗"
              onPress={() =>
                Share.share({
                  message: getShareUrl(
                    game.gameId,
                    game.status === GameStatus.WAITING_FOR_PLAYERS
                      ? GameInteractionTypes.PLAY
                      : GameInteractionTypes.SPECTATE
                  ),
                })
              }
            />
          )}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
          <Text style={[MONO, { color: C.fg, fontSize: 17, fontWeight: "700" }]}>
            {game.name}
          </Text>
          <Badge text={status.text} color={status.color} />
        </View>
        {game.winningSequenceCount > 1 &&
          game.status === GameStatus.GAME_IN_PROGRESS && (
            <View style={{ flexDirection: "row", gap: 14, marginBottom: 4 }}>
              {sequenceCounts(
                game.positions,
                game.players,
                game.winningSequenceLength,
                game.teamCount
              ).map((count, side) => (
                <Text
                  key={side}
                  style={[MONO, { color: C.syms[side % 10], fontSize: 11 }]}
                >
                  {game.teamCount > 0 ? `TEAM ${side + 1}` : SYMBOLS[side % 10]}{" "}
                  {count}/{game.winningSequenceCount}
                </Text>
              ))}
            </View>
          )}
        {canAddRobot && (
          <Btn title="+ ROBOT" ghost onPress={() => requestRobot(game.gameId)} />
        )}

        <Board game={game} you={you} />

      {game.notation &&
        [
          GameStatus.GAME_WON,
          GameStatus.GAME_ENDS_IN_A_DRAW,
          GameStatus.GAME_WON_BY_TIMEOUT,
        ].includes(game.status) && <ReplayView ttn={game.notation} />}

        {/* Team games group the roster by side; each side shares a color. */}
        {(game.teamCount > 0
          ? Array.from({ length: game.teamCount }, (_, team) => ({
              title: `> team ${team + 1}`,
              seats: game.players
                .map((playerId, seat) => ({ playerId, seat }))
                .filter(({ seat }) => seat % game.teamCount === team),
            }))
          : [
              {
                title: "> players",
                seats: game.players.map((playerId, seat) => ({
                  playerId,
                  seat,
                })),
              },
            ]
        ).map((group) => (
          <View key={group.title}>
            <Text style={ui.panelTitle}>{group.title}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {group.seats.map(({ playerId, seat }) => {
                const side = sideOfSeat(seat, game.teamCount);
                return (
                  <View
                    key={playerId}
                    style={{
                      borderWidth: 1,
                      borderColor:
                        game.turn === playerId ? C.syms[side % 10] : C.border,
                      backgroundColor: C.panel,
                      padding: 8,
                      alignItems: "center",
                      minWidth: 76,
                      gap: 3,
                    }}
                  >
                    <Text style={[MONO, { color: C.syms[side % 10], fontSize: 18, fontWeight: "700" }]}>
                      {SYMBOLS[side % 10]}
                    </Text>
                    <Avatar name={players[playerId]?.name ?? ""} />
                    <Text style={[MONO, { color: C.dim, fontSize: 10 }]}>
                      {players[playerId]?.name || playerId.slice(0, 6)}
                    </Text>
                    {game.timers?.[playerId] && (
                      <Clock
                        timeLeft={game.timers[playerId].timeLeft}
                        isRunning={game.timers[playerId].isRunning}
                      />
                    )}
                    {game.turn === playerId && (
                      <Text style={[MONO, { color: C.syms[side % 10], fontSize: 9, letterSpacing: 1 }]}>
                        ▮ TURN
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

export default GameScreen;
