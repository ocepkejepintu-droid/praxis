import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { RequestAuth } from './auth.ts';
import {
  getLatestPraxisLearningMorningReport,
  listPraxisLearningReports,
  praxisLearningPathsForStorage,
  praxisLearningStatus,
  runPraxisLearningBatch,
  type PraxisLearnerAgent,
  type PraxisLearningAggregateReport,
  type PraxisLearningBatchOptions,
  type PraxisLearningStorageScope,
} from './praxis-learning.ts';

export type PraxisLearningJobState = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export type PraxisLearningPlan = {
  id: 'praxis_pro_100';
  name: 'Praxis Pro';
  priceUsdMonthly: 100;
  maxNightlyRunsPerDay: number;
  maxPraxisPerRun: number;
  maxAgentsPerRun: number;
  runtimeBudgetMsPerRun: number;
  runtimeBudgetMsPerDay: number;
  xSearchCallsPerDay: number;
};

export type PraxisLearningUsage = {
  date: string;
  jobsCreated: number;
  selectedPraxis: number;
  agentsRun: number;
  reportsGenerated: number;
  runtimeMs: number;
  xSearchCalls: number;
  failures: number;
  blockers: number;
};

export type PraxisLearningJob = {
  id: string;
  ownerId: string;
  ownerLabel: string;
  state: PraxisLearningJobState;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  request: {
    agents: PraxisLearnerAgent[];
    limit: number;
    minScore: number;
    safeMode: boolean;
    reportKind: 'morning' | 'overnight';
    promoteDrafts: boolean;
    objective: string;
    xSearchCallsRequested: number;
  };
  usage: PraxisLearningUsage;
  aggregateId?: string;
  aggregate?: PraxisLearningAggregateReport;
  artifacts: string[];
};

export type PraxisRuntimeProviderStatus = {
  agent: 'hermes' | 'openclaw';
  enabled: false;
  runtimeAvailable: false;
  requiredConfig: string[];
  blockedReason: string;
  secretConfigured: boolean;
  secretExposed: false;
};

export type PraxisLearningTenantSettings = {
  ownerId: string;
  ownerLabel: string;
  plan: PraxisLearningPlan;
  notificationTargets: {
    email?: { configured: boolean; address?: string; lastDeliveryStatus?: string };
    telegram?: { configured: boolean; chatLabel?: string; lastDeliveryStatus?: string };
    whatsapp?: { configured: boolean; phoneLabel?: string; lastDeliveryStatus?: string };
  };
  runtimeProviders: PraxisRuntimeProviderStatus[];
  updatedAt: string;
};

export const praxisProPlan: PraxisLearningPlan = {
  id: 'praxis_pro_100',
  name: 'Praxis Pro',
  priceUsdMonthly: 100,
  maxNightlyRunsPerDay: 3,
  maxPraxisPerRun: 10,
  maxAgentsPerRun: 4,
  runtimeBudgetMsPerRun: 30_000,
  runtimeBudgetMsPerDay: 120_000,
  xSearchCallsPerDay: 0,
};

export type RuntimeRunner = {
  id: string;
  kind: 'mock' | 'external';
  canRun(agent: PraxisLearnerAgent): boolean;
  timeoutMs: number;
  workspaceDir: string;
  allowlist: string[];
};

const TENANT_ROOT = path.join(process.cwd(), 'research-vault', 'tenants');
const RADAR_TENANT_ROOT = path.join(process.cwd(), '.radar', 'tenants');

function nowIso() {
  return new Date().toISOString();
}

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function shortHash(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function safeTenantId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || `tenant-${shortHash(value)}`;
}

export function tenantFromAuth(auth: RequestAuth) {
  if (auth.kind === 'user') return { ownerId: safeTenantId(auth.user.id), ownerLabel: auth.user.email || auth.user.name };
  if (auth.kind === 'acp') return { ownerId: safeTenantId(auth.key.ownerUserId || `acp-${auth.key.id}`), ownerLabel: auth.key.owner || auth.key.name };
  return { ownerId: 'master', ownerLabel: 'Master token' };
}

export function tenantStorage(ownerId: string): PraxisLearningStorageScope {
  const safe = safeTenantId(ownerId);
  return {
    opsDir: path.join(TENANT_ROOT, safe, 'ops'),
    acpLogPath: path.join(RADAR_TENANT_ROOT, safe, 'acp-log.jsonl'),
  };
}

function tenantFile(ownerId: string, name: string) {
  return path.join(tenantStorage(ownerId).opsDir, name);
}

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function emptyUsage(): PraxisLearningUsage {
  return { date: todayKey(), jobsCreated: 0, selectedPraxis: 0, agentsRun: 0, reportsGenerated: 0, runtimeMs: 0, xSearchCalls: 0, failures: 0, blockers: 0 };
}

