import fs from 'node:fs';
import path from 'node:path';

export type SchoolAuthType = 'api_key' | 'oauth';

export type SchoolConnectionInput = {
  apiKey?: string;
  oauthToken?: string;
  baseUrl?: string;
  provider?: string;
};

export type SchoolConnection = {
  provider: string;
  baseUrl?: string;
  apiKey?: string;
  oauthToken?: string;
};

export type ConnectionStatus = {
  connected: boolean;
  provider: string;
  accountLabel?: string;
  error?: string;
};

export type Course = {
  id: string;
  title: string;
  url?: string;
  status?: string;
  updatedAt?: string;
};

export type ProgressRecord = {
  courseId: string;
  title: string;
  percent?: number;
  completed?: boolean;
  lastActivityAt?: string;
  sourceUrl?: string;
};

export type ProgressLog = {
  id: string;
  createdAt: string;
  provider: string;
  courseId?: string;
  action: string;
  summary: string;
  metadata?: Record<string, unknown>;
  source?: string;
};

export type ProgressLogInput = {
  courseId?: string;
  action?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  source?: string;
};

export type SchoolProgressAdapter = {
  id: string;
  name: string;
  authType: SchoolAuthType;
  connect(input?: SchoolConnectionInput): Promise<ConnectionStatus>;
  healthCheck(connection?: SchoolConnection): Promise<ConnectionStatus>;
  listCourses(connection?: SchoolConnection): Promise<Course[]>;
  getProgress(connection?: SchoolConnection, courseId?: string): Promise<ProgressRecord[]>;
  appendProgressLog(connection: SchoolConnection | undefined, event: ProgressLogInput): Promise<ProgressLog>;
};

const LOG_PATH = path.join(process.cwd(), 'research-vault', 'ops', 'school-progress-log.json');

const mockCourses: Course[] = [
  { id: 'praxis-101', title: 'Agent Praxis Foundations', url: 'https://mock-school.local/courses/praxis-101', status: 'active', updatedAt: '2026-05-18T08:00:00.000Z' },
  { id: 'operator-201', title: 'Evidence Operator Workflow', url: 'https://mock-school.local/courses/operator-201', status: 'active', updatedAt: '2026-05-18T10:30:00.000Z' },
  { id: 'mcp-301', title: 'MCP/ACP Integration Lab', url: 'https://mock-school.local/courses/mcp-301', status: 'draft', updatedAt: '2026-05-18T11:00:00.000Z' },
];

const mockProgress: ProgressRecord[] = [
  { courseId: 'praxis-101', title: 'Agent Praxis Foundations', percent: 64, completed: false, lastActivityAt: '2026-05-18T12:00:00.000Z', sourceUrl: 'https://mock-school.local/courses/praxis-101/progress' },
  { courseId: 'operator-201', title: 'Evidence Operator Workflow', percent: 35, completed: false, lastActivityAt: '2026-05-18T13:20:00.000Z', sourceUrl: 'https://mock-school.local/courses/operator-201/progress' },
  { courseId: 'mcp-301', title: 'MCP/ACP Integration Lab', percent: 12, completed: false, lastActivityAt: '2026-05-18T14:10:00.000Z', sourceUrl: 'https://mock-school.local/courses/mcp-301/progress' },
];

function nowIso() {
  return new Date().toISOString();
}

