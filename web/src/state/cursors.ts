// Presence, deliberately outside the store.
//
// `reduce()` in store.ts runs six reducers and notifies every listener, so
// anything routed through it re-renders the whole app. Cursors arrive
// several times a second and would make that the app's steady state - for
// a decoration. So they ride their own tiny channel instead, the same way
// the particle field lives outside React: `socket.ts` hands CURSORS
// messages here, and only the board subscribes.
import { CursorTuple, MessageTypes } from "../common/model";
import { sendToServer } from "./socket";

// Send at most this often. A cursor only moves between *cells*, so this is
// already a ceiling nobody reaches by hand - it exists to bound a shaking
// mouse, not ordinary play. The server has a matching budget.
const SEND_INTERVAL_MS = 90;

type Listener = (cursors: CursorTuple[]) => void;

const listeners = new Map<string, Set<Listener>>();
const latest = new Map<string, CursorTuple[]>();

export const subscribeToCursors = (
  gameId: string,
  listener: Listener
): (() => void) => {
  const forGame = listeners.get(gameId) ?? new Set<Listener>();
  forGame.add(listener);
  listeners.set(gameId, forGame);
  const known = latest.get(gameId);
  if (known) {
    listener(known);
  }
  return () => {
    forGame.delete(listener);
    if (forGame.size === 0) {
      listeners.delete(gameId);
      latest.delete(gameId);
    }
  };
};

// Called by socket.ts for every CURSORS message. The payload is the whole
// current set, not a delta, so a dropped message costs one stale frame and
// then corrects itself.
export const receiveCursors = (gameId: string, cursors: CursorTuple[]) => {
  latest.set(gameId, cursors);
  listeners.get(gameId)?.forEach((listener) => listener(cursors));
};

// Nothing to draw once a game is over or we left it.
export const clearCursors = (gameId: string) => {
  if (latest.has(gameId)) {
    latest.set(gameId, []);
    listeners.get(gameId)?.forEach((listener) => listener([]));
  }
};

// --- sending ---------------------------------------------------------------

let pending: { gameId: string; x: number; y: number } | null = null;
let lastSent: { gameId: string; x: number; y: number } | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

const flush = () => {
  timer = null;
  if (!pending) {
    return;
  }
  const next = pending;
  pending = null;
  if (
    lastSent &&
    lastSent.gameId === next.gameId &&
    lastSent.x === next.x &&
    lastSent.y === next.y
  ) {
    return;
  }
  lastSent = next;
  sendToServer({
    type: MessageTypes.CURSOR,
    gameId: next.gameId,
    coordinateX: next.x,
    coordinateY: next.y,
  });
};

// Coalescing send: the newest position wins and at most one goes out per
// interval. Crossing a 12x12 board in a flick is a dozen cell changes that
// nobody needs to see individually.
export const sendCursor = (gameId: string, x: number, y: number) => {
  pending = { gameId, x, y };
  if (timer === null) {
    // Send the leading edge immediately so the first hover feels instant,
    // then throttle whatever follows.
    flush();
    timer = setTimeout(flush, SEND_INTERVAL_MS);
  }
};

// Leaving the board is worth sending straight away - a ghost that lingers
// where someone is no longer looking is worse than no ghost at all.
export const forgetSentCursor = () => {
  lastSent = null;
  pending = null;
};
