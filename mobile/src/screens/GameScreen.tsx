import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  C,
  MONO,
  SYMBOLS,
  getStatusForViewer,
  sideOfSeat,
  kindLabel,
  kindMark,
} from "../theme";
import { sequenceCounts, describeGoal } from "../rules";
import { Avatar, Badge, Btn, Clock, KindMark, styles as ui } from "../ui";
import { GlassPill } from "../glass";
import { Burst } from "../burst";
import {
  useAppSelector,
  makeMove,
  requestRobot,
  openSeats,
  joinGame,
  forfeit,
  getShareUrl,
  subscribeToCursors,
} from "../state";
import {
  CursorTuple,
  Game,
  GameInteractionTypes,
  GameStatus,
} from "../model";
import { decodeTtn, boardAtFrame } from "../ttn";
import type { RootStackParamList } from "../navigation";

// Which cell just changed, so exactly one lands with a strike. Diffing
// the board catches opponents' moves too, without the server having to
// say which was last. Mirrors web/src/features/game/board/Board.tsx.
const useLastPlacement = (positions: string[][]) => {
  const previous = useRef<string[][] | undefined>(undefined);
  const [struck, setStruck] = useState<string | null>(null);
  useEffect(() => {
    const before = previous.current;
    previous.current = positions;
    if (!before || before.length !== positions.length) {
      return;
    }
    let landed: string | null = null;
    positions.forEach((row, x) =>
      row.forEach((cell, y) => {
        if (before[x]?.[y] !== cell && cell !== "-") {
          landed = `${x}:${y}`;
        }
      })
    );
    if (!landed) {
      return;
    }
    setStruck(landed);
    const timer = setTimeout(() => setStruck(null), 600);
    return () => clearTimeout(timer);
  }, [positions]);
  return struck;
};

