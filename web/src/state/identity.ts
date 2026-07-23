// Durable player identity. The key is a secret: the server maps it to a
// stable public playerId, which is how games survive refreshes and network
// blips (reconnect-and-resume).
const STORAGE_KEY = "ttt-player-key";

let inMemoryKey: string | null = null;

// Import an identity from another device (the /sync flow). The key is the
// account; storing it and reloading completes the transfer.
export const setPlayerKey = (key: string) => {
  inMemoryKey = key;
  try {
    window.localStorage.setItem(STORAGE_KEY, key);
  } catch (error) {
    console.error("Could not persist imported identity", error);
  }
};

export const getPlayerKey = (): string => {
  if (inMemoryKey) {
    return inMemoryKey;
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      inMemoryKey = stored;
      return stored;
    }
    const fresh = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY, fresh);
    inMemoryKey = fresh;
    return fresh;
  } catch (error) {
    // Private browsing or storage disabled: still playable, just no resume
    // across reloads.
    inMemoryKey = crypto.randomUUID();
    return inMemoryKey;
  }
};
