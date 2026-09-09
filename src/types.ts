export type PrayerRequestStatus = 'active' | 'fulfilled' | 'not_granted' | 'closed';

export interface AppSettings {
  chimeEnabled: boolean;
  chimeIntervalMinutes: number;
  lastBackupAt?: string;
}

export interface PrayerTopic {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
}

export interface PrayerRequestUpdate {
  id: string;
  createdAt: string;
  comment: string;
}

export interface PrayerRequest {
  id: string;
  title: string;
  status: PrayerRequestStatus;
  startedAt: string;
  resolvedAt?: string;
  initialComment?: string;
  finalComment?: string;
  updates: PrayerRequestUpdate[];
  createdAt: string;
  updatedAt: string;
}

export type PrayerTargetType = 'topic' | 'request';

export interface PrayerSegment {
  id: string;
  targetType: PrayerTargetType;
  targetId: string;
  labelSnapshot: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
}

export interface PrayerSession {
  id: string;
  plannedDurationSeconds: number;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  comment?: string;
  segments: PrayerSegment[];
}

export interface BibleReference {
  bookId: string;
  bookName: string;
  chapter: number;
  verse: number;
}

export interface BibleReadingSession {
  id: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  start: BibleReference;
  end: BibleReference;
  comment?: string;
}

export interface ActivePrayerSegment {
  targetType: PrayerTargetType;
  targetId: string;
  labelSnapshot: string;
  startedAt: string;
}

export interface ActivePrayerSession {
  type: 'prayer';
  id: string;
  plannedDurationSeconds: number;
  startedAt: string;
  segments: PrayerSegment[];
  completedTargetKeys: string[];
  activeSegment?: ActivePrayerSegment;
}

export interface ActiveBibleSession {
  type: 'bible';
  id: string;
  startedAt: string;
  start: BibleReference;
}

export type ActiveSession = ActivePrayerSession | ActiveBibleSession;

export interface AppData {
  schemaVersion: 1;
  settings: AppSettings;
  prayerTopics: PrayerTopic[];
  prayerRequests: PrayerRequest[];
  prayerSessions: PrayerSession[];
  bibleReadingSessions: BibleReadingSession[];
  activeSession?: ActiveSession;
}

export type AppView = 'home' | 'history' | 'statistics' | 'settings';
