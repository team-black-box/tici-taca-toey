// A tiny replacement for react-router-dom. The app only ever has one route
// shape: /:type?/:gameId?
import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

if (typeof window !== "undefined") {
  window.addEventListener("popstate", emit);
}

export const navigate = (path: string) => {
  if (window.location.pathname !== path) {
    window.history.pushState(null, "", path);
    emit();
  }
};

export interface Route {
  type?: string;
  gameId?: string;
}

export const useRoute = (): Route => {
  const pathname = useSyncExternalStore(
    subscribe,
    () => window.location.pathname
  );
  const [, type, gameId] = pathname.split("/");
  return { type: type || undefined, gameId: gameId || undefined };
};