export function runtimeRunnerStatus(): PraxisRuntimeProviderStatus[] {
  return [
    {
      agent: 'hermes',
      enabled: false,
      runtimeAvailable: false,
      requiredConfig: ['REAL_PRAXIS_RUNTIME_RUNNER', 'HERMES_LEARNER_COMMAND_ALLOWLIST', 'HERMES_LEARNER_WORKSPACE_DIR'],
      blockedReason: 'Real Hermes runtime is blocked until a repo-approved RuntimeRunner with allowlist, timeout, and workspace boundary exists.',
      secretConfigured: Boolean(process.env.HERMES_LEARNER_SECRET_CONFIGURED === '1'),
      secretExposed: false,
    },
    {
      agent: 'openclaw',
      enabled: false,
      runtimeAvailable: false,
      requiredConfig: ['REAL_PRAXIS_RUNTIME_RUNNER', 'OPENCLAW_LEARNER_COMMAND_ALLOWLIST', 'OPENCLAW_LEARNER_WORKSPACE_DIR'],
      blockedReason: 'Real OpenClaw runtime is blocked until a repo-approved RuntimeRunner with allowlist, timeout, and workspace boundary exists.',
      secretConfigured: Boolean(process.env.OPENCLAW_LEARNER_SECRET_CONFIGURED === '1'),
      secretExposed: false,
    },
  ];
}

export function defaultRuntimeRunner(ownerId: string): RuntimeRunner {
  return {
    id: `safe-mock-${safeTenantId(ownerId)}`,
    kind: 'mock',
    canRun: (agent) => agent === 'mock-hermes' || agent === 'mock-openclaw',
    timeoutMs: praxisProPlan.runtimeBudgetMsPerRun,
    workspaceDir: tenantStorage(ownerId).opsDir,
    allowlist: ['mock-hermes', 'mock-openclaw'],
  };
}

export function readTenantSettings(ownerId: string, ownerLabel = ownerId): PraxisLearningTenantSettings {
  const file = tenantFile(ownerId, 'praxis-learning-settings.json');
  const existing = readJson<Partial<PraxisLearningTenantSettings>>(file, {});
  return {
    ownerId: safeTenantId(existing.ownerId || ownerId),
    ownerLabel: existing.ownerLabel || ownerLabel,
    plan: praxisProPlan,
    notificationTargets: existing.notificationTargets || {
      email: { configured: false, lastDeliveryStatus: 'blocked: email provider not configured' },
      telegram: { configured: false, lastDeliveryStatus: 'blocked: telegram provider not configured' },
      whatsapp: { configured: false, lastDeliveryStatus: 'blocked: whatsapp provider not configured' },
    },
    runtimeProviders: runtimeRunnerStatus(),
    updatedAt: existing.updatedAt || nowIso(),
  };
}

export function writeTenantSettings(settings: PraxisLearningTenantSettings) {
  const safe: PraxisLearningTenantSettings = {
    ...settings,
    ownerId: safeTenantId(settings.ownerId),
    plan: praxisProPlan,
    runtimeProviders: runtimeRunnerStatus(),
    updatedAt: nowIso(),
  };
  writeJson(tenantFile(safe.ownerId, 'praxis-learning-settings.json'), safe);
  return safe;
}

