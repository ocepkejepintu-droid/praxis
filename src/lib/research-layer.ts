import fs from 'node:fs';
import path from 'node:path';
import { readIngestionRun } from './ingestion-status.ts';

export type ResearchLane = 'buildroom' | 'verify' | 'content' | 'watch';
export type ResearchPriority = 'high' | 'medium' | 'low';
export type ResearchOwner = 'Hermes' | 'OMX' | 'Yoseph';
export type VerificationStatus = 'unverified' | 'needs_verification' | 'partially_verified' | 'verified';
export type EvidenceStrength = 'weak' | 'medium' | 'strong';

type ResearchFields = {
  targetLane?: ResearchLane;
  priority?: ResearchPriority;
  owner?: ResearchOwner;
  blockedReason?: string;
  verificationStatus?: VerificationStatus;
  evidenceStrength?: EvidenceStrength;
  claims?: string[];
  sourceUrls?: string[];
  sourceNotePath?: string;
  dependencyUrls?: string[];
  originalTargetLane?: ResearchLane;
  reroutedReason?: string;
};

export type ResearchIdeaInput = ResearchFields & {
  title: string;
  stage?: string;
  thesis: string;
  whyNow: string;
  nextMove: string;
  executionPath?: string[];
  leverage?: number;
  effort?: number;
};

export type ResearchExperimentInput = ResearchFields & {
  title: string;
  stage?: string;
  hypothesis: string;
  firstTest: string;
  successSignal: string;
  killCriteria?: string;
  executionPath?: string[];
};

export type ResearchActionInput = ResearchFields & {
  text: string;
  category?: string;
  reason?: string;
};

export type ResearchJudgementPayload = {
  runId?: string;
  summary?: string;
  ideas?: ResearchIdeaInput[];
  experiments?: ResearchExperimentInput[];
  actions?: ResearchActionInput[];
};

type OperatorItem = {
  id: string;
  kind: 'idea' | 'experiment' | 'action';
  title: string;
  statement: string;
  nextAction: string;
  runId: string;
  sourceUrls: string[];
  sourceNotePath: string;
  dependencyUrls: string[];
  targetLane: ResearchLane;
  originalTargetLane?: ResearchLane;
  priority: ResearchPriority;
  owner: ResearchOwner;
  blockedReason?: string;
  verificationStatus: VerificationStatus;
  evidenceStrength: EvidenceStrength;
  claims: string[];
  reroutedReason?: string;
};

export type ResearchLayerResult = {
  ok: true;
  runId: string;
  generatedAt: string;
  files: string[];
  counts: Record<string, number>;
};

const LANES: ResearchLane[] = ['buildroom', 'verify', 'content', 'watch'];
const ROOT = '.';

function repoPath(root: string, ...segments: string[]) {
  if (root !== ROOT) throw new Error('Custom research-layer root must be handled before path resolution.');
  const parts = segments.flatMap((segment) => segment.split(/[\/]+/).filter(Boolean));
  const [scope, ...rest] = parts;
  if (scope === 'research-vault') return path.join(process.cwd(), 'research-vault', ...rest);
  if (scope === 'queue') return path.join(process.cwd(), 'queue', ...rest);
  if (scope === '.omx') return path.join(process.cwd(), '.omx', ...rest);
  throw new Error(`Unsupported research-layer path scope: ${scope || 'empty'}`);
}


function cleanString(value: unknown, max = 2000) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function cleanLines(values: unknown, max = 12) {
  if (!Array.isArray(values)) return [];
  return values.map((value) => cleanString(value, 1000)).filter(Boolean).slice(0, max);
}

function normalizeLane(value: unknown): ResearchLane {
  const clean = cleanString(value, 40);
  return LANES.includes(clean as ResearchLane) ? clean as ResearchLane : 'verify';
}

function normalizePriority(value: unknown): ResearchPriority {
  const clean = cleanString(value, 40);
  return clean === 'high' || clean === 'low' ? clean : 'medium';
}

function normalizeOwner(value: unknown): ResearchOwner {
  const clean = cleanString(value, 40);
  return clean === 'OMX' || clean === 'Yoseph' ? clean : 'Hermes';
}

function normalizeVerificationStatus(value: unknown): VerificationStatus {
  const clean = cleanString(value, 80);
  if (clean === 'unverified' || clean === 'partially_verified' || clean === 'verified') return clean;
  return 'needs_verification';
}

