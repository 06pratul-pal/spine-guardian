import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface SessionRecord {
  id?: number;
  date: string;
  startedAt: number;
  endedAt: number;
  type: 'monitoring' | 'pomodoro' | 'deep_work' | 'custom';
  durationSeconds: number;
  goodSeconds: number;
  badSeconds: number;
  avgScore: number;
  slouchCount: number;
}

export interface SnapshotRecord {
  id?: number;
  date: string;
  hour: number;
  avgScore: number;
  sampleCount: number;
  slouchCount: number;
}

interface SpineDB extends DBSchema {
  sessions: {
    key: number;
    value: SessionRecord;
    indexes: { 'by-date': string };
  };
  snapshots: {
    key: number;
    value: SnapshotRecord;
    indexes: { 'by-date': string };
  };
}

let dbPromise: Promise<IDBPDatabase<SpineDB>> | null = null;

function getDB(): Promise<IDBPDatabase<SpineDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SpineDB>('spine-guardian-db', 1, {
      upgrade(db) {
        const sessions = db.createObjectStore('sessions', {
          keyPath: 'id',
          autoIncrement: true,
        });
        sessions.createIndex('by-date', 'date');

        const snapshots = db.createObjectStore('snapshots', {
          keyPath: 'id',
          autoIncrement: true,
        });
        snapshots.createIndex('by-date', 'date');
      },
    });
  }
  return dbPromise;
}

export async function addSession(session: Omit<SessionRecord, 'id'>): Promise<void> {
  const db = await getDB();
  await db.add('sessions', session as SessionRecord);
}

export async function getAllSessions(): Promise<SessionRecord[]> {
  const db = await getDB();
  return db.getAll('sessions');
}

export async function getSessionsInRange(
  startDate: string,
  endDate: string
): Promise<SessionRecord[]> {
  const db = await getDB();
  const range = IDBKeyRange.bound(startDate, endDate);
  return db.getAllFromIndex('sessions', 'by-date', range);
}

export async function addOrUpdateSnapshot(
  incoming: Omit<SnapshotRecord, 'id'>
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('snapshots', 'readwrite');
  const existing = await tx.store.index('by-date').getAll(incoming.date);
  const match = existing.find((s) => s.hour === incoming.hour);

  if (match?.id !== undefined) {
    const totalSamples = match.sampleCount + incoming.sampleCount;
    const blendedScore =
      (match.avgScore * match.sampleCount + incoming.avgScore * incoming.sampleCount) /
      totalSamples;
    await tx.store.put({
      ...match,
      avgScore: Math.round(blendedScore),
      sampleCount: totalSamples,
      slouchCount: match.slouchCount + incoming.slouchCount,
    });
  } else {
    await tx.store.add(incoming as SnapshotRecord);
  }
  await tx.done;
}

export async function getSnapshotsByDate(date: string): Promise<SnapshotRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex('snapshots', 'by-date', date);
}

export async function getSnapshotsInRange(
  startDate: string,
  endDate: string
): Promise<SnapshotRecord[]> {
  const db = await getDB();
  const range = IDBKeyRange.bound(startDate, endDate);
  return db.getAllFromIndex('snapshots', 'by-date', range);
}

export function todayString(): string {
  return new Date().toISOString().split('T')[0]!;
}

export function dateString(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return d.toISOString().split('T')[0]!;
}

export function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => dateString(6 - i));
}

export function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}
