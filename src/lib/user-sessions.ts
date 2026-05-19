import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { AcpAdapter } from './acp';

export type UserSavedSessionStatus = 'active' | 'paused' | 'archived';

export type UserSavedSession = {
  id: string;
  ownerUserId: string;
  owner: string;
  title: string;
  adapter: AcpAdapter;
  status: UserSavedSessionStatus;
  praxisSlug?: string;
  summary: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

const RADAR_DIR = path.join(process.cwd(), '.radar');
const SESSIONS_PATH = path.join(RADAR_DIR, 'user-sessions.json');

function nowIso() { return new Date().toISOString(); }
function readRecords(): UserSavedSession[] {
  try { return JSON.parse(fs.readFileSync(SESSIONS_PATH, 'utf8')) as UserSavedSession[]; } catch { return []; }
}
function writeRecords(records: UserSavedSession[]) {
  fs.mkdirSync(RADAR_DIR, { recursive: true });
  fs.writeFileSync(SESSIONS_PATH, JSON.stringify(records, null, 2));
}
function cleanText(value: unknown, fallback = '') { return typeof value === 'string' && value.trim() ? value.trim() : fallback; }
function normalizeStatus(value: unknown): UserSavedSessionStatus {
  return value === 'paused' || value === 'archived' ? value : 'active';
}
function normalizeAdapter(value: unknown): AcpAdapter {
  return value === 'openclaw' ? 'openclaw' : 'hermes';
}

export function listUserSessions(ownerUserId: string) {
  return readRecords()
    .filter((session) => session.ownerUserId === ownerUserId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function createUserSessionRecord(input: { ownerUserId: string; owner: string; title?: unknown; adapter?: unknown; status?: unknown; praxisSlug?: unknown; summary?: unknown; notes?: unknown }) {
  const stamp = nowIso();
  const record: UserSavedSession = {
    id: `usr_ses_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    ownerUserId: input.ownerUserId,
    owner: cleanText(input.owner, input.ownerUserId),
    title: cleanText(input.title, 'Praxis learning session').slice(0, 100),
    adapter: normalizeAdapter(input.adapter),
    status: normalizeStatus(input.status),
    praxisSlug: cleanText(input.praxisSlug) || undefined,
    summary: cleanText(input.summary, 'Saved learning context for this user.').slice(0, 240),
    notes: cleanText(input.notes, 'Session created.').slice(0, 2000),
    createdAt: stamp,
    updatedAt: stamp,
  };
  const records = readRecords();
  records.push(record);
  writeRecords(records);
  return record;
}

export function updateUserSessionRecord(ownerUserId: string, id: string, input: Partial<UserSavedSession>) {
  const records = readRecords();
  const index = records.findIndex((session) => session.id === id && session.ownerUserId === ownerUserId);
  if (index < 0) return null;
  records[index] = {
    ...records[index],
    title: input.title ? cleanText(input.title, records[index].title).slice(0, 100) : records[index].title,
    adapter: input.adapter ? normalizeAdapter(input.adapter) : records[index].adapter,
    status: input.status ? normalizeStatus(input.status) : records[index].status,
    praxisSlug: input.praxisSlug !== undefined ? cleanText(input.praxisSlug) || undefined : records[index].praxisSlug,
    summary: input.summary ? cleanText(input.summary, records[index].summary).slice(0, 240) : records[index].summary,
    notes: input.notes ? cleanText(input.notes, records[index].notes).slice(0, 2000) : records[index].notes,
    updatedAt: nowIso(),
  };
  writeRecords(records);
  return records[index];
}
