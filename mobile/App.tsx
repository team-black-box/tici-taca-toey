// Tici Taca Toey mobile. Navigation chrome (tab bar, floating controls) is
// liquid glass on iOS 26+; the game surface itself keeps the terminal soul.
import { useEffect } from "react";
import { DarkTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Linking, StatusBar } from "react-native";
import { C } from "./src/theme";
import { openGameLink } from "./src/state";
import { GlassTabBar } from "./src/glass";
import LobbyScreen from "./src/screens/LobbyScreen";
import WatchScreen from "./src/screens/WatchScreen";
import GameScreen from "./src/screens/GameScreen";
import ReplayScreen from "./src/screens/ReplayScreen";
import LeaderboardScreen from "./src/screens/LeaderboardScreen";
import PlayerScreen from "./src/screens/PlayerScreen";
import type { RootStackParamList, TabParamList } from "./src/navigation";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

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

const Tabs = () => (
  <Tab.Navigator
    tabBar={(props) => <GlassTabBar {...props} />}
    screenOptions={{ headerShown: false }}
  >
    <Tab.Screen name="play" component={LobbyScreen} options={{ title: "play" }} />
    <Tab.Screen name="watch" component={WatchScreen} options={{ title: "watch" }} />
  </Tab.Navigator>
);

export default function App() {
  // Game links (ticitacatoey:// or https game URLs) join or spectate
  // through the store; navigation follows the active game.
  useEffect(() => {
    Linking.getInitialURL().then(openGameLink);
    const subscription = Linking.addEventListener("url", (event) =>
      openGameLink(event.url)
    );
    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <NavigationContainer theme={terminalTheme}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Tabs" component={Tabs} />
          <Stack.Screen name="Game" component={GameScreen} />
          <Stack.Screen name="Replay" component={ReplayScreen} />
          <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
          <Stack.Screen name="Player" component={PlayerScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
