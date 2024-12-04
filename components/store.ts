export const isBrowser = () => typeof window !== "undefined";

/**
 * A utility object for interacting with the browser's localStorage.
 * Provides methods to get, set, and remove items from localStorage.
 */
export const storage = {
  /**
   * Retrieves an item from localStorage.
   * 
   * @param key - The key of the item to retrieve.
   * @returns The parsed value of the item, or null if not found or an error occurs.
   */
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

  /**
   * Stores an item in localStorage.
   * 
   * @param key - The key under which to store the item.
   * @param value - The value to store. It will be stringified before saving.
   */
  set: (key: string, value: any) => {
    if (!isBrowser()) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error("Error writing to localStorage:", error);
    }
  },

  /**
   * Removes an item from localStorage.
   * 
   * @param key - The key of the item to remove.
   */
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