function normalizeEvidenceStrength(value: unknown): EvidenceStrength {
  const clean = cleanString(value, 40);
  return clean === 'medium' || clean === 'strong' ? clean : 'weak';
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'item';
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function shortId(kind: string, runId: string, title: string, index: number) {
  return `${kind}-${stableHash(`${runId}:${title}:${index}`)}`;
}

function fallbackClaims(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => cleanString(part, 260))
    .filter((part) => part.length >= 24)
    .slice(0, 3);
}

function normalizeClaims(explicit: unknown, fallbackText: string) {
  const claims = cleanLines(explicit, 8);
  return claims.length ? claims : fallbackClaims(fallbackText);
}

function normalizeResearchFields<T extends ResearchFields>(input: T): T {
  const normalized = {
    ...input,
    targetLane: normalizeLane(input.targetLane),
    priority: normalizePriority(input.priority),
    owner: normalizeOwner(input.owner),
    blockedReason: cleanString(input.blockedReason, 400) || undefined,
    verificationStatus: normalizeVerificationStatus(input.verificationStatus),
    evidenceStrength: normalizeEvidenceStrength(input.evidenceStrength),
  };
  if (normalized.evidenceStrength === 'weak' && normalized.targetLane === 'buildroom') {
    return {
      ...normalized,
      originalTargetLane: 'buildroom',
      targetLane: normalized.verificationStatus === 'unverified' ? 'watch' : 'verify',
      blockedReason: normalized.blockedReason || 'Weak evidence cannot enter buildroom without verification.',
      reroutedReason: 'weak evidence cannot enter buildroom without verification',
    };
  }
  return normalized;
}

export function normalizeResearchJudgementPayload(payload: ResearchJudgementPayload): ResearchJudgementPayload {
  return {
    ...payload,
    ideas: payload.ideas?.map(normalizeResearchFields),
    experiments: payload.experiments?.map(normalizeResearchFields),
    actions: payload.actions?.map(normalizeResearchFields),
  };
}

function enforceLane(item: OperatorItem): OperatorItem {
  if (item.evidenceStrength === 'weak' && item.targetLane === 'buildroom') {
    return {
      ...item,
      originalTargetLane: 'buildroom',
      targetLane: item.verificationStatus === 'unverified' ? 'watch' : 'verify',
      reroutedReason: 'weak evidence cannot enter buildroom without verification',
    };
  }
  return item;
}

function normalizeItem(kind: OperatorItem['kind'], input: ResearchIdeaInput | ResearchExperimentInput | ResearchActionInput, runId: string, index: number): OperatorItem {
  const title = kind === 'action' ? cleanString((input as ResearchActionInput).text, 140) : cleanString((input as ResearchIdeaInput | ResearchExperimentInput).title, 160);
  const statement = kind === 'idea'
    ? cleanString((input as ResearchIdeaInput).thesis, 1200)
    : kind === 'experiment'
      ? cleanString((input as ResearchExperimentInput).hypothesis, 1200)
      : cleanString((input as ResearchActionInput).reason || (input as ResearchActionInput).text, 1200);
  const nextAction = kind === 'idea'
    ? cleanString((input as ResearchIdeaInput).nextMove, 1000)
    : kind === 'experiment'
      ? cleanString((input as ResearchExperimentInput).firstTest, 1000)
      : cleanString((input as ResearchActionInput).text, 1000);
  const base: OperatorItem = {
    id: shortId(kind, runId, title || statement, index),
    kind,
    title: title || `${kind} ${index + 1}`,
    statement: statement || nextAction,
    nextAction: nextAction || statement || 'Review this item before acting.',
    runId,
    sourceUrls: cleanLines(input.sourceUrls, 16),
    sourceNotePath: cleanString(input.sourceNotePath, 400) || 'pending',
    dependencyUrls: cleanLines(input.dependencyUrls, 12),
    targetLane: normalizeLane(input.targetLane),
    originalTargetLane: input.originalTargetLane ? normalizeLane(input.originalTargetLane) : undefined,
    priority: normalizePriority(input.priority),
    owner: normalizeOwner(input.owner),
    blockedReason: cleanString(input.blockedReason, 400) || undefined,
    verificationStatus: normalizeVerificationStatus(input.verificationStatus),
    evidenceStrength: normalizeEvidenceStrength(input.evidenceStrength),
    claims: normalizeClaims(input.claims, `${statement}. ${nextAction}`),
    reroutedReason: cleanString(input.reroutedReason, 400) || undefined,
  };
  return enforceLane(base);
}

