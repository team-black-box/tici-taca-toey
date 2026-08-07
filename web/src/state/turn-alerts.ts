// Telling you it is your move when you are not looking at the tab.
//
// The app already supports playing several games at once and marks the
// ones waiting on you - but only in a lobby you have to be staring at.
// The common way to lose a game here is not being outplayed, it is
// wandering off to another tab and never coming back.
//
// This covers exactly that case, and says so honestly: the title and
// favicon carry the count, and a system notification fires when the
// document is hidden. It does **not** reach you with the browser
// closed - that needs the full Web Push stack (RFC 8291 payload
// encryption, RFC 8292 VAPID) on a server that has no dependencies to
// spend, which is a real decision rather than a detail to smuggle in.
//
// Deliberately quiet: permission is never requested on load. Browsers
// punish that, and so do people. The prompt only ever follows a click
// on the bell in the footer.

const PERMISSION_KEY = "turn-alerts";

// Which games we have already announced, so a notification fires on the
// turn *arriving* rather than once a second for as long as it is yours.
let announced = new Set<string>();

const supported = (): boolean =>
  typeof window !== "undefined" && "Notification" in window;

export const alertsEnabled = (): boolean => {
  if (!supported() || Notification.permission !== "granted") {
    return false;
  }
  try {
    return window.localStorage.getItem(PERMISSION_KEY) !== "off";
  } catch {
    return true;
  }
};

export const alertsAvailable = (): boolean =>
  supported() && Notification.permission !== "denied";

// Ask, but only ever from a click. Returns whether alerts are now on.
export const requestAlerts = async (): Promise<boolean> => {
  if (!supported()) {
    return false;
  }
  if (Notification.permission === "granted") {
    // Already allowed: this is the toggle turning it back on.
    try {
      window.localStorage.setItem(PERMISSION_KEY, "on");
    } catch {
      // not fatal
    }
    return true;
  }
  const result = await Notification.requestPermission();
  return result === "granted";
};

export const muteAlerts = () => {
  try {
    window.localStorage.setItem(PERMISSION_KEY, "off");
  } catch {
    // not fatal
  }
};

// A favicon drawn at runtime rather than shipped: the dot has to sit on
// whatever the logo is, and keeping a second "you have a turn" icon in
// sync with the real one by hand is how they drift apart.
const markFavicon = (waiting: number) => {
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    return;
  }
  if (!link.dataset.original) {
    link.dataset.original = link.href;
  }
  if (waiting === 0) {
    link.href = link.dataset.original;
    return;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  const image = new Image();
  image.onload = () => {
    context.clearRect(0, 0, 64, 64);
    context.drawImage(image, 0, 0, 64, 64);
    context.beginPath();
    context.arc(48, 16, 15, 0, Math.PI * 2);
    context.fillStyle = "#00ff66";
    context.fill();
    link.href = canvas.toDataURL("image/png");
  };
  // The favicon is an inline SVG; drawing it needs a same-origin load,
  // which it is. A failure just leaves the title doing the work.
  image.onerror = () => undefined;
  image.src = link.dataset.original;
};

// Called whenever the set of games waiting on this player changes.
// One entry per game it is your move in.
//
// The document title is deliberately *not* set here: App.tsx already
// owns it (it names the current game or route), and two effects writing
// the same property is a race that resolves differently depending on
// render order. App folds the count into the title it builds.
export const updateTurnAlerts = (games: Array<{ id: string; name: string }>) => {
  if (typeof document === "undefined") {
    return;
  }
  markFavicon(games.length);

  const current = new Set(games.map((game) => game.id));
  // Forget games that are no longer waiting, so the next turn in that
  // same game announces itself again.
  announced = new Set([...announced].filter((id) => current.has(id)));

  if (!alertsEnabled() || !document.hidden) {
    // While you are looking at the tab, the board is the notification.
    return;
  }
  games
    .filter((game) => !announced.has(game.id))
    .forEach((game) => {
      announced.add(game.id);
      try {
        const notification = new Notification("your move", {
          body: game.name,
          tag: `turn-${game.id}`,
          silent: false,
        });
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      } catch {
        // Some browsers refuse construction outside a service worker.
        // The title still carries it.
      }
    });
};
