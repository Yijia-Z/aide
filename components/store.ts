export const isBrowser = () => typeof window !== "undefined";

const DB_NAME = 'aide-store';
const DB_VERSION = 1;
const STORE_NAME = 'app-data';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

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
      console.error("Error writing to storage:", error);
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
      console.error("Error removing from storage:", error);
    }
  },

  // IndexedDB methods for larger data
  async setLarge(key: string, value: any): Promise<void> {
    if (!isBrowser()) return;

    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      await new Promise((resolve, reject) => {
        const request = store.put(value, key);
        request.onsuccess = () => resolve(undefined);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error writing large data:', error);
      // Fallback to localStorage if possible
      this.set(key, value);
    }
  },

  async getLarge(key: string): Promise<any> {
    if (!isBrowser()) return null;

    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      return new Promise((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error reading large data:', error);
      // Fallback to localStorage
      return this.get(key);
    }
  }
};