// Small shared terminal-styled building blocks.
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useEffect, useRef, useState } from "react";
import { C, MONO, formatClock, generateAvatar, FEEDBACK_COLOR, kindMark } from "./theme";
import { PlayerKind } from "./model";
import { useAppSelector } from "./state";

const FEEDBACK_PREFIX = { ok: "✓", info: "~", warn: "!", err: "✗" } as const;

// The terminal status feed as a slim banner under the header.
export const FeedbackBanner = () => {
  const events = useAppSelector((state) => state.feedback);
  if (events.length === 0) {
    return null;
  }
  return (
    <View style={{ paddingHorizontal: 14, gap: 3 }}>
      {events.map((event) => (
        <Text
          key={event.id}
          style={[
            MONO,
            {
              fontSize: 11,
              color: FEEDBACK_COLOR[event.kind],
              borderWidth: 1,
              borderColor: FEEDBACK_COLOR[event.kind],
              paddingHorizontal: 8,
              paddingVertical: 3,
              alignSelf: "center",
              backgroundColor: C.panel,
            },
          ]}
        >
          {FEEDBACK_PREFIX[event.kind]} {event.text}
        </Text>
      ))}
    </View>
  );
};

export const Avatar = ({ name, size = 10 }: { name: string; size?: number }) => {
  const face = generateAvatar(name);
  return (
    <Text
      style={[
        MONO,
        {
          color: face.color,
          fontSize: size,
          lineHeight: size,
          textShadowColor: face.color,
          textShadowRadius: 6,
        },
      ]}
    >
      {face.rows.join("\n")}
    </Text>
  );
};

// A machine's mark next to its name: gear for an SDK robot, spark for an
// agent connected over MCP.
export const KindMark = ({
  kind,
  size = 10,
  color = C.dim,
}: {
  kind: PlayerKind | undefined;
  size?: number;
  color?: string;
}) => {
  const mark = kindMark(kind);
  return mark ? (
    <Text style={[MONO, { color, fontSize: size }]}>{" " + mark}</Text>
  ) : null;
};

// Three dots marching, so a live game reads as busy in a list.
export const Activity = () => {
  const dots = [useRef(new Animated.Value(0.2)).current, useRef(new Animated.Value(0.2)).current, useRef(new Animated.Value(0.2)).current];
  useEffect(() => {
    const loops = dots.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 150),
          Animated.timing(value, { toValue: 1, duration: 450, useNativeDriver: true }),
          Animated.timing(value, { toValue: 0.2, duration: 450, useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, []);
  return (
    <View style={{ flexDirection: "row", gap: 3, alignItems: "center" }}>
      {dots.map((value, index) => (
        <Animated.View
          key={index}
          style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: C.accent, opacity: value }}
        />
      ))}
    </View>
  );
};

export const Badge = ({ text, color }: { text: string; color: string }) => (
  <Text style={[styles.badge, { color, borderColor: color }]}>{text}</Text>
);

export const Btn = ({
  title,
  onPress,
  ghost,
}: {
  title: string;
  onPress: () => void;
  ghost?: boolean;
}) => (
  <Pressable
    style={({ pressed }) => [
      styles.btn,
      ghost && styles.btnGhost,
      pressed && { backgroundColor: C.accentSoft },
    ]}
    onPress={onPress}
  >
    <Text style={[styles.btnText, ghost && { color: C.dim }]}>{title}</Text>
  </Pressable>
);

export const Field = ({
  label,
  value,
  onChange,
  numeric,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  numeric?: boolean;
  placeholder?: string;
}) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={C.dim}
      keyboardType={numeric ? "number-pad" : "default"}
      autoCapitalize="none"
      autoCorrect={false}
    />
  </View>
);

export const Clock = ({
  timeLeft,
  isRunning,
}: {
  timeLeft: number;
  isRunning: boolean;
}) => {
  const [, setTick] = useState(0);
  const baseRef = useRef({ value: timeLeft, at: Date.now() });
  if (baseRef.current.value !== timeLeft) {
    baseRef.current = { value: timeLeft, at: Date.now() };
  }
  useEffect(() => {
    if (!isRunning) {
      return;
    }
    const interval = setInterval(() => setTick((count) => count + 1), 250);
    return () => clearInterval(interval);
  }, [isRunning]);
  const displayed = isRunning
    ? baseRef.current.value - (Date.now() - baseRef.current.at)
    : timeLeft;
  return (
    <Text
      style={[
        styles.clock,
        isRunning && { color: C.accent },
        displayed < 10_000 && { color: C.danger },
      ]}
    >
      {formatClock(displayed)}
    </Text>
  );
};

export const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.panel,
    padding: 12,
    marginBottom: 14,
  },
  panelTitle: {
    ...MONO,
    color: C.accent,
    fontSize: 12,
    marginBottom: 10,
    letterSpacing: 1,
  },
  row: { flexDirection: "row", gap: 8 },
  field: { marginBottom: 10, flexShrink: 1, flexGrow: 1 },
  label: {
    ...MONO,
    color: C.dim,
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 4,
  },
  input: {
    ...MONO,
    color: C.fg,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
  },
  btn: {
    borderWidth: 1,
    borderColor: C.accent,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  btnGhost: { borderColor: C.border },
  btnText: { ...MONO, color: C.accent, fontSize: 12, letterSpacing: 1 },
  badge: {
    ...MONO,
    fontSize: 10,
    letterSpacing: 1,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  clock: { ...MONO, color: C.fg, fontSize: 13 },
  tile: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.panel,
    padding: 10,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  tileName: { ...MONO, color: C.fg, fontSize: 13, marginBottom: 6 },
  tileMeta: { ...MONO, color: C.dim, fontSize: 11, textAlign: "right" },
});
