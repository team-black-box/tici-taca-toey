// Tici Taca Toey mobile.
//
// Navigation is React Navigation, not a hand-rolled tab bar. The
// previous one was a row of hand-drawn pills: it looked right in
// screenshots and was wrong in every way that does not show up in one,
// because it was not the system control and so got none of the
// platform's behavior for free.
//
// iOS uses the native tabs (`@react-navigation/bottom-tabs/unstable`) -
// a real UITabBarController, so on iOS 26 the bar is Liquid Glass, with
// the system's own switch animation, scroll-edge behavior and
// accessibility. Android uses the JavaScript tab bar from the same
// package, for a reason spelled out above `JsTabs`. Neither is a new
// dependency; both ship in the bottom-tabs package this app already had.
//
// Deep links are React Navigation's `linking` config rather than a
// hand-rolled Linking listener plus a regex. One declaration now covers
// cold start, warm arrival, and the back stack, and the URL shapes are
// stated in one place instead of hidden in a pattern in the store.
import { DarkTheme, NavigationContainer } from "@react-navigation/native";
import type { LinkingOptions } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createNativeBottomTabNavigator } from "@react-navigation/bottom-tabs/unstable";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { ComponentType } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Image, Platform, StatusBar, View } from "react-native";
import type { ImageSourcePropType } from "react-native";
import { C, MONO } from "./src/theme";
import LobbyScreen from "./src/screens/LobbyScreen";
import WatchScreen from "./src/screens/WatchScreen";
import GameScreen from "./src/screens/GameScreen";
import ReplayScreen from "./src/screens/ReplayScreen";
import DailyScreen from "./src/screens/DailyScreen";
import YouScreen from "./src/screens/YouScreen";
import LeaderboardScreen from "./src/screens/LeaderboardScreen";
import PlayerScreen from "./src/screens/PlayerScreen";
import type { RootStackParamList, TabParamList } from "./src/navigation";

const Stack = createNativeStackNavigator<RootStackParamList>();

const NativeTab = createNativeBottomTabNavigator<TabParamList>();
const JsTab = createBottomTabNavigator<TabParamList>();

// iOS adds the safe-area inset to a scroll view on its own, but only
// when that scroll view is the screen's root view - and inside the
// native tab navigator neither `contentInsetAdjustmentBehavior` nor
// `automaticallyAdjustContentInsets` turns it off (both were tried on
// the device). So a screen whose root was a ScrollView got that inset
// *and* its own `insets.top` padding, and started a full safe area too
// low, while a screen that happened to wrap its ScrollView in a View
// looked right. Same code, different markup shape, different layout.
//
// Rather than leave that as something each screen has to know, every
// scene gets a plain View root here. No screen is ever the root scroll
// view, so each screen's `paddingTop: insets.top + 8` is the only top
// inset, on both platforms.
const scene = (Screen: ComponentType) => () => (
  <View style={{ flex: 1, backgroundColor: C.bg }}>
    <Screen />
  </View>
);

const terminalTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: C.bg,
    card: C.bg,
    text: C.fg,
    border: C.border,
    primary: C.accent,
  },
};

// One list, two bars: screens, order, labels, and now the icon too are
// stated once and both bars draw the same artwork.
//
// The icons are images rather than SF Symbols because an image is the
// only artwork the two bars have in common - iOS's native bar takes an
// SF Symbol or a bitmap and nothing else, and SF Symbols do not exist on
// Android. The alternative, matching a symbol to a text glyph, only ever
// got the two platforms *near* each other.
//
// They are not hand-drawn binaries: `scripts/make-tab-icons.ts` holds the
// shapes as geometry and generates every size, so the artwork is
// editable and diffable. Each file is a few hundred bytes of white
// pixels with a coverage alpha; the colour comes from the bar (iOS tints
// them by default, Android via tintColor below). The `require` calls are
// literal because Metro resolves them at build time - and picking up the
// @2x/@3x files beside each one is exactly what it is for.
const TABS = [
  {
    name: "play",
    component: LobbyScreen,
    icon: require("./src/icons/tabs/play.png"),
  },
  {
    name: "watch",
    component: WatchScreen,
    icon: require("./src/icons/tabs/watch.png"),
  },
  {
    name: "daily",
    component: DailyScreen,
    icon: require("./src/icons/tabs/daily.png"),
  },
  {
    name: "ranks",
    component: LeaderboardScreen,
    icon: require("./src/icons/tabs/ranks.png"),
  },
  {
    name: "you",
    component: YouScreen,
    icon: require("./src/icons/tabs/you.png"),
  },
] as const satisfies readonly {
  name: keyof TabParamList;
  component: ComponentType<never>;
  icon: ImageSourcePropType;
}[];

