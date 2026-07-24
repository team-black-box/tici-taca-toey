// Move impact for the mobile board. The web draws its sparks on a canvas;
// React Native has none, and a graphics library is not a dependency this
// app is willing to take (see mobile/claude.md), so this is a small fixed
// pool of Animated views driven by the native driver.
//
// The trade that makes it cheap: every spark's whole flight is one
// timing animation on transform and opacity, so the work happens on the
// UI thread and JavaScript is not involved once the burst starts.
import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Text, View } from "react-native";
import { MONO } from "./theme";

const SPARK_COUNT = 16;
const GLYPHS = ["0", "1", "<", ">", "/", "*", "#", "+"];

// The board's neon palette plus a white-hot highlight. A burst keeps mostly
// the mark's own colour but flecks in other neons so it shimmers rather
// than reading as one flat hue - mirrors web/src/common/particles.ts.
const NEON = [
  "#00ff66",
  "#00d2ff",
  "#ff9d00",
  "#ffe600",
  "#b3ff00",
  "#8a8aff",
  "#4da6ff",
  "#ff4d6a",
  "#c45dff",
  "#ff6bd6",
];
const WHITE_HOT = "#eafff2";

const sparkColor = (base: string): string => {
  const roll = Math.random();
  if (roll < 0.5) {
    return base;
  }
  if (roll < 0.85) {
    return NEON[Math.floor(Math.random() * NEON.length)];
  }
  return WHITE_HOT;
};

interface SparkSpec {
  angle: number;
  distance: number;
  size: number;
  duration: number;
  color: string;
  glyph?: string;
}

// A fixed shape per mount, so the burst does not re-randomise on every
// render - only its progress animates. Each spark's colour is drawn from
// the palette here so the burst is multicolour.
const makeSparks = (scale: number, base: string): SparkSpec[] =>
  Array.from({ length: SPARK_COUNT }, (_, index) => {
    const fast = index % 5 === 0;
    return {
      angle: (index / SPARK_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.9,
      distance: scale * (fast ? 0.75 + Math.random() * 0.5 : 0.3 + Math.random() * 0.35),
      size: index % 7 === 0 ? scale * 0.1 : Math.max(2, scale * 0.035),
      duration: fast ? 420 : 320 + Math.random() * 220,
      color: sparkColor(base),
      glyph: index % 7 === 0 ? GLYPHS[index % GLYPHS.length] : undefined,
    };
  });

// One spark: flies outward, falls a little, fades out.
const Spark = ({
  spec,
  progress,
}: {
  spec: SparkSpec;
  progress: Animated.Value;
}) => {
  const color = spec.color;
  const dx = Math.cos(spec.angle) * spec.distance;
  const dy = Math.sin(spec.angle) * spec.distance;
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, dx],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    // Gravity: the arc sags below a straight line by the end.
    outputRange: [0, dy + spec.distance * 0.45],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.15, 1],
    outputRange: [0, 1, 0],
  });
  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.4],
  });

  if (spec.glyph) {
    return (
      <Animated.Text
        style={[
          MONO,
          {
            position: "absolute",
            color,
            fontSize: spec.size,
            opacity,
            transform: [{ translateX }, { translateY }],
          },
        ]}
      >
        {spec.glyph}
      </Animated.Text>
    );
  }
  return (
    <Animated.View
      style={{
        position: "absolute",
        width: spec.size,
        height: spec.size,
        borderRadius: spec.size,
        backgroundColor: color,
        opacity,
        transform: [{ translateX }, { translateY }, { scale }],
      }}
    />
  );
};

// The shock ring: punches out and is gone before the eye settles on it.
const Ring = ({
  scale,
  color,
  progress,
}: {
  scale: number;
  color: string;
  progress: Animated.Value;
}) => {
  const size = scale * 0.9;
  return (
    <Animated.View
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: size,
        borderWidth: Math.max(1, scale * 0.02),
        borderColor: color,
        opacity: progress.interpolate({
          inputRange: [0, 0.35, 1],
          outputRange: [0.55, 0.25, 0],
        }),
        transform: [
          {
            scale: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0.15, 1],
            }),
          },
        ],
      }}
    />
  );
};

// Sits centred in a cell and fires once whenever `active` turns true.
export const Burst = ({
  active,
  color,
  scale,
}: {
  active: boolean;
  color: string;
  scale: number;
}) => {
  const progress = useRef(new Animated.Value(0)).current;
  const sparks = useMemo(() => makeSparks(scale, color), [scale, color]);

  useEffect(() => {
    if (!active) {
      return;
    }
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 620,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [active, progress]);

  if (!active) {
    return null;
  }
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ring scale={scale} color={color} progress={progress} />
      {sparks.map((spec, index) => (
        <Spark key={index} spec={spec} progress={progress} />
      ))}
    </View>
  );
};
