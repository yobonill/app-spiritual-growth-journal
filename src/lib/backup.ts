import type { AppData } from '../types';
import { normalizeAppData } from './db';

export interface BackupEnvelope {
  app: 'spiritual-growth-journal';
  exportedAt: string;
  schemaVersion: 1;
  data: AppData;
}

export function createBackup(data: AppData): BackupEnvelope {
  return {
    app: 'spiritual-growth-journal',
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    data
  };
}

export function downloadBackup(data: AppData): void {
  const envelope = createBackup(data);
  const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `diario-crecimiento-espiritual-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function parseBackup(text: string): AppData {
  const parsed = JSON.parse(text) as Partial<BackupEnvelope>;
  if (
    parsed.app !== 'spiritual-growth-journal' ||
    parsed.schemaVersion !== 1 ||
    !parsed.data ||
    parsed.data.schemaVersion !== 1 ||
    !Array.isArray(parsed.data.prayerTopics) ||
    !Array.isArray(parsed.data.prayerRequests) ||
    !Array.isArray(parsed.data.prayerSessions) ||
    !Array.isArray(parsed.data.bibleReadingSessions)
  ) {
    throw new Error('El archivo no es un respaldo válido de esta aplicación.');
  }
  return normalizeAppData(parsed.data);
}