function cleanText(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function providerFromEnv() {
  return cleanText(process.env.SCHOOL_ACP_PROVIDER, '');
}

function envConnection(input: SchoolConnectionInput = {}): SchoolConnection {
  return {
    provider: cleanText(input.provider, providerFromEnv() || 'unconfigured'),
    baseUrl: cleanText(input.baseUrl, process.env.SCHOOL_ACP_BASE_URL || '') || undefined,
    apiKey: cleanText(input.apiKey, process.env.SCHOOL_ACP_API_KEY || '') || undefined,
    oauthToken: cleanText(input.oauthToken, process.env.SCHOOL_ACP_OAUTH_TOKEN || '') || undefined,
  };
}

function ensureConfigured(connection: SchoolConnection) {
  if (connection.provider === 'mock-school') return;
  if (!connection.baseUrl) throw new Error('SCHOOL_ACP_BASE_URL is required unless SCHOOL_ACP_PROVIDER=mock-school.');
  if (!connection.apiKey && !connection.oauthToken) throw new Error('SCHOOL_ACP_API_KEY or SCHOOL_ACP_OAUTH_TOKEN is required for real school provider.');
}

function authToken(connection: SchoolConnection) {
  return connection.oauthToken || connection.apiKey || '';
}

function normalizeCourse(input: Record<string, unknown>): Course {
  return {
    id: cleanText(input.id, cleanText(input.courseId, cleanText(input.slug, 'course'))),
    title: cleanText(input.title, cleanText(input.name, 'Untitled course')),
    url: cleanText(input.url, cleanText(input.sourceUrl, '')) || undefined,
    status: cleanText(input.status, '') || undefined,
    updatedAt: cleanText(input.updatedAt, cleanText(input.updated_at, '')) || undefined,
  };
}

function normalizeProgress(input: Record<string, unknown>): ProgressRecord {
  const percent = Number(input.percent ?? input.progress ?? input.completionPercent);
  return {
    courseId: cleanText(input.courseId, cleanText(input.course_id, cleanText(input.id, 'course'))),
    title: cleanText(input.title, cleanText(input.name, 'Untitled progress')),
    percent: Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : undefined,
    completed: typeof input.completed === 'boolean' ? input.completed : undefined,
    lastActivityAt: cleanText(input.lastActivityAt, cleanText(input.last_activity_at, cleanText(input.updatedAt, ''))) || undefined,
    sourceUrl: cleanText(input.sourceUrl, cleanText(input.url, '')) || undefined,
  };
}

async function fetchJson(connection: SchoolConnection, pathname: string, init?: RequestInit) {
  ensureConfigured(connection);
  const base = connection.baseUrl?.replace(/\/$/, '');
  const response = await fetch(`${base}${pathname}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${authToken(connection)}`,
      ...(init?.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`School provider ${pathname} failed: ${response.status} ${response.statusText}`);
  return await response.json() as unknown;
}

function readLogs(): ProgressLog[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(LOG_PATH, 'utf8')) as unknown;
    return Array.isArray(parsed) ? parsed as ProgressLog[] : [];
  } catch {
    return [];
  }
}

function writeLogs(logs: ProgressLog[]) {
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.writeFileSync(LOG_PATH, `${JSON.stringify(logs, null, 2)}\n`);
}