// The size the icons were drawn for; see BASE in the generator.
const ICON_SIZE = 28;

// Wrapped once at module scope, not per render: a component created
// inside render is a new type every time, which remounts the screen.
const TAB_SCENES = TABS.map((tab) => ({ ...tab, scene: scene(tab.component) }));
const GameScene = scene(GameScreen);
const ReplayScene = scene(ReplayScreen);
const PlayerScene = scene(PlayerScreen);

// iOS gets the real UITabBarController: on iOS 26 that means Liquid
// Glass, the system's switch animation, scroll-edge behavior and
// accessibility, none of which a hand-drawn bar can have.
const NativeTabs = () => (
  <NativeTab.Navigator screenOptions={{ headerShown: false }}>
    {TAB_SCENES.map((tab) => (
      <NativeTab.Screen
        key={tab.name}
        name={tab.name}
        component={tab.scene}
        options={{
          title: tab.name,
          tabBarIcon: { type: "image", source: tab.icon },
        }}
      />
    ))}
  </NativeTab.Navigator>
);

// Android gets React Navigation's JavaScript tab bar.
//
// This was originally forced: the native navigator draws a Material
// BottomNavigationView, which takes only a bitmap for an icon and
// silently collapses items that have none, and the icons were text
// glyphs. That constraint is gone now that the icons are images, and the
// native bar does support the palette on Android
// (tabBarActiveTintColor, tabBarInactiveTintColor,
// tabBarActiveIndicatorColor, tabBarStyle.backgroundColor). So moving
// Android onto the native bar too is a live option - it just changes how
// the bar looks and behaves there (Material's pill indicator, ripple),
// which is a decision rather than a cleanup, and has not been taken.
const JsTabs = () => (
  <JsTab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: C.accent,
      tabBarInactiveTintColor: C.dim,
      // No fixed height: the bar adds the gesture-navigation inset to
      // its own padding, so pinning the height squeezes the icon and
      // label up against the home indicator on a gesture-nav device.
      tabBarStyle: {
        backgroundColor: C.panel,
        borderTopColor: C.border,
      },
      tabBarLabelStyle: { ...MONO, fontSize: 11 },
      // tintColor paints the same white-and-alpha artwork iOS tints
      // natively, so selected and unselected match the palette here too.
      tabBarIcon: ({ color }) => {
        const tab = TABS.find((entry) => entry.name === route.name);
        return (
          <Image
            source={tab?.icon}
            style={{ width: ICON_SIZE, height: ICON_SIZE, tintColor: color }}
          />
        );
      },
    })}
  >
    {TAB_SCENES.map((tab) => (
      <JsTab.Screen
        key={tab.name}
        name={tab.name}
        component={tab.scene}
        options={{ title: tab.name }}
      />
    ))}
  </JsTab.Navigator>
);

const Tabs = Platform.OS === "ios" ? NativeTabs : JsTabs;

// Every URL this app answers to, in one place. The https prefixes only
// actually arrive on iOS once the Associated Domains entitlement is in
// place and on Android once assetlinks.json is served with the release
// certificate - until then those links open the browser and the custom
// scheme carries the load. The config is correct either way.
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    "ticitacatoey://",
    "https://ticitacatoey.com",
    "https://www.ticitacatoey.com",
  ],
  config: {
    // Without this a link that lands on a stack screen builds a stack
    // containing only that screen: "< back" does nothing and there is no
    // way to reach the tabs. Naming the initial route puts Tabs
    // underneath, so a link arrives somewhere you can leave.
    initialRouteName: "Tabs",
    screens: {
      // Paths match the web's routes where the web has one, so a single
      // ticitacatoey.com link means the same thing in a browser and in
      // the app: "" is the site root, and /daily and /leaderboard are
      // real pages. `watch` and `me` have no web equivalent, so they are
      // reachable over the custom scheme only - which is all they need
      // to be, since nobody links to them.
      Tabs: {
        screens: {
          play: "",
          watch: "watch",
          daily: "daily",
          ranks: "leaderboard",
          you: "me",
        },
      },
      // A game link does not just show a screen, it seats you: the game
      // screen reads these params and asks the server to join or
      // spectate. See GameScreen.
      Game: {
        path: ":mode/:gameId",
        parse: { mode: (mode: string) => mode },
      },
      Replay: {
        path: "replay/:ttn",
        parse: { ttn: (ttn: string) => decodeURIComponent(ttn) },
      },
      Player: "player/:handle",
    },
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <NavigationContainer theme={terminalTheme} linking={linking}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Tabs" component={Tabs} />
          <Stack.Screen name="Game" component={GameScene} />
          <Stack.Screen name="Replay" component={ReplayScene} />
          <Stack.Screen name="Player" component={PlayerScene} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