export function listTenantJobs(ownerId: string): PraxisLearningJob[] {
  return readJson<PraxisLearningJob[]>(tenantFile(ownerId, 'praxis-learning-jobs.json'), [])
    .filter((job) => job.ownerId === safeTenantId(ownerId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function writeTenantJobs(ownerId: string, jobs: PraxisLearningJob[]) {
  const safe = safeTenantId(ownerId);
  writeJson(tenantFile(safe, 'praxis-learning-jobs.json'), jobs.filter((job) => job.ownerId === safe));
}

export function getTenantJob(ownerId: string, id: string) {
  return listTenantJobs(ownerId).find((job) => job.id === id) || null;
}

export function readTenantUsage(ownerId: string): PraxisLearningUsage {
  const usage = readJson<PraxisLearningUsage>(tenantFile(ownerId, 'praxis-learning-usage.json'), emptyUsage());
  return usage.date === todayKey() ? usage : emptyUsage();
}

function writeTenantUsage(ownerId: string, usage: PraxisLearningUsage) {
  writeJson(tenantFile(ownerId, 'praxis-learning-usage.json'), usage);
}

function parseAgents(value: unknown): PraxisLearnerAgent[] {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : ['mock-hermes', 'mock-openclaw'];
  const valid = new Set(['hermes', 'openclaw', 'mock-hermes', 'mock-openclaw']);
  const agents = raw.map(String).map((item) => item.trim()).filter(Boolean);
  if (!agents.length) throw new Error('At least one agent is required.');
  for (const agent of agents) if (!valid.has(agent)) throw new Error(`Invalid agent ${agent}.`);
  return Array.from(new Set(agents)) as PraxisLearnerAgent[];
}

function numberInput(value: unknown, fallback: number) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Expected finite number, got ${String(value)}.`);
  return parsed;
}

export function validatePlanRequest(ownerId: string, input: { agents: PraxisLearnerAgent[]; limit: number; xSearchCallsRequested?: number }) {
  const usage = readTenantUsage(ownerId);
  const violations: Array<{ field: string; limit: number; actual: number; message: string }> = [];
  if (usage.jobsCreated >= praxisProPlan.maxNightlyRunsPerDay) violations.push({ field: 'nightlyRunsPerDay', limit: praxisProPlan.maxNightlyRunsPerDay, actual: usage.jobsCreated + 1, message: 'Daily nightly run limit reached for Praxis Pro.' });
  if (input.limit > praxisProPlan.maxPraxisPerRun) violations.push({ field: 'maxPraxisPerRun', limit: praxisProPlan.maxPraxisPerRun, actual: input.limit, message: 'Praxis per run exceeds Praxis Pro limit.' });
  if (input.agents.length > praxisProPlan.maxAgentsPerRun) violations.push({ field: 'maxAgentsPerRun', limit: praxisProPlan.maxAgentsPerRun, actual: input.agents.length, message: 'Agent count exceeds Praxis Pro limit.' });
  const xSearchCalls = input.xSearchCallsRequested || 0;
  if (usage.xSearchCalls + xSearchCalls > praxisProPlan.xSearchCallsPerDay) violations.push({ field: 'xSearchCallsPerDay', limit: praxisProPlan.xSearchCallsPerDay, actual: usage.xSearchCalls + xSearchCalls, message: 'x_search is disabled by default for Praxis Pro alpha; use explicit budget gating later.' });
  if (usage.runtimeMs >= praxisProPlan.runtimeBudgetMsPerDay) violations.push({ field: 'runtimeBudgetMsPerDay', limit: praxisProPlan.runtimeBudgetMsPerDay, actual: usage.runtimeMs, message: 'Daily runtime budget reached.' });
  return { ok: violations.length === 0, plan: praxisProPlan, usage, violations };
}

export function createPraxisLearningJobInput(body: Record<string, unknown>): Pick<PraxisLearningJob, 'request'>['request'] {
  const agents = parseAgents(body.agents);
  const limit = Math.trunc(numberInput(body.limit, 5));
  const minScore = numberInput(body.minScore, 5);
  if (limit < 1) throw new Error('limit must be >= 1.');
  if (minScore < 0) throw new Error('minScore must be >= 0.');
  return {
    agents,
    limit,
    minScore,
    safeMode: body.safeMode !== false,
    reportKind: body.reportKind === 'overnight' ? 'overnight' : 'morning',
    promoteDrafts: body.promoteDrafts === true,
    objective: typeof body.objective === 'string' && body.objective.trim() ? body.objective.trim().slice(0, 500) : 'Study source-backed Praxis entries and report reusable lessons without external side effects.',
    xSearchCallsRequested: Math.trunc(numberInput(body.xSearchCallsRequested, 0)),
  };
}

export function createQueuedPraxisLearningJob(ownerId: string, ownerLabel: string, request: Pick<PraxisLearningJob, 'request'>['request']) {
  const safeOwner = safeTenantId(ownerId);
  const guard = validatePlanRequest(safeOwner, { agents: request.agents, limit: request.limit, xSearchCallsRequested: request.xSearchCallsRequested });
  if (!guard.ok) return { ok: false as const, guard };
  const usage = { ...guard.usage, jobsCreated: guard.usage.jobsCreated + 1 };
  writeTenantUsage(safeOwner, usage);
  const job: PraxisLearningJob = {
    id: `plj_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    ownerId: safeOwner,
    ownerLabel,
    state: 'queued',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    request,
    usage,
    artifacts: [path.relative(process.cwd(), tenantFile(safeOwner, 'praxis-learning-jobs.json'))],
  };
  writeTenantJobs(safeOwner, [job, ...listTenantJobs(safeOwner)]);
  return { ok: true as const, job };
}

function updateJob(ownerId: string, job: PraxisLearningJob) {
  const safeOwner = safeTenantId(ownerId);
  const jobs = listTenantJobs(safeOwner);
  const index = jobs.findIndex((item) => item.id === job.id);
  const next = { ...job, updatedAt: nowIso() };
  if (index >= 0) jobs[index] = next;
  else jobs.unshift(next);
  writeTenantJobs(safeOwner, jobs);
  return next;
}

function usageFromAggregate(base: PraxisLearningUsage, aggregate: PraxisLearningAggregateReport, runtimeMs: number): PraxisLearningUsage {
  return {
    ...base,
    selectedPraxis: base.selectedPraxis + aggregate.selectedPraxisCount,
    agentsRun: base.agentsRun + aggregate.agentsUsed.length,
    reportsGenerated: base.reportsGenerated + aggregate.reportsCreated,
    runtimeMs: base.runtimeMs + runtimeMs,
    xSearchCalls: base.xSearchCalls + 0,
    failures: base.failures + aggregate.counts.failed,
    blockers: base.blockers + aggregate.counts.blocked,
  };
}

export async function runTenantPraxisLearningJob(ownerId: string, jobId: string) {
  const job = getTenantJob(ownerId, jobId);
  if (!job) return null;
  if (job.state === 'cancelled') return job;
  let running = updateJob(ownerId, { ...job, state: 'running', startedAt: nowIso() });
  const started = Date.now();
  try {
    const storage = tenantStorage(ownerId);
    const aggregate = await runPraxisLearningBatch({
      agents: running.request.agents,
      limit: Math.min(running.request.limit, praxisProPlan.maxPraxisPerRun),
      minScore: running.request.minScore,
      safeMode: running.request.safeMode,
      includeRealAgents: true,
      includeRecent: true,
      objective: running.request.objective,
      reportKind: running.request.reportKind,
      promoteDrafts: running.request.promoteDrafts,
      writeAggregate: true,
      storage,
    } satisfies PraxisLearningBatchOptions);
    const runtimeMs = Date.now() - started;
    const usage = usageFromAggregate(readTenantUsage(ownerId), aggregate, runtimeMs);
    writeTenantUsage(ownerId, usage);
    running = updateJob(ownerId, { ...running, state: 'completed', completedAt: nowIso(), aggregateId: aggregate.id, aggregate, usage, artifacts: Array.from(new Set([...running.artifacts, ...aggregate.artifactsChanged])) });
  } catch (error) {
    const usage = { ...readTenantUsage(ownerId), failures: readTenantUsage(ownerId).failures + 1, runtimeMs: readTenantUsage(ownerId).runtimeMs + (Date.now() - started) };
    writeTenantUsage(ownerId, usage);
    running = updateJob(ownerId, { ...running, state: 'failed', completedAt: nowIso(), error: error instanceof Error ? error.message : String(error), usage });
  }
  return running;
}

export async function createAndRunPraxisLearningJob(ownerId: string, ownerLabel: string, request: Pick<PraxisLearningJob, 'request'>['request']) {
  const created = createQueuedPraxisLearningJob(ownerId, ownerLabel, request);
  if (!created.ok) return created;
  const job = await runTenantPraxisLearningJob(ownerId, created.job.id);
  return { ok: true as const, job: job || created.job };
}

export function cancelTenantPraxisLearningJob(ownerId: string, id: string) {
  const job = getTenantJob(ownerId, id);
  if (!job) return null;
  if (job.state === 'completed' || job.state === 'failed') return job;
  return updateJob(ownerId, { ...job, state: 'cancelled', completedAt: nowIso() });
}

export function tenantPraxisLearningDashboard(ownerId: string, ownerLabel = ownerId) {
  const safeOwner = safeTenantId(ownerId);
  const storage = tenantStorage(safeOwner);
  const settings = writeTenantSettings(readTenantSettings(safeOwner, ownerLabel));
  const jobs = listTenantJobs(safeOwner);
  const usage = readTenantUsage(safeOwner);
  const status = praxisLearningStatus(storage);
  const morning = getLatestPraxisLearningMorningReport(storage);
  return {
    ok: true,
    tenant: { ownerId: safeOwner, ownerLabel },
    mode: 'saas-alpha-file-backed',
    plan: praxisProPlan,
    usage,
    limitsRemaining: {
      nightlyRunsToday: Math.max(0, praxisProPlan.maxNightlyRunsPerDay - usage.jobsCreated),
      runtimeMsToday: Math.max(0, praxisProPlan.runtimeBudgetMsPerDay - usage.runtimeMs),
      xSearchCallsToday: Math.max(0, praxisProPlan.xSearchCallsPerDay - usage.xSearchCalls),
    },
    settings,
    runtimeRunner: defaultRuntimeRunner(safeOwner),
    jobs: jobs.slice(0, 20),
    latestJob: jobs[0] || null,
    reports: listPraxisLearningReports(12, storage),
    morningReport: morning,
    status,
    paths: praxisLearningPathsForStorage(storage),
  };
}

export type PraxisLearningTenantDashboard = ReturnType<typeof tenantPraxisLearningDashboard>;