export function listSchoolProgressLogs(limit = 20) {
  return readLogs().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

export function appendLocalSchoolProgressLog(provider: string, input: ProgressLogInput): ProgressLog {
  const log: ProgressLog = {
    id: `school-log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: nowIso(),
    provider,
    courseId: cleanText(input.courseId, '') || undefined,
    action: cleanText(input.action, 'progress_logged'),
    summary: cleanText(input.summary, 'Hermes logged school progress.'),
    metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : undefined,
    source: cleanText(input.source, 'agent-praxis') || undefined,
  };
  writeLogs([...readLogs(), log]);
  return log;
}

function fromArrayPayload(payload: unknown, key: string) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const value = (payload as Record<string, unknown>)[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

export const mockSchoolAdapter: SchoolProgressAdapter = {
  id: 'mock-school',
  name: 'Mock School',
  authType: 'api_key',
  async connect() {
    return { connected: true, provider: 'mock-school', accountLabel: 'Mock Learner · Hermes Praxis Lab' };
  },
  async healthCheck() {
    return { connected: true, provider: 'mock-school', accountLabel: 'Mock Learner · Hermes Praxis Lab' };
  },
  async listCourses() {
    return mockCourses;
  },
  async getProgress(_connection, courseId) {
    return courseId ? mockProgress.filter((item) => item.courseId === courseId) : mockProgress;
  },
  async appendProgressLog(connection, event) {
    return appendLocalSchoolProgressLog(connection?.provider || 'mock-school', event);
  },
};

export const remoteSchoolAdapter: SchoolProgressAdapter = {
  id: 'school-api',
  name: 'School API',
  authType: 'api_key',
  async connect(input) {
    const connection = envConnection(input);
    try {
      ensureConfigured(connection);
      return await this.healthCheck(connection);
    } catch (error) {
      return { connected: false, provider: connection.provider, error: error instanceof Error ? error.message : String(error) };
    }
  },
  async healthCheck(connection = envConnection()) {
    try {
      const payload = await fetchJson(connection, '/status');
      const data = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
      return {
        connected: data.connected !== false,
        provider: cleanText(data.provider, connection.provider),
        accountLabel: cleanText(data.accountLabel, cleanText(data.account_label, 'School API account')),
        error: cleanText(data.error, '') || undefined,
      };
    } catch (error) {
      return { connected: false, provider: connection.provider, error: error instanceof Error ? error.message : String(error) };
    }
  },
  async listCourses(connection = envConnection()) {
    const payload = await fetchJson(connection, '/courses');
    return fromArrayPayload(payload, 'courses').map((item) => normalizeCourse(item as Record<string, unknown>));
  },
  async getProgress(connection = envConnection(), courseId) {
    const suffix = courseId ? `?courseId=${encodeURIComponent(courseId)}` : '';
    const payload = await fetchJson(connection, `/progress${suffix}`);
    return fromArrayPayload(payload, 'progress').map((item) => normalizeProgress(item as Record<string, unknown>));
  },
  async appendProgressLog(connection = envConnection(), event) {
    const payload = await fetchJson(connection, '/progress-log', { method: 'POST', body: JSON.stringify(event) });
    const data = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
    return appendLocalSchoolProgressLog(connection.provider, {
      courseId: cleanText(data.courseId, event.courseId || '') || undefined,
      action: cleanText(data.action, event.action || 'progress_logged'),
      summary: cleanText(data.summary, event.summary || 'Remote school progress logged.'),
      metadata: { remote: data, ...(event.metadata || {}) },
      source: cleanText(event.source, 'remote-school-api'),
    });
  },
};

export function getSchoolConnection(input: SchoolConnectionInput = {}) {
  return envConnection(input);
}

export function getSchoolProgressAdapter(connection = getSchoolConnection()): SchoolProgressAdapter {
  return connection.provider === 'mock-school' ? mockSchoolAdapter : remoteSchoolAdapter;
}

export async function getSchoolStatus(input: SchoolConnectionInput = {}) {
  const connection = getSchoolConnection(input);
  const adapter = getSchoolProgressAdapter(connection);
  const status = await adapter.connect(input);
  return {
    ...status,
    provider: status.provider || connection.provider,
    authType: adapter.authType,
    configured: status.connected || connection.provider === 'mock-school' || Boolean(connection.baseUrl && (connection.apiKey || connection.oauthToken)),
    logPath: path.relative(process.cwd(), LOG_PATH),
  };
}

export async function listSchoolCourses(input: SchoolConnectionInput = {}) {
  const connection = getSchoolConnection(input);
  return getSchoolProgressAdapter(connection).listCourses(connection);
}

export async function listSchoolProgress(courseId?: string, input: SchoolConnectionInput = {}) {
  const connection = getSchoolConnection(input);
  return getSchoolProgressAdapter(connection).getProgress(connection, courseId);
}

export async function logSchoolProgress(event: ProgressLogInput, input: SchoolConnectionInput = {}) {
  const connection = getSchoolConnection(input);
  return getSchoolProgressAdapter(connection).appendProgressLog(connection, event);
}
