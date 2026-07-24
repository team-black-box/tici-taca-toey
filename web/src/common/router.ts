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

// Compare against path *and* query: a replay link carries its players in
// the query string, and comparing the path alone would push a duplicate
// history entry every render.
export const navigate = (path: string) => {
  const current = window.location.pathname + window.location.search;
  if (current !== path) {
    window.history.pushState(null, "", path);
    emit();
  }
};

export interface Route {
  type?: string;
  gameId?: string;
  // Raw query string (without "?"), kept as a plain string so the snapshot
  // stays referentially stable for useSyncExternalStore.
  search: string;
}

export const useRoute = (): Route => {
  const href = useSyncExternalStore(
    subscribe,
    () => window.location.pathname + window.location.search
  );
  const questionMark = href.indexOf("?");
  const pathname = questionMark === -1 ? href : href.slice(0, questionMark);
  const search = questionMark === -1 ? "" : href.slice(questionMark + 1);
  const [, type, gameId] = pathname.split("/");
  return { type: type || undefined, gameId: gameId || undefined, search };
};
