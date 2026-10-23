import type { AppData } from '../types';
import { createId } from './id';

const DATABASE_NAME = 'spiritual-growth-journal-db';
const DATABASE_VERSION = 1;
const STORE_NAME = 'state';
const APP_DATA_KEY = 'app-data';

interface StoredState {
  key: string;
  value: unknown;
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
    bibleReadingSessions: [],
    practiceRecords: []
  };
}

export function normalizeAppData(value: unknown): AppData {
  const defaults = createDefaultAppData();
  if (!value || typeof value !== 'object') return defaults;

  const raw = value as Partial<AppData>;

  const settings = raw.settings && typeof raw.settings === 'object'
    ? {
        ...defaults.settings,
        ...raw.settings,
        chimeEnabled: typeof raw.settings.chimeEnabled === 'boolean' ? raw.settings.chimeEnabled : defaults.settings.chimeEnabled,
        chimeIntervalMinutes: Number.isFinite(raw.settings.chimeIntervalMinutes)
          ? Math.max(1, Number(raw.settings.chimeIntervalMinutes))
          : defaults.settings.chimeIntervalMinutes
      }
    : defaults.settings;

  let activeSession = raw.activeSession;
  if (activeSession?.type === 'prayer') {
    activeSession = {
      ...activeSession,
      segments: Array.isArray(activeSession.segments) ? activeSession.segments : [],
      completedTargetKeys: Array.isArray(activeSession.completedTargetKeys) ? activeSession.completedTargetKeys : [],
      sessionTargets: Array.isArray(activeSession.sessionTargets) ? activeSession.sessionTargets : []
    };
  }

  return {
    schemaVersion: 1,
    settings,
    prayerTopics: Array.isArray(raw.prayerTopics) ? raw.prayerTopics : defaults.prayerTopics,
    prayerRequests: Array.isArray(raw.prayerRequests) ? raw.prayerRequests : [],
    prayerSessions: Array.isArray(raw.prayerSessions) ? raw.prayerSessions : [],
    bibleReadingSessions: Array.isArray(raw.bibleReadingSessions) ? raw.bibleReadingSessions : [],
    practiceRecords: Array.isArray(raw.practiceRecords) ? raw.practiceRecords : [],
    activeSession
  };
}

export async function loadAppData(): Promise<AppData> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(APP_DATA_KEY);
    request.onsuccess = () => {
      const stored = request.result as StoredState | undefined;
      resolve(stored ? normalizeAppData(stored.value) : createDefaultAppData());
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
