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
import type { NativeBottomTabIcon } from "@react-navigation/bottom-tabs/unstable";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Platform, StatusBar, Text } from "react-native";
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
// Taken from the navigator's own icon type rather than importing
// `sf-symbols-typescript` directly: that package is only here as
// something bottom-tabs depends on, and a direct import of a dependency
// we never declared breaks the day it reshuffles them.
type SFSymbol = Extract<NativeBottomTabIcon, { type: "sfSymbol" }>["name"];

const NativeTab = createNativeBottomTabNavigator<TabParamList>();
const JsTab = createBottomTabNavigator<TabParamList>();

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

// One list, two bars. The screens, their order, and their labels are
// stated once; only the icon differs, because the two platforms want
// different things from an icon.
const TABS = [
  {
    name: "play",
    component: LobbyScreen,
    symbol: "gamecontroller",
    glyph: "▶",
  },
  { name: "watch", component: WatchScreen, symbol: "eye", glyph: "◉" },
  { name: "daily", component: DailyScreen, symbol: "calendar", glyph: "▦" },
  {
    name: "ranks",
    component: LeaderboardScreen,
    symbol: "chart.bar",
    glyph: "▲",
  },
  { name: "you", component: YouScreen, symbol: "person", glyph: "@" },
] as const satisfies readonly {
  name: keyof TabParamList;
  component: React.ComponentType<never>;
  symbol: SFSymbol;
  glyph: string;
}[];

// iOS gets the real UITabBarController: on iOS 26 that means Liquid
// Glass, the system's switch animation, scroll-edge behavior and
// accessibility, none of which a hand-drawn bar can have. SF Symbols are
// a system font, so the icons cost no assets.
const NativeTabs = () => (
  <NativeTab.Navigator screenOptions={{ headerShown: false }}>
    {TABS.map((tab) => (
      <NativeTab.Screen
        key={tab.name}
        name={tab.name}
        component={tab.component}
        options={{
          title: tab.name,
          tabBarIcon: { type: "sfSymbol", name: tab.symbol },
        }}
      />
    ))}
  </NativeTab.Navigator>
);

// Android gets React Navigation's JavaScript tab bar. The native one
// draws a Material BottomNavigationView, which only takes a bitmap for
// an icon and silently collapses items that have none - five PNGs at
// three densities, for an app whose whole identity is text. The JS bar
// takes a rendered element, so the icon can be a glyph in the same
// monospace as everything else, and the bar can wear the palette.
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
      tabBarIcon: ({ color }) => (
        <Text style={[MONO, { color, fontSize: 18 }]}>
          {TABS.find((tab) => tab.name === route.name)?.glyph}
        </Text>
      ),
    })}
  >
    {TABS.map((tab) => (
      <JsTab.Screen
        key={tab.name}
        name={tab.name}
        component={tab.component}
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
          <Stack.Screen name="Game" component={GameScreen} />
          <Stack.Screen name="Replay" component={ReplayScreen} />
          <Stack.Screen name="Player" component={PlayerScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
