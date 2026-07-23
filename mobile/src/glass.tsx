// Hand-rolled floating chrome for app-level controls (tab bar, pills):
// translucent near-black panels with neon borders, identical on every
// platform. This replaced the @callstack/liquid-glass dependency - less
// rounded, fewer moving parts, same soul.
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { C, MONO } from "./theme";

export const GlassPill = ({
  title,
  onPress,
}: {
  title: string;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    hitSlop={8}
    style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
  >
    <Text style={styles.pillText}>{title}</Text>
  </Pressable>
);

export const GlassTabBar = ({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) => {
  return (
    <View style={styles.tabWrap} pointerEvents="box-none">
      <View style={styles.tabContainer}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const label =
            descriptors[route.key].options.title ?? route.name.toLowerCase();
          return (
            <Pressable
              key={route.key}
              onPress={() => {
                if (!focused) {
                  navigation.navigate(route.name);
                }
              }}
              hitSlop={8}
              style={({ pressed }) => [
                styles.tab,
                focused && styles.tabOn,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.tabText, focused && { color: C.accent }]}>
                {focused ? `> ${label}` : label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  tabWrap: {
    position: "absolute",
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  tabContainer: {
    flexDirection: "row",
    gap: 10,
  },
  tab: {
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 12,
    backgroundColor: "rgba(7, 14, 7, 0.92)",
    borderWidth: 1,
    borderColor: C.border,
  },
  tabOn: {
    borderColor: C.accent,
    backgroundColor: "rgba(0, 255, 102, 0.08)",
  },
  pressed: {
    opacity: 0.7,
  },
  tabText: {
    ...MONO,
    color: C.fg,
    fontSize: 13,
    letterSpacing: 1,
  },
  pill: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: "rgba(7, 14, 7, 0.92)",
    borderWidth: 1,
    borderColor: C.border,
  },
  pillText: {
    ...MONO,
    color: C.fg,
    fontSize: 12,
    letterSpacing: 1,
  },
});
