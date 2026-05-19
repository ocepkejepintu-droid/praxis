import fs from 'node:fs';
import path from 'node:path';

export type OperatorLane = 'buildroom' | 'verify' | 'content' | 'watch';

export type OperatorDispatch = {
  runId?: string;
  generatedAt?: string;
  handoffs?: Record<OperatorLane, unknown[]>;
  blocked?: unknown[];
  needsAttention?: unknown[];
};

export type ResearchHealth = {
  runId?: string;
  generatedAt?: string;
  weakEvidenceItems?: number;
  staleItems?: number;
  needsAttention?: number;
  orphanNoSourceCount?: number;
  xSearch?: { pending?: number; ok?: number };
  replyFetch?: { ok?: number; failures?: number };
  verificationGaps?: string[];
  sourceBalance?: Record<string, number>;
};

const OPS_DIR = path.join(process.cwd(), 'research-vault', 'ops');
const HEALTH_DIR = path.join(process.cwd(), 'research-vault', 'health');
const CLAIMS_DIR = path.join(process.cwd(), 'research-vault', 'claims');
const QUEUE_DIR = path.join(process.cwd(), 'queue');

function readJson<T>(file: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) as T; } catch { return fallback; }
}

function readText(file: string) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return ''; }
}

export function getOperatorDispatch(): OperatorDispatch {
  return readJson<OperatorDispatch>(path.join(OPS_DIR, 'dispatch.json'), { handoffs: { buildroom: [], verify: [], content: [], watch: [] }, blocked: [], needsAttention: [] });
}

export function getResearchHealth(): ResearchHealth {
  return readJson<ResearchHealth>(path.join(HEALTH_DIR, 'latest-health-check.json'), {});
}

export function getOperatorBrief() {
  return readText(path.join(OPS_DIR, 'operator-brief.md'));
}

export function getOperatorFocus() {
  return readText(path.join(OPS_DIR, 'focus.md'));
}

export function getOperatorActionLedger() {
  return readText(path.join(OPS_DIR, 'action-ledger.md'));
}

export function getOperatorCockpitHtml() {
  return readText(path.join(OPS_DIR, 'operator-cockpit.html'));
}

export function listOperatorClaims(limit = 100) {
  try {
    return fs.readdirSync(CLAIMS_DIR)
      .filter((file) => file.endsWith('.json'))
      .sort()
      .slice(0, limit)
      .map((file) => readJson(path.join(CLAIMS_DIR, file), { claimId: path.basename(file, '.json') }));
  } catch {
    return [];
  }
}

export function readHandoffQueue(lane: OperatorLane) {
  return readJson(path.join(QUEUE_DIR, `${lane}-handoff.json`), { lane, items: [] });
}

export function getOperatorSnapshot() {
  const dispatch = getOperatorDispatch();
  const health = getResearchHealth();
  const lanes: OperatorLane[] = ['buildroom', 'verify', 'content', 'watch'];
  return {
    dispatch,
    health,
    lanes: Object.fromEntries(lanes.map((lane) => [lane, dispatch.handoffs?.[lane]?.length || 0])) as Record<OperatorLane, number>,
    blocked: dispatch.blocked?.length || 0,
    needsAttention: dispatch.needsAttention?.length || health.needsAttention || 0,
    claims: listOperatorClaims(500).length,
    hasCockpit: Boolean(getOperatorCockpitHtml()),
  };
}
