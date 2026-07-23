// Durable key-value storage for the player's identity, so games resume
// across app restarts. React Native has no built-in cross-platform storage
// (core `Settings` is iOS-only, with a no-op fallback on Android), so this
// is the one place the mobile app takes a dependency for something the web
// gets free from localStorage.
//
// AsyncStorage is deliberately chosen over MMKV: it is a single autolinking
// package, whereas MMKV v3+ additionally requires react-native-nitro-modules
// as a direct dependency plus the native setup that comes with it. Reads are
// async on both platforms, which is why identity is loaded once at bootstrap
// in state.ts before the first connect.
import AsyncStorage from "@react-native-async-storage/async-storage";

export const getString = async (key: string): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    // A storage failure must never stop the app - the player just gets a
    // fresh identity for this session.
    return null;
  }
};

export const setString = (key: string, value: string): void => {
  // Fire and forget: nothing in the UI waits on a write landing.
  AsyncStorage.setItem(key, value).catch(() => {});
};