function normalizePayload(payload: ResearchJudgementPayload) {
  const runId = cleanString(payload.runId, 160) || 'manual';
  const normalized = normalizeResearchJudgementPayload(payload);
  return [
    ...(normalized.ideas || []).slice(0, 12).map((item, index) => normalizeItem('idea', item, runId, index)),
    ...(normalized.experiments || []).slice(0, 12).map((item, index) => normalizeItem('experiment', item, runId, index)),
    ...(normalized.actions || []).slice(0, 20).map((item, index) => normalizeItem('action', item, runId, index)),
  ];
}

function ensureDirs(root: string) {
  for (const dir of ['research-vault/ops', 'research-vault/claims', 'research-vault/health', 'queue']) {
    fs.mkdirSync(repoPath(root, dir), { recursive: true });
  }
}

function writeText(root: string, rel: string, content: string) {
  const file = repoPath(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return rel;
}

function writeJson(root: string, rel: string, value: unknown) {
  return writeText(root, rel, `${JSON.stringify(value, null, 2)}\n`);
}

function priorityRank(priority: ResearchPriority) {
  return priority === 'high' ? 3 : priority === 'medium' ? 2 : 1;
}

function laneGroups(items: OperatorItem[]) {
  return Object.fromEntries(LANES.map((lane) => [lane, items.filter((item) => item.targetLane === lane)])) as Record<ResearchLane, OperatorItem[]>;
}

function itemLine(item: OperatorItem) {
  const reroute = item.reroutedReason ? ` _(rerouted from ${item.originalTargetLane}: ${item.reroutedReason})_` : '';
  return `- **${item.priority}** / ${item.targetLane} / ${item.owner}: ${item.title}${reroute}`;
}

function operatorBrief(payload: ResearchJudgementPayload, items: OperatorItem[], generatedAt: string) {
  const groups = laneGroups(items);
  const blocked = items.filter((item) => item.blockedReason);
  const weak = items.filter((item) => item.evidenceStrength === 'weak');
  const missingSource = items.filter((item) => !item.sourceUrls.length);
  return `# Operator Brief\n\nRun: ${payload.runId || 'manual'}\nGenerated: ${generatedAt}\n\n## Summary\n${payload.summary || 'Hermes judgement produced operator-ready research outputs.'}\n\n## What changed\n- Judgement promoted ${items.length} item(s) into research operator lanes.\n- Buildroom: ${groups.buildroom.length}\n- Verify: ${groups.verify.length}\n- Content: ${groups.content.length}\n- Watch: ${groups.watch.length}\n\n## Needs attention\n${[...weak, ...missingSource].slice(0, 8).map(itemLine).join('\n') || '- No immediate attention flags.'}\n\n## Blockers\n${blocked.map((item) => `- ${item.title}: ${item.blockedReason}`).join('\n') || '- None.'}\n\n## Human review\n- Review weak evidence before build work.\n- Check pending source note paths.\n- Promote only verified or medium/strong evidence into implementation.\n`;
}

function actionLedger(items: OperatorItem[], generatedAt: string) {
  const rows = items
    .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority))
    .map((item) => `| ${item.priority} | ${item.targetLane} | ${item.owner} | ${item.title.replace(/\|/g, '/')} | ${item.verificationStatus} | ${item.evidenceStrength} | ${item.nextAction.replace(/\|/g, '/')} |`)
    .join('\n');
  return `# Action Ledger\n\nGenerated: ${generatedAt}\n\n| Priority | Lane | Owner | Item | Verification | Evidence | Next action |\n|---|---|---|---|---|---|---|\n${rows || '| - | - | - | No actions | - | - | - |'}\n`;
}

function focusDoc(items: OperatorItem[], generatedAt: string) {
  const focus = items
    .filter((item) => !item.blockedReason)
    .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority) || (a.targetLane === 'buildroom' ? -1 : 1))
    .slice(0, 5);
  return `# Focus\n\nGenerated: ${generatedAt}\n\n${focus.map((item, index) => `${index + 1}. **${item.title}** (${item.targetLane}, ${item.priority})\n   - Next: ${item.nextAction}\n   - Evidence: ${item.evidenceStrength} / ${item.verificationStatus}`).join('\n') || 'No focus items.'}\n`;
}

function sourceHost(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'invalid'; }
}

function isPrimarySource(url: string) {
  const host = sourceHost(url);
  return /(^|\.)github\.com$|(^|\.)gitlab\.com$|(^|\.)npmjs\.com$|(^|\.)pypi\.org$|(^|\.)docs\./i.test(host) || /\/docs?\b|\/readme\b/i.test(url);
}

function sourceCategory(url: string) {
  const host = sourceHost(url);
  if (/(^|\.)x\.com$|(^|\.)twitter\.com$/i.test(host)) return 'x';
  if (isPrimarySource(url)) return 'primary';
  return 'external';
}

