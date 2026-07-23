import { Platform } from "react-native";

// Android emulators reach the host machine at 10.0.2.2; iOS simulators share
// localhost. Release builds talk to the production box (single origin - see
// DEPLOYMENT.md). For a physical device in dev, point the __DEV__ branch at
// your laptop's LAN IP (the dev server binds 0.0.0.0).
export const SERVER_URL = __DEV__
  ? Platform.OS === "android"
    ? "ws://10.0.2.2:8080"
    : "ws://localhost:8080"
  : "wss://ticitacatoey.com";
