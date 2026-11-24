// Layout for screens wider than a phone.
//
// Every screen was written for a phone, where "as wide as the window" is
// the right width for everything. On a tablet it is not: a board sized
// to a 13" iPad in landscape is taller than the screen it is on, and a
// line of text 1300 points long is a chore to read. So content lives in
// one centred column, and anything that sizes itself from the screen
// asks for the column's width instead of the window's.
import { Platform, useWindowDimensions } from "react-native";

export const MAX_CONTENT_WIDTH = 640;

export const useContentWidth = (): number =>
  Math.min(useWindowDimensions().width, MAX_CONTENT_WIDTH);

// On iPad the system tab bar floats over the top of the content rather
// than sitting under it, and the safe area does not account for it. It
// only does this at regular width; in a narrow window the bar drops to
// the bottom like a phone's, and the inset must go with it.
const IPAD_REGULAR_MIN_WIDTH = 600;
const IPAD_TOP_BAR_HEIGHT = 56;

export const useTopBarInset = (): number => {
  const { width } = useWindowDimensions();
  const floatsOnTop =
    Platform.OS === "ios" && Platform.isPad && width >= IPAD_REGULAR_MIN_WIDTH;
  return floatsOnTop ? IPAD_TOP_BAR_HEIGHT : 0;
};
