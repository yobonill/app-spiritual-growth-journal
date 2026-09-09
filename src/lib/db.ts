import type { AppData } from '../types';
import { createId } from './id';

const DATABASE_NAME = 'spiritual-growth-journal-db';
const DATABASE_VERSION = 1;
const STORE_NAME = 'state';
const APP_DATA_KEY = 'app-data';

interface StoredState {
  key: string;
  value: AppData;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function createDefaultAppData(): AppData {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    settings: {
      chimeEnabled: true,
      chimeIntervalMinutes: 10
    },
    prayerTopics: [
      { id: createId('topic'), name: 'Dar gracias', active: true, createdAt: now },
      { id: createId('topic'), name: 'Mi familia', active: true, createdAt: now },
      { id: createId('topic'), name: 'Mi crecimiento espiritual', active: true, createdAt: now },
      { id: createId('topic'), name: 'Iglesia', active: true, createdAt: now }
    ],
    prayerRequests: [],
    prayerSessions: [],
    bibleReadingSessions: []
  };
}

export async function loadAppData(): Promise<AppData> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(APP_DATA_KEY);
    request.onsuccess = () => {
      const stored = request.result as StoredState | undefined;
      resolve(stored?.value ?? createDefaultAppData());
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

export async function saveAppData(data: AppData): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put({ key: APP_DATA_KEY, value: data } satisfies StoredState);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
}
