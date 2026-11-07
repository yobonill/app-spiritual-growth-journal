import type { AppData } from '../types';
import { createId } from './id';

const DATABASE_NAME = 'spiritual-growth-journal-db';
const DATABASE_VERSION = 1; // The object store is unchanged; data migrates on read.
const STORE_NAME = 'state';
const APP_DATA_KEY = 'app-data';
export const DEFAULT_PRAYER_GROUP_ID = 'prayer-default';
export const DEFAULT_READING_GROUP_ID = 'reading-default';

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
    schemaVersion: 2,
    settings: {
      chimeEnabled: true,
      chimeIntervalMinutes: 10
    },
    prayerGroups: [{ id: DEFAULT_PRAYER_GROUP_ID, name: 'General', createdAt: now }],
    readingGroups: [{ id: DEFAULT_READING_GROUP_ID, name: 'Lectura habitual', createdAt: now }],
    prayerTopics: [
      { id: createId('topic'), groupId: DEFAULT_PRAYER_GROUP_ID, name: 'Dar gracias', active: true, createdAt: now },
      { id: createId('topic'), groupId: DEFAULT_PRAYER_GROUP_ID, name: 'Mi familia', active: true, createdAt: now },
      { id: createId('topic'), groupId: DEFAULT_PRAYER_GROUP_ID, name: 'Mi crecimiento espiritual', active: true, createdAt: now },
      { id: createId('topic'), groupId: DEFAULT_PRAYER_GROUP_ID, name: 'Iglesia', active: true, createdAt: now }
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

  // Version 1 data had no named groups. Keep every record and map it to
  // stable defaults, including a session that was in progress during upgrade.
  const prayerGroups = Array.isArray(raw.prayerGroups) && raw.prayerGroups.length
    ? raw.prayerGroups : defaults.prayerGroups;
  const readingGroups = Array.isArray(raw.readingGroups) && raw.readingGroups.length
    ? raw.readingGroups : defaults.readingGroups;
  const prayerGroupIds = new Set(prayerGroups.map((group) => group.id));
  const readingGroupIds = new Set(readingGroups.map((group) => group.id));
  const prayerFallback = prayerGroups[0].id;
  const readingFallback = readingGroups[0].id;
  const prayerTopics = (Array.isArray(raw.prayerTopics) ? raw.prayerTopics : defaults.prayerTopics)
    .map((topic) => ({ ...topic, groupId: prayerGroupIds.has(topic.groupId) ? topic.groupId : prayerFallback }));
  const prayerRequests = (Array.isArray(raw.prayerRequests) ? raw.prayerRequests : [])
    .map((request) => ({ ...request, groupId: prayerGroupIds.has(request.groupId) ? request.groupId : prayerFallback }));
  const bibleReadingSessions = (Array.isArray(raw.bibleReadingSessions) ? raw.bibleReadingSessions : [])
    .map((session) => ({ ...session, groupId: session.groupId || readingFallback }));

  let activeSession = raw.activeSession;
  if (activeSession?.type === 'prayer') {
    activeSession = {
      ...activeSession,
      groupId: prayerGroupIds.has(activeSession.groupId) ? activeSession.groupId : prayerFallback,
      pausedSeconds: Number.isFinite(activeSession.pausedSeconds) ? Math.max(0, Number(activeSession.pausedSeconds)) : 0,
      segments: Array.isArray(activeSession.segments) ? activeSession.segments : [],
      completedTargetKeys: Array.isArray(activeSession.completedTargetKeys) ? activeSession.completedTargetKeys : [],
      sessionTargets: Array.isArray(activeSession.sessionTargets) ? activeSession.sessionTargets : []
    };
  } else if (activeSession?.type === 'bible') {
    activeSession = { ...activeSession, groupId: readingGroupIds.has(activeSession.groupId) ? activeSession.groupId : readingFallback };
  }

  return {
    schemaVersion: 2,
    settings,
    prayerGroups,
    readingGroups,
    prayerTopics,
    prayerRequests,
    prayerSessions: Array.isArray(raw.prayerSessions) ? raw.prayerSessions : [],
    bibleReadingSessions,
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
