export const isBrowser = () => typeof window !== "undefined";

export const storage = {
  get: (key: string) => {
    if (!isBrowser()) return null;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error("Error reading from localStorage:", error);
      return null;
    }
  },

  set: (key: string, value: any) => {
    if (!isBrowser()) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error("Error writing to localStorage:", error);
    }
  },

  remove: (key: string) => {
    if (!isBrowser()) return;
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.error("Error removing from localStorage:", error);
    }
  },
};

export const cleanupStorage = (maxItems = 50) => {
  if (!isBrowser()) return;
  try {
    const threads = storage.get("threads") || [];
    if (threads.length > maxItems) {
      const trimmedThreads = threads.slice(-maxItems);
      storage.set("threads", trimmedThreads);
    }
  } catch (error) {
    console.error("Error cleaning up storage:", error);
  }
};