// A mark landing flares and settles - two blades meeting.
const StrikeCell = ({
  active,
  children,
  style,
}: {
  active: boolean;
  children: React.ReactNode;
  style: object;
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active) {
      return;
    }
    scale.setValue(0.55);
    Animated.spring(scale, {
      toValue: 1,
      friction: 4,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [active, scale]);
  return (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      {children}
    </Animated.View>
  );
};

// The other people in this game, hovering. Receive-only: a finger has no
// hover, so this app draws everyone else's cursors and never sends one.
// Whether an opponent's cursor arrives at all is the server's call - see
// Game.showCursors; teammates and spectators always get them.
const CursorGhosts = ({
  game,
  mySeat,
  cell,
}: {
  game: Game;
  mySeat: number;
  cell: number;
}) => {
  const [cursors, setCursors] = useState<CursorTuple[]>([]);

  useEffect(
    () => subscribeToCursors(game.gameId, setCursors),
    [game.gameId]
  );

  if (game.status !== GameStatus.GAME_IN_PROGRESS) {
    return null;
  }

  // The board lays cells out with a 4px gap, so a cell's origin is simply
  // its index times the pitch.
  const pitch = cell + 4;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {cursors
        .filter(([seat]) => seat !== mySeat)
        .map(([seat, x, y]) => (
          <View
            key={seat}
            style={{
              position: "absolute",
              left: y * pitch,
              top: x * pitch,
              width: cell,
              height: cell,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={[
                MONO,
                {
                  fontSize: cell * 0.4,
                  fontWeight: "700",
                  opacity: 0.45,
                  color: C.syms[sideOfSeat(seat, game.teamCount) % 10],
                },
              ]}
            >
              {SYMBOLS[sideOfSeat(seat, game.teamCount) % 10]}
            </Text>
          </View>
        ))}
    </View>
  );
};

const Board = ({ game, you }: { game: Game; you: string }) => {
  const { width } = useWindowDimensions();
  const struck = useLastPlacement(game.positions);
  const cell = Math.floor(
    (width - 28 - (game.boardSize - 1) * 4) / game.boardSize
  );
  return (
    <View style={{ marginVertical: 10 }}>
      <CursorGhosts
        game={game}
        mySeat={game.players.indexOf(you)}
        cell={cell}
      />
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
                  // Sparks fly past the cell edge; Android clips overflow
                  // by default, so say so explicitly.
                  overflow: "visible",
                }}
              >
                {struck === `${x}:${y}` && seat >= 0 && (
                  <Burst
                    active
                    color={C.syms[seat % 10]}
                    scale={cell}
                  />
                )}
                <StrikeCell
                  active={struck === `${x}:${y}`}
                  style={{ alignItems: "center", justifyContent: "center" }}
                >
                  <Text
                    style={[
                      MONO,
                      {
                        fontSize: cell * 0.45,
                        fontWeight: "700",
                        color: seat >= 0 ? C.syms[seat % 10] : C.fg,
                        textShadowColor:
                          struck === `${x}:${y}` && seat >= 0
                            ? C.syms[seat % 10]
                            : "transparent",
                        textShadowRadius: struck === `${x}:${y}` ? 14 : 0,
                      },
                    ]}
                  >
                    {seat >= 0 ? SYMBOLS[seat % 10] : ""}
                  </Text>
                </StrikeCell>
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
  const isPlayer = game.players.includes(you);
  const canAddRobot =
    game.status === GameStatus.WAITING_FOR_PLAYERS && isPlayer;
  // A spectator of a game still waiting with room can take a seat.
  const canTakeSeat =
    !isPlayer &&
    game.status === GameStatus.WAITING_FOR_PLAYERS &&
    game.players.length < game.playerCount;
  const canForfeit = game.status === GameStatus.GAME_IN_PROGRESS && isPlayer;
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
          {/* Cursor visibility is fixed at game start, so the game says
              which mode it is in - being watched unknowingly would be a
              trap rather than a bluff. */}
          {game.showCursors && (
            <Badge text="👁 CURSORS VISIBLE" color={C.accent} />
          )}
        </View>
        {/* Always say what winning looks like, so nobody has to guess. */}
        <Text style={[MONO, { color: C.dim, fontSize: 11, marginBottom: 8 }]}>
          {"> goal: "}
          {describeGoal({
            boardSize: game.boardSize,
            winningSequenceLength: game.winningSequenceLength,
            winningSequenceCount: game.winningSequenceCount,
            teamCount: game.teamCount,
          })}
        </Text>
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
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            <Btn title="+ ROBOT" ghost onPress={() => requestRobot(game.gameId)} />
            <Btn
              title={game.openSeats ? "✓ OPEN TO ANYONE" : "+ OPEN TO ANYONE"}
              ghost={!game.openSeats}
              onPress={() => openSeats(game.gameId, !game.openSeats)}
            />
          </View>
        )}
        {canTakeSeat && (
          <Btn
            title="TAKE A SEAT"
            onPress={() => joinGame(game.gameId)}
          />
        )}
        {canForfeit && (
          <Pressable
            style={{
              borderWidth: 1,
              borderColor: C.danger,
              paddingVertical: 8,
              paddingHorizontal: 12,
              alignSelf: "flex-start",
              marginTop: 4,
            }}
            onPress={() =>
              Alert.alert("Forfeit?", "Concede this game. gg.", [
                { text: "cancel", style: "cancel" },
                {
                  text: "gg, forfeit",
                  style: "destructive",
                  onPress: () => forfeit(game.gameId),
                },
              ])
            }
          >
            <Text style={[MONO, { color: C.danger, fontSize: 12, letterSpacing: 1 }]}>
              GG (FORFEIT)
            </Text>
          </Pressable>
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
                    <Text
                      style={[MONO, { color: C.dim, fontSize: 10 }]}
                      accessibilityLabel={kindLabel(players[playerId]?.kind)}
                    >
                      {players[playerId]?.name || playerId.slice(0, 6)}
                      {kindMark(players[playerId]?.kind)}
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
