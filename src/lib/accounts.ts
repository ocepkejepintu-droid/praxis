import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { AcpPermission } from './acp';

export type UserRole = 'admin' | 'editor';

export type UserAccountRecord = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  permissions: AcpPermission[];
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
  lastLoginAt?: string;
};

export type PublicUserAccount = Omit<UserAccountRecord, 'passwordHash' | 'passwordSalt'>;

type SessionRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt?: string;
};

const RADAR_DIR = path.join(process.cwd(), '.radar');
const USERS_PATH = path.join(RADAR_DIR, 'users.json');
const SESSIONS_PATH = path.join(RADAR_DIR, 'sessions.json');
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

function nowIso() {
  return new Date().toISOString();
}

function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function safeEq(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function hashPassword(password: string, salt = crypto.randomBytes(16).toString('base64url')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('base64url');
  return { salt, hash };
}

function readJson<T>(file: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) as T; } catch { return fallback; }
}

function writeJson(file: string, value: unknown) {
  fs.mkdirSync(RADAR_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function readUsers() {
  return readJson<UserAccountRecord[]>(USERS_PATH, []);
}

function writeUsers(users: UserAccountRecord[]) {
  writeJson(USERS_PATH, users);
}

function readSessions() {
  return readJson<SessionRecord[]>(SESSIONS_PATH, []);
}

function writeSessions(sessions: SessionRecord[]) {
  writeJson(SESSIONS_PATH, sessions);
}

function publicUser(user: UserAccountRecord): PublicUserAccount {
  const { passwordHash: _passwordHash, passwordSalt: _passwordSalt, ...safe } = user;
  return safe;
}

export function hasUserAccounts() {
  return readUsers().length > 0;
}

export function listUserAccounts(): PublicUserAccount[] {
  return readUsers().map(publicUser).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function defaultAccountPermissions(role: UserRole): AcpPermission[] {
  if (role === 'admin') return ['read_signals', 'read_reports', 'read_praxies', 'create_praxis', 'update_praxis_status', 'submit_learning_report', 'append_acp_event', 'run_experiment_marker', 'admin_settings'];
  return ['read_reports', 'read_praxies', 'update_praxis_status', 'submit_learning_report', 'append_acp_event'];
}

export function createUserAccount(input: { email: string; name: string; password: string; role?: UserRole; permissions?: AcpPermission[] }) {
  const email = input.email.trim().toLowerCase().slice(0, 160);
  const name = input.name.trim().slice(0, 100) || email;
  const password = input.password;
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Valid email required.');
  if (password.length < 10) throw new Error('Password must be at least 10 characters.');
  const users = readUsers();
  if (users.some((user) => user.email === email)) throw new Error('Account already exists.');
  const role = input.role || (users.length ? 'editor' : 'admin');
  const { salt, hash } = hashPassword(password);
  const record: UserAccountRecord = {
    id: `usr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    email,
    name,
    role,
    permissions: input.permissions?.length ? input.permissions : defaultAccountPermissions(role),
    passwordHash: hash,
    passwordSalt: salt,
    createdAt: nowIso(),
  };
  users.push(record);
  writeUsers(users);
  return publicUser(record);
}

export function verifyUserPassword(emailInput?: string, password?: string) {
  if (!emailInput || !password) return null;
  const email = emailInput.trim().toLowerCase();
  const users = readUsers();
  const index = users.findIndex((user) => user.email === email);
  if (index < 0) return null;
  const expected = hashPassword(password, users[index].passwordSalt).hash;
  if (!safeEq(expected, users[index].passwordHash)) return null;
  users[index] = { ...users[index], lastLoginAt: nowIso() };
  writeUsers(users);
  return publicUser(users[index]);
}

export function createUserSession(userId: string) {
  const token = `aps_${crypto.randomBytes(32).toString('base64url')}`;
  const session: SessionRecord = {
    id: `ses_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    userId,
    tokenHash: sha256(token),
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  };
  const sessions = readSessions().filter((item) => new Date(item.expiresAt).getTime() > Date.now());
  sessions.push(session);
  writeSessions(sessions);
  return token;
}

export function verifyUserSession(rawToken?: string | null) {
  if (!rawToken?.startsWith('aps_')) return null;
  const sessions = readSessions();
  const hash = sha256(rawToken);
  const index = sessions.findIndex((session) => new Date(session.expiresAt).getTime() > Date.now() && safeEq(session.tokenHash, hash));
  if (index < 0) return null;
  const users = readUsers();
  const user = users.find((item) => item.id === sessions[index].userId);
  if (!user) return null;
  sessions[index] = { ...sessions[index], lastUsedAt: nowIso() };
  writeSessions(sessions);
  return publicUser(user);
}

export function revokeUserSession(rawToken?: string | null) {
  if (!rawToken) return;
  const hash = sha256(rawToken);
  writeSessions(readSessions().filter((session) => !safeEq(session.tokenHash, hash)));
}

export function canUser(user: PublicUserAccount, permission: AcpPermission) {
  return user.role === 'admin' || user.permissions.includes('admin_settings') || user.permissions.includes(permission);
}
