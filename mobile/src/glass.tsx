// Hand-rolled floating pills for in-screen controls: translucent
// near-black panels with neon borders.
//
// The tab bar used to live here too. It is now React Navigation's
// native one (see App.tsx) - a hand-drawn row of pills cannot be
// Liquid Glass, cannot pick up the system's switch animation, and
// would have to chase every OS release to keep pretending.
import { Pressable, StyleSheet, Text, View } from "react-native";
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


const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
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
