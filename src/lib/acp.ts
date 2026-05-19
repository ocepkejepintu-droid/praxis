import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const acpAdapters = ['hermes', 'openclaw'] as const;
export type AcpAdapter = typeof acpAdapters[number];

export const acpPermissions = [
  'read_signals',
  'read_reports',
  'read_praxies',
  'create_praxis',
  'update_praxis_status',
  'submit_learning_report',
  'append_acp_event',
  'run_experiment_marker',
  'admin_settings',
] as const;
export type AcpPermission = typeof acpPermissions[number];

export type AcpApiKeyStatus = 'active' | 'revoked';

export type AcpApiKeyRecord = {
  id: string;
  name: string;
  owner: string;
  ownerUserId?: string;
  adapter: AcpAdapter;
  permissions: AcpPermission[];
  status: AcpApiKeyStatus;
  keyHash: string;
  keyPreview: string;
  createdAt: string;
  revokedAt?: string;
  lastUsedAt?: string;
  createdBy?: string;
};

export type PublicAcpApiKey = Omit<AcpApiKeyRecord, 'keyHash'>;

const ACP_DIR = path.join(process.cwd(), '.radar');
const ACP_KEYS_PATH = path.join(ACP_DIR, 'acp-keys.json');

function nowIso() {
  return new Date().toISOString();
}

function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function timingSafeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function readRecords(): AcpApiKeyRecord[] {
  try {
    return JSON.parse(fs.readFileSync(ACP_KEYS_PATH, 'utf8')) as AcpApiKeyRecord[];
  } catch {
    return [];
  }
}

function writeRecords(records: AcpApiKeyRecord[]) {
  fs.mkdirSync(ACP_DIR, { recursive: true });
  fs.writeFileSync(ACP_KEYS_PATH, JSON.stringify(records, null, 2));
}

function publicKey(record: AcpApiKeyRecord): PublicAcpApiKey {
  const { keyHash: _keyHash, ...safe } = record;
  return safe;
}

export function isAcpAdapter(value?: string): value is AcpAdapter {
  return acpAdapters.includes(value as AcpAdapter);
}

export function isAcpPermission(value: string): value is AcpPermission {
  return acpPermissions.includes(value as AcpPermission);
}

export function defaultPermissions(adapter: AcpAdapter): AcpPermission[] {
  if (adapter === 'hermes') return ['read_signals', 'read_reports', 'read_praxies', 'create_praxis', 'submit_learning_report', 'append_acp_event'];
  return ['read_signals', 'read_reports', 'read_praxies', 'update_praxis_status', 'submit_learning_report', 'append_acp_event', 'run_experiment_marker'];
}

export function normalizePermissions(values: unknown, adapter: AcpAdapter) {
  if (!Array.isArray(values)) return defaultPermissions(adapter);
  const permissions = values.map(String).filter(isAcpPermission);
  return permissions.length ? Array.from(new Set(permissions)) : defaultPermissions(adapter);
}

export function listAcpApiKeys(): PublicAcpApiKey[] {
  return readRecords().map(publicKey).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createAcpApiKey(input: { name: string; owner: string; ownerUserId?: string; adapter: AcpAdapter; permissions?: unknown; createdBy?: string }) {
  const name = input.name.trim().slice(0, 80);
  const owner = input.owner.trim().slice(0, 80);
  if (!name) throw new Error('API key name required.');
  if (!owner) throw new Error('Owner required.');
  const rawKey = `apx_${input.adapter}_${crypto.randomBytes(24).toString('base64url')}`;
  const record: AcpApiKeyRecord = {
    id: `acp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    name,
    owner,
    ownerUserId: input.ownerUserId,
    adapter: input.adapter,
    permissions: normalizePermissions(input.permissions, input.adapter),
    status: 'active',
    keyHash: sha256(rawKey),
    keyPreview: `${rawKey.slice(0, 14)}…${rawKey.slice(-4)}`,
    createdAt: nowIso(),
    createdBy: input.createdBy?.trim().slice(0, 120),
  };
  const records = readRecords();
  records.push(record);
  writeRecords(records);
  return { key: rawKey, record: publicKey(record) };
}

export function revokeAcpApiKey(id: string) {
  const records = readRecords();
  const index = records.findIndex((record) => record.id === id);
  if (index < 0) return null;
  records[index] = { ...records[index], status: 'revoked', revokedAt: nowIso() };
  writeRecords(records);
  return publicKey(records[index]);
}

export function verifyAcpApiKey(rawKey?: string | null) {
  if (!rawKey) return null;
  const hash = sha256(rawKey);
  const records = readRecords();
  const index = records.findIndex((record) => record.status === 'active' && timingSafeEqual(record.keyHash, hash));
  if (index < 0) return null;
  records[index] = { ...records[index], lastUsedAt: nowIso() };
  writeRecords(records);
  return publicKey(records[index]);
}

export function canAcpKey(record: PublicAcpApiKey, permission: AcpPermission) {
  return record.status === 'active' && (record.permissions.includes('admin_settings') || record.permissions.includes(permission));
}
