import type { SavedGameRecord, UserSettings } from '../types/chess';

const DB_NAME = 'carter-chess-academy-db';
const DB_VERSION = 1;
const STORE_GAMES = 'games';
const STORE_KV = 'kv';

export const DEFAULT_SETTINGS: UserSettings = {
  themeMode: 'dark',
  boardTheme: 'wooden',
  customLightSquare: '#F0D9B5',
  customDarkSquare: '#B58863',
  pieceStyle: 'classic',
  soundPack: 'wood',
  soundVolume: 0.75,
  muted: false,
  showCoordinates: true,
  showLegalMoves: true,
  highlightLastMove: true,
  highlightCheck: true,
  pieceAnimations: true,
  moveConfirmation: false,
  autoFlipSelfPlay: false,
  engineDepth: 3,
  showEvalBar: true,
  language: 'en',
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_GAMES)) {
        db.createObjectStore(STORE_GAMES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_KV)) {
        db.createObjectStore(STORE_KV);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveGameOffline(game: SavedGameRecord): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_GAMES, 'readwrite');
      tx.objectStore(STORE_GAMES).put(game);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Graceful fallback if IndexedDB blocked
  }
}

export async function getAllOfflineGames(): Promise<SavedGameRecord[]> {
  try {
    const db = await openDb();
    return await new Promise<SavedGameRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE_GAMES, 'readonly');
      const req = tx.objectStore(STORE_GAMES).getAll();
      req.onsuccess = () => {
        const list = (req.result as SavedGameRecord[]) || [];
        list.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function deleteOfflineGame(id: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_GAMES, 'readwrite');
      tx.objectStore(STORE_GAMES).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

export async function loadSettingsOffline(): Promise<UserSettings> {
  try {
    const db = await openDb();
    const val = await new Promise<UserSettings | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_KV, 'readonly');
      const req = tx.objectStore(STORE_KV).get('user-settings');
      req.onsuccess = () => resolve(req.result as UserSettings | undefined);
      req.onerror = () => reject(req.error);
    });
    return { ...DEFAULT_SETTINGS, ...(val || {}) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettingsOffline(settings: UserSettings): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_KV, 'readwrite');
      tx.objectStore(STORE_KV).put(settings, 'user-settings');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

export async function getKvValue<T>(key: string, fallback: T): Promise<T> {
  try {
    const db = await openDb();
    const val = await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_KV, 'readonly');
      const req = tx.objectStore(STORE_KV).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
    return val ?? fallback;
  } catch {
    return fallback;
  }
}

export async function setKvValue<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_KV, 'readwrite');
      tx.objectStore(STORE_KV).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}