function extractUrlsFromText(value: unknown) {
  return typeof value === 'string' ? Array.from(value.matchAll(/https?:\/\/[^\s)\]\"'>]+/g)).map((match) => match[0].replace(/[.,;]+$/, '')) : [];
}

function collectUrls(row: Record<string, unknown>) {
  const enrichment = row.enrichment && typeof row.enrichment === 'object' ? row.enrichment as Record<string, unknown> : {};
  const xSearch = enrichment.xSearch && typeof enrichment.xSearch === 'object' ? enrichment.xSearch as Record<string, unknown> : {};
  const status = row.status && typeof row.status === 'object' ? row.status as Record<string, unknown> : {};
  const replyFetch = row.replyFetch && typeof row.replyFetch === 'object' ? row.replyFetch as Record<string, unknown> : {};
  const urls = [
    row.sourceUrl,
    row.statusUrl,
    row.canonicalUrl,
    status.url,
    ...(Array.isArray(row.urls) ? row.urls : []),
    ...(Array.isArray(row.sourceUrls) ? row.sourceUrls : []),
    ...(Array.isArray(row.browserExternalLinks) ? row.browserExternalLinks : []),
    ...(Array.isArray(enrichment.browserExternalLinks) ? enrichment.browserExternalLinks : []),
    ...(Array.isArray(xSearch.citations) ? xSearch.citations : []),
    ...extractUrlsFromText(xSearch.answer),
    ...(Array.isArray(replyFetch.firstReplyLinks) ? replyFetch.firstReplyLinks : []),
  ];
  return Array.from(new Set(urls.map(String).filter((url) => /^https?:\/\//.test(url) && !/pbs\.twimg\.com|video_thumb/i.test(url))));
}

function readRunMerged(root: string, runId: string): { sourceBalance: Record<string, number>; sourceHosts: Record<string, number>; orphanCards: number; staleItems: number } {
  if (!runId || runId === 'manual') return { sourceBalance: {}, sourceHosts: {}, orphanCards: 0, staleItems: 0 };
  const runDir = repoPath(root, '.omx', 'ingestion-runs', runId);
  const candidates = ['merged.json', 'normalized-cards.json', 'raw-cards.json'].map((file) => path.join(runDir, file));
  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
      const rows = Array.isArray(parsed) ? parsed : Array.isArray((parsed as { items?: unknown[] }).items) ? (parsed as { items: unknown[] }).items : Array.isArray((parsed as { cards?: unknown[] }).cards) ? (parsed as { cards: unknown[] }).cards : [];
      const sourceBalance: Record<string, number> = {};
      const sourceHosts: Record<string, number> = {};
      let orphanCards = 0;
      let staleItems = 0;
      for (const row of rows as Array<Record<string, unknown>>) {
        const urls = collectUrls(row);
        if (!urls.length) orphanCards += 1;
        for (const url of urls.slice(0, 4)) {
          const category = sourceCategory(url);
          sourceBalance[category] = (sourceBalance[category] || 0) + 1;
          const host = sourceHost(url);
          sourceHosts[host] = (sourceHosts[host] || 0) + 1;
        }
        if (row.enrichment && typeof row.enrichment === 'object') {
          const enrichment = row.enrichment as Record<string, unknown>;
          if (!enrichment.xSearch || (enrichment.xSearch as Record<string, unknown>).status === 'pending') staleItems += 1;
        }
      }
      return { sourceBalance, sourceHosts, orphanCards, staleItems };
    } catch {
      // Ignore corrupt sidecar and try next candidate.
    }
  }
  return { sourceBalance: {}, sourceHosts: {}, orphanCards: 0, staleItems: 0 };
}

function readRunStatus(root: string, runId: string) {
  const safeRunId = runId.replace(/[^a-zA-Z0-9_.-]/g, '');
  if (!safeRunId) return null;
  try {
    return JSON.parse(fs.readFileSync(repoPath(root, '.omx', 'ingestion-runs', `${safeRunId}.json`), 'utf8')) as ReturnType<typeof readIngestionRun>;
  } catch {
    return readIngestionRun(runId);
  }
}

function healthReport(root: string, payload: ResearchJudgementPayload, items: OperatorItem[], generatedAt: string) {
  const run = payload.runId ? readRunStatus(root, payload.runId) : null;
  const runSignals = readRunMerged(root, payload.runId || 'manual');
  const itemSourceBalance: Record<string, number> = {};
  const itemSourceHosts: Record<string, number> = {};
  for (const url of items.flatMap((item) => item.sourceUrls).filter(Boolean)) {
    const category = sourceCategory(url);
    itemSourceBalance[category] = (itemSourceBalance[category] || 0) + 1;
    const host = sourceHost(url);
    itemSourceHosts[host] = (itemSourceHosts[host] || 0) + 1;
  }
  const weak = items.filter((item) => item.evidenceStrength === 'weak');
  const missingSources = items.filter((item) => !item.sourceUrls.length);
  const missingSourceNote = items.filter((item) => item.sourceNotePath === 'pending');
  const rerouted = items.filter((item) => item.reroutedReason);
  const verificationGaps = [
    ...(run?.verificationGaps || []),
    ...items.filter((item) => item.verificationStatus !== 'verified').map((item) => `${item.title}: ${item.verificationStatus}`),
  ];
  const pending = run?.sidecars?.pending || 0;
  const xSearchOk = run?.sidecars?.xSearchOk || run?.progress?.xSearchEnriched || 0;
  const replyFetchOk = run?.sidecars?.replyFetchOk || 0;
  const replyFetchFailed = run?.sidecars?.replyFetchFailed || 0;
  return {
    runId: payload.runId || 'manual',
    generatedAt,
    sourceBalance: {
      x: (runSignals.sourceBalance.x || 0) + (itemSourceBalance.x || 0),
      primary: (runSignals.sourceBalance.primary || 0) + (itemSourceBalance.primary || 0),
      external: (runSignals.sourceBalance.external || 0) + (itemSourceBalance.external || 0),
    },
    sourceHosts: Object.fromEntries(Object.entries({ ...runSignals.sourceHosts, ...itemSourceHosts }).map(([host, count]) => [host, (runSignals.sourceHosts[host] || 0) + (itemSourceHosts[host] || 0)])),
    staleItems: runSignals.staleItems,
    weakEvidenceItems: weak.length,
    orphanNoSourceCount: missingSources.length + runSignals.orphanCards,
    missingSourceUrlItems: missingSources.length,
    missingSourceNotePathItems: missingSourceNote.length,
    reroutedWeakBuildroomItems: rerouted.length,
    verificationGaps,
    xSearch: { pending, ok: xSearchOk },
    replyFetch: { ok: replyFetchOk, failures: replyFetchFailed },
    replyFetchFailures: replyFetchFailed,
    blockedItems: items.filter((item) => item.blockedReason).length,
    needsAttention: items.filter((item) => item.evidenceStrength === 'weak' || item.sourceNotePath === 'pending' || !item.sourceUrls.length || item.reroutedReason).length,
  };
}

function healthCheck(root: string, payload: ResearchJudgementPayload, items: OperatorItem[], generatedAt: string) {
  const report = healthReport(root, payload, items, generatedAt);
  const rerouted = items.filter((item) => item.reroutedReason);
  return `# Research Health Check\n\nGenerated: ${generatedAt}\nRun: ${payload.runId || 'manual'}\n\n## Source balance\n- X: ${report.sourceBalance.x}\n- Primary: ${report.sourceBalance.primary}\n- External: ${report.sourceBalance.external}\n\n## Source hosts\n${Object.entries(report.sourceHosts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([source, count]) => `- ${source}: ${count}`).join('\n') || '- No source sidecar available.'}\n\n## Quality flags\n- Stale items: ${report.staleItems}\n- Weak evidence items: ${report.weakEvidenceItems}\n- Orphan/no-source count: ${report.orphanNoSourceCount}\n- Missing source URL items: ${report.missingSourceUrlItems}\n- Missing source note path items: ${report.missingSourceNotePathItems}\n- Rerouted weak buildroom items: ${report.reroutedWeakBuildroomItems}\n- Verification gaps: ${report.verificationGaps.length}\n- xSearch pending: ${report.xSearch.pending}\n- xSearch ok: ${report.xSearch.ok}\n- Reply fetch ok: ${report.replyFetch.ok}\n- Reply fetch failures: ${report.replyFetch.failures}\n\n## Verification gaps\n${report.verificationGaps.map((gap) => `- ${gap}`).join('\n') || '- None from run status.'}\n\n## Reroutes\n${rerouted.map((item) => `- ${item.title}: ${item.reroutedReason}`).join('\n') || '- None.'}\n`;
}


function evidenceRank(value: unknown) {
  return value === 'strong' ? 3 : value === 'medium' ? 2 : value === 'weak' ? 1 : 0;
}

function verificationRank(value: unknown) {
  return value === 'verified' ? 4 : value === 'partially_verified' ? 3 : value === 'needs_verification' ? 2 : value === 'unverified' ? 1 : 0;
}

function confidenceRank(value: unknown) {
  return value === 'high' ? 3 : value === 'medium' ? 2 : value === 'low' ? 1 : 0;
}

function strongestEvidence(existing: unknown, next: EvidenceStrength): EvidenceStrength {
  return evidenceRank(existing) >= evidenceRank(next) ? existing as EvidenceStrength : next;
}

function strongestVerification(existing: unknown, next: VerificationStatus): VerificationStatus {
  return verificationRank(existing) >= verificationRank(next) ? existing as VerificationStatus : next;
}

function strongestConfidence(existing: unknown, next: 'low' | 'medium' | 'high'): 'low' | 'medium' | 'high' {
  return confidenceRank(existing) >= confidenceRank(next) ? existing as 'low' | 'medium' | 'high' : next;
}

function confidenceForEvidence(evidence: EvidenceStrength): 'low' | 'medium' | 'high' {
  return evidence === 'strong' ? 'high' : evidence === 'medium' ? 'medium' : 'low';
}

function handoffItem(item: OperatorItem) {
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    runId: item.runId,
    priority: item.priority,
    owner: item.owner,
    statement: item.statement,
    nextAction: item.nextAction,
    sourceUrls: item.sourceUrls,
    sourceNotePath: item.sourceNotePath,
    dependencyUrls: item.dependencyUrls,
    targetLane: item.targetLane,
    originalTargetLane: item.originalTargetLane || null,
    verificationStatus: item.verificationStatus,
    evidenceStrength: item.evidenceStrength,
    claims: item.claims,
    blockedReason: item.blockedReason || null,
    reroutedReason: item.reroutedReason || null,
  };
}

function updateClaims(root: string, items: OperatorItem[], generatedAt: string) {
  const files: string[] = [];
  for (const item of items) {
    for (const statement of item.claims) {
      const normalizedStatement = statement.toLowerCase().replace(/\s+/g, ' ').trim();
      if (!normalizedStatement) continue;
      const claimId = `claim-${stableHash(normalizedStatement)}`;
      const rel = `research-vault/claims/${claimId}.json`;
      const full = repoPath(root, rel);
      let existing: Record<string, unknown> = {};
      try { existing = JSON.parse(fs.readFileSync(full, 'utf8')) as Record<string, unknown>; } catch {}
      const existingSourceCardIds = Array.isArray(existing.sourceCardIds) ? existing.sourceCardIds.map(String) : [];
      const existingRunIds = Array.isArray(existing.runIds) ? existing.runIds.map(String) : [];
      const legacyRunIds = existingSourceCardIds.filter((value) => value === item.runId || /^\d{4}-\d{2}-\d{2}|research-|manual/.test(value));
      const sourceCardIds = Array.from(new Set([...existingSourceCardIds.filter((value) => value && !legacyRunIds.includes(value)), item.sourceNotePath].filter((value) => value && value !== 'pending')));
      const runIds = Array.from(new Set([...existingRunIds, ...legacyRunIds, item.runId].filter(Boolean)));
      const sourceUrls = Array.from(new Set([...(Array.isArray(existing.sourceUrls) ? existing.sourceUrls.map(String) : []), ...item.sourceUrls].filter((url) => /^https?:\/\//.test(url))));
      const dependencyUrls = Array.from(new Set([...(Array.isArray(existing.dependencyUrls) ? existing.dependencyUrls.map(String) : []), ...item.dependencyUrls].filter((url) => /^https?:\/\//.test(url))));
      const originatingItems = Array.from(new Set([...(Array.isArray(existing.originatingItems) ? existing.originatingItems.map(String) : []), item.id]));
      const observedInLanes = Array.from(new Set([...(Array.isArray(existing.observedInLanes) ? existing.observedInLanes.map(String) : []), item.targetLane]));
      const nextConfidence = confidenceForEvidence(item.evidenceStrength);
      const claim = {
        claimId,
        statement,
        sourceCardIds,
        sourceUrls,
        dependencyUrls,
        runIds,
        confidence: strongestConfidence(existing.confidence, nextConfidence),
        firstSeen: typeof existing.firstSeen === 'string' ? existing.firstSeen : generatedAt,
        lastReinforced: generatedAt,
        verificationStatus: strongestVerification(existing.verificationStatus, item.verificationStatus),
        evidenceStrength: strongestEvidence(existing.evidenceStrength, item.evidenceStrength),
        originatingItems,
        observedInLanes,
        owner: item.owner,
        latestPriority: item.priority,
        reinforcementCount: Math.max(Number(existing.reinforcementCount) || 0, originatingItems.length),
        traceability: {
          latestSourceNotePath: item.sourceNotePath,
          latestSourceUrls: item.sourceUrls,
          latestRunId: item.runId,
        },
      };
      files.push(writeJson(root, rel, claim));
    }
  }
  return Array.from(new Set(files));
}


function normalizeClaimVault(root: string, generatedAt: string) {
  const dir = repoPath(root, 'research-vault/claims');
  if (!fs.existsSync(dir)) return [];
  const files: string[] = [];
  for (const file of fs.readdirSync(dir).filter((entry) => entry.endsWith('.json'))) {
    const rel = `research-vault/claims/${file}`;
    const full = repoPath(root, rel);
    let claim: Record<string, unknown>;
    try { claim = JSON.parse(fs.readFileSync(full, 'utf8')) as Record<string, unknown>; } catch { continue; }
    const claimId = typeof claim.claimId === 'string' ? claim.claimId : path.basename(file, '.json');
    const statement = cleanString(claim.statement, 1000) || claimId;
    const rawSourceCardIds = Array.isArray(claim.sourceCardIds) ? claim.sourceCardIds.map(String).filter(Boolean) : [];
    const legacyRunIds = rawSourceCardIds.filter((value) => /^\d{4}-\d{2}-\d{2}|research-|manual/.test(value));
    const sourceCardIds = rawSourceCardIds.filter((value) => !legacyRunIds.includes(value));
    const sourceUrls = Array.isArray(claim.sourceUrls) ? claim.sourceUrls.map(String).filter((url) => /^https?:\/\//.test(url)) : [];
    const dependencyUrls = Array.isArray(claim.dependencyUrls) ? claim.dependencyUrls.map(String).filter((url) => /^https?:\/\//.test(url)) : [];
    const runIds = Array.from(new Set([...(Array.isArray(claim.runIds) ? claim.runIds.map(String).filter(Boolean) : []), ...legacyRunIds]));
    const originatingItems = Array.isArray(claim.originatingItems) ? claim.originatingItems.map(String).filter(Boolean) : [];
    const observedInLanes = Array.isArray(claim.observedInLanes) ? claim.observedInLanes.map(String).filter(Boolean) : [];
    const next = {
      ...claim,
      claimId,
      statement,
      sourceCardIds,
      sourceUrls,
      dependencyUrls,
      runIds,
      confidence: ['low', 'medium', 'high'].includes(String(claim.confidence)) ? claim.confidence : 'low',
      firstSeen: typeof claim.firstSeen === 'string' ? claim.firstSeen : generatedAt,
      lastReinforced: typeof claim.lastReinforced === 'string' ? claim.lastReinforced : generatedAt,
      verificationStatus: normalizeVerificationStatus(claim.verificationStatus),
      evidenceStrength: normalizeEvidenceStrength(claim.evidenceStrength),
      originatingItems,
      observedInLanes,
      owner: normalizeOwner(claim.owner),
      latestPriority: normalizePriority(claim.latestPriority),
      reinforcementCount: Number(claim.reinforcementCount) || Math.max(1, originatingItems.length),
      traceability: claim.traceability && typeof claim.traceability === 'object' ? claim.traceability : {
        latestSourceNotePath: sourceCardIds[0] || 'pending',
        latestSourceUrls: sourceUrls,
        latestRunId: runIds[0] || 'manual',
      },
    };
    files.push(writeJson(root, rel, next));
  }
  return files;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function operatorCockpit(dispatch: Record<string, unknown>, health: ReturnType<typeof healthReport>) {
  const handoffs = dispatch.handoffs as Record<ResearchLane, ReturnType<typeof handoffItem>[]>;
  const lane = (name: ResearchLane) => handoffs[name].map((item) => `<li><strong>${escapeHtml(item.priority)}</strong> ${escapeHtml(item.title)} <span>${escapeHtml(item.evidenceStrength)} / ${escapeHtml(item.verificationStatus)}</span></li>`).join('') || '<li>Empty</li>';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Agent Radar Operator Cockpit</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; color: #172026; background: #f6f4ee; }
    main { max-width: 1120px; margin: 0 auto; padding: 32px 20px; }
    h1, h2 { margin: 0 0 12px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
    section, .metric { background: #fff; border: 1px solid #d8d2c4; border-radius: 8px; padding: 16px; }
    .metric strong { display: block; font-size: 28px; }
    ul { padding-left: 20px; margin: 8px 0 0; }
    li { margin: 8px 0; }
    span { color: #59646b; }
  </style>
</head>
<body>
  <main>
    <h1>Agent Radar Operator Cockpit</h1>
    <p>Run ${escapeHtml(String(dispatch.runId || 'manual'))} · Generated ${escapeHtml(String(dispatch.generatedAt || health.generatedAt))}</p>
    <div class="grid">
      <div class="metric"><span>Weak evidence</span><strong>${health.weakEvidenceItems}</strong></div>
      <div class="metric"><span>Verification gaps</span><strong>${health.verificationGaps.length}</strong></div>
      <div class="metric"><span>xSearch pending</span><strong>${health.xSearch.pending}</strong></div>
      <div class="metric"><span>Needs attention</span><strong>${health.needsAttention}</strong></div>
    </div>
    <div class="grid" style="margin-top: 16px;">
      <section><h2>Buildroom</h2><ul>${lane('buildroom')}</ul></section>
      <section><h2>Verify</h2><ul>${lane('verify')}</ul></section>
      <section><h2>Content</h2><ul>${lane('content')}</ul></section>
      <section><h2>Watch</h2><ul>${lane('watch')}</ul></section>
    </div>
  </main>
</body>
</html>
`;
}

export function generateResearchLayer(payload: ResearchJudgementPayload, options: { root?: string; now?: Date; writtenFiles?: string[] } = {}): ResearchLayerResult {
  if (options.root && options.root !== ROOT) {
    if (process.env.NODE_ENV === 'production') throw new Error('Custom research-layer root is disabled in production builds.');
    const previousCwd = process.cwd();
    process.chdir(options.root);
    try {
      return generateResearchLayer(payload, { ...options, root: ROOT });
    } finally {
      process.chdir(previousCwd);
    }
  }
  const root = ROOT;
  const generatedAt = (options.now || new Date()).toISOString();
  ensureDirs(root);
  const runId = cleanString(payload.runId, 160) || 'manual';
  const items = normalizePayload({ ...payload, runId });
  const groups = laneGroups(items);
  const blocked = items.filter((item) => item.blockedReason).map(handoffItem);
  const needsAttention = items.filter((item) => item.evidenceStrength === 'weak' || item.sourceNotePath === 'pending' || !item.sourceUrls.length || item.reroutedReason).map(handoffItem);
  const dispatch = {
    runId,
    generatedAt,
    handoffs: {
      buildroom: groups.buildroom.map(handoffItem),
      verify: groups.verify.map(handoffItem),
      content: groups.content.map(handoffItem),
      watch: groups.watch.map(handoffItem),
    },
    blocked,
    needsAttention,
    writtenFiles: options.writtenFiles || [],
  };
  const health = healthReport(root, { ...payload, runId }, items, generatedAt);
  const files = [
    writeText(root, 'research-vault/ops/operator-brief.md', operatorBrief({ ...payload, runId }, items, generatedAt)),
    writeText(root, 'research-vault/ops/action-ledger.md', actionLedger(items, generatedAt)),
    writeText(root, 'research-vault/ops/focus.md', focusDoc(items, generatedAt)),
    writeJson(root, 'research-vault/ops/dispatch.json', dispatch),
    writeText(root, 'research-vault/ops/operator-cockpit.html', operatorCockpit(dispatch, health)),
    writeJson(root, 'queue/buildroom-handoff.json', { runId, generatedAt, lane: 'buildroom', items: groups.buildroom.map(handoffItem) }),
    writeJson(root, 'queue/verify-handoff.json', { runId, generatedAt, lane: 'verify', items: groups.verify.map(handoffItem) }),
    writeJson(root, 'queue/content-handoff.json', { runId, generatedAt, lane: 'content', items: groups.content.map(handoffItem) }),
    writeJson(root, 'queue/watch-handoff.json', { runId, generatedAt, lane: 'watch', items: groups.watch.map(handoffItem) }),
    writeText(root, 'research-vault/health/latest-health-check.md', healthCheck(root, { ...payload, runId }, items, generatedAt)),
    writeJson(root, 'research-vault/health/latest-health-check.json', health),
    ...updateClaims(root, items, generatedAt),
    ...normalizeClaimVault(root, generatedAt),
  ];
  return {
    ok: true,
    runId,
    generatedAt,
    files: Array.from(new Set(files)),
    counts: {
      items: items.length,
      buildroom: groups.buildroom.length,
      verify: groups.verify.length,
      content: groups.content.length,
      watch: groups.watch.length,
      blocked: blocked.length,
      needsAttention: needsAttention.length,
    },
  };
}
