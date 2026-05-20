import fs from 'node:fs';
import path from 'node:path';
import { getDashboardData } from './markdown.ts';
import { getOperatingSlice, type ExperimentCard } from './os.ts';
import { hermesRuntimeStatus } from '../../packages/runtime/contracts/hermes-contract.ts';
import { openClawRuntimeStatus } from '../../packages/runtime/contracts/omx-contract.ts';

export type PraxisLearnerAgent = 'hermes' | 'openclaw' | 'mock-hermes' | 'mock-openclaw';

export type PraxisLearningTask = {
  praxisId: string;
  agent: PraxisLearnerAgent;
  objective?: string;
  safeMode?: boolean;
};

export type PraxisLearningReport = {
  id: string;
  createdAt: string;
  praxisId: string;
  praxisTitle: string;
  agent: PraxisLearnerAgent;
  status: 'completed' | 'blocked' | 'failed';
  learned: string[];
  artifacts: string[];
  commands?: string[];
  blockers?: string[];
  nextActions?: string[];
  sourceUrls: string[];
};

export type PraxisLearnerStatus = {
  agent: PraxisLearnerAgent;
  available: boolean;
  runtimeAvailable: boolean;
  mode: 'mock' | 'read-only' | 'external';
  safeMode: boolean;
  blockedReason?: string;
  requiredConfig?: string[];
  detectedCommand?: string;
};

export type PraxisLearningCandidate = {
  id: string;
  title: string;
  score: number;
  reasons: string[];
  penalties: string[];
  sourceUrls: string[];
  source: string;
  recentlyLearned: boolean;
};

export type PraxisLearningBatchOptions = {
  agents: PraxisLearnerAgent[];
  limit: number;
  minScore?: number;
  safeMode?: boolean;
  includeRealAgents?: boolean;
  includeRecent?: boolean;
  objective?: string;
  reportKind?: 'morning' | 'overnight';
  promoteDrafts?: boolean;
  writeAggregate?: boolean;
  storage?: PraxisLearningStorageScope;
};

export type PraxisLearningStorageScope = {
  opsDir: string;
  acpLogPath?: string;
};

export type PraxisSkillDraft = {
  slug: string;
  title: string;
  path: string;
  praxisId: string;
  agent: PraxisLearnerAgent;
  sourceUrls: string[];
};

export type PraxisLearningAggregateReport = {
  id: string;
  createdAt: string;
  reportKind: 'morning' | 'overnight';
  agentsUsed: PraxisLearnerAgent[];
  selectedPraxisCount: number;
  praxisLearnedCount: number;
  reportsCreated: number;
  counts: { completed: number; blocked: number; failed: number };
  candidates: PraxisLearningCandidate[];
  topLearnedPatterns: string[];
  repeatedBlockers: string[];
  bestNextActions: string[];
  promotedSkillDrafts: PraxisSkillDraft[];
  sourceUrls: string[];
  artifactsChanged: string[];
  reportIds: string[];
  realRuntimeBlockers: Record<string, string>;
  selectionNote: string;
  guardrails: typeof praxisLearningGuardrails;
};

export const praxisLearningGuardrails = {
  maxPraxisPerRun: 20,
  maxAgentsPerRun: 4,
  minScoreDefault: 5,
  xSearchEnabledDefault: false,
  skipRecentLearnedDefault: true,
  recentLearningWindowDays: 7,
  runtimeTimeoutMs: 30_000,
  safeModeDefault: true,
  destructiveCommandsAllowed: false,
};

const OPS_DIR = path.join(process.cwd(), 'research-vault', 'ops');
const REPORT_PATH = path.join(OPS_DIR, 'praxis-learning-reports.json');
const OVERNIGHT_JSON_PATH = path.join(OPS_DIR, 'praxis-learning-overnight-report.json');
const OVERNIGHT_MD_PATH = path.join(OPS_DIR, 'praxis-learning-overnight-report.md');
const MORNING_JSON_PATH = path.join(OPS_DIR, 'praxis-learning-morning-report.json');
const MORNING_MD_PATH = path.join(OPS_DIR, 'praxis-learning-morning-report.md');
const SKILL_DRAFT_DIR = path.join(OPS_DIR, 'skill-drafts');
const ACP_LOG = path.join(process.cwd(), '.radar', 'acp-log.jsonl');

const WORKFLOW_RE = /workflow|automation|coding agent|multi-agent|agentic|browser|runtime|eval|benchmark|course|memory|self[- ]?evol|orchestrat|tool use/i;
const ARTIFACT_TEXT_RE = /repo|github|docs|demo|product|benchmark|course|readme|package|mcp server|adapter/i;
const ECOSYSTEM_RE = /hermes|openclaw|claude code|claude|mcp|codex|browser use|langgraph|crewai|devin|swe-agent|openai|anthropic/i;
const CREDIBLE_SOURCE_RE = /x\.com|twitter\.com|github\.com|hermesatlas\.com|docs\.|arxiv|paper|benchmark|official/i;
const VAGUE_RE = /meme|motivation|inspiration|news only|no workflow|no artifact|generic|may be useful as|define the smallest/i;

function nowIso() {
  return new Date().toISOString();
}

function stableId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function compact(value: string, max = 260) {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trim()}…` : clean;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 72) || 'praxis-skill';
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function opsDir(storage?: PraxisLearningStorageScope) {
  return storage?.opsDir || OPS_DIR;
}

function reportPath(storage?: PraxisLearningStorageScope) {
  return path.join(opsDir(storage), 'praxis-learning-reports.json');
}

function overnightJsonPath(storage?: PraxisLearningStorageScope) {
  return path.join(opsDir(storage), 'praxis-learning-overnight-report.json');
}

function overnightMarkdownPath(storage?: PraxisLearningStorageScope) {
  return path.join(opsDir(storage), 'praxis-learning-overnight-report.md');
}

function morningJsonPath(storage?: PraxisLearningStorageScope) {
  return path.join(opsDir(storage), 'praxis-learning-morning-report.json');
}

function morningMarkdownPath(storage?: PraxisLearningStorageScope) {
  return path.join(opsDir(storage), 'praxis-learning-morning-report.md');
}

function skillDraftDir(storage?: PraxisLearningStorageScope) {
  return path.join(opsDir(storage), 'skill-drafts');
}

function acpLogPath(storage?: PraxisLearningStorageScope) {
  return storage?.acpLogPath || ACP_LOG;
}

function readJsonArray<T>(file: string): T[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function readReportsRaw(storage?: PraxisLearningStorageScope): PraxisLearningReport[] {
  return readJsonArray<PraxisLearningReport>(reportPath(storage));
}

function writeReports(reports: PraxisLearningReport[], storage?: PraxisLearningStorageScope) {
  const file = reportPath(storage);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(reports, null, 2)}\n`);
}

function appendPraxisLearningEvent(report: PraxisLearningReport, storage?: PraxisLearningStorageScope) {
  const file = acpLogPath(storage);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const event = {
    id: `acp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: nowIso(),
    from: agentName(report.agent),
    to: 'radar',
    type: 'praxis_result',
    payload: { reportId: report.id, praxisId: report.praxisId, status: report.status, learned: report.learned, blockers: report.blockers, nextActions: report.nextActions },
    sourceSlugs: [report.praxisId],
    sourceUrls: report.sourceUrls,
  };
  fs.appendFileSync(file, `${JSON.stringify(event)}\n`);
}

export function listPraxisLearningReports(limit = 30, storage?: PraxisLearningStorageScope) {
  return readReportsRaw(storage).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

function readAggregate(file: string): PraxisLearningAggregateReport | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as PraxisLearningAggregateReport;
  } catch {
    return null;
  }
}

export function getLatestPraxisLearningAggregate(): PraxisLearningAggregateReport | null {
  return getLatestPraxisLearningMorningReport() || readAggregate(OVERNIGHT_JSON_PATH);
}

export function getLatestPraxisLearningAggregateForStorage(storage?: PraxisLearningStorageScope): PraxisLearningAggregateReport | null {
  return getLatestPraxisLearningMorningReport(storage) || readAggregate(overnightJsonPath(storage));
}

export function getLatestPraxisLearningMorningReport(storage?: PraxisLearningStorageScope): PraxisLearningAggregateReport | null {
  return readAggregate(morningJsonPath(storage));
}

function allPraxies() {
  const os = getOperatingSlice(getDashboardData());
  return os.experiments;
}

export function findPraxisForLearning(praxisId: string): ExperimentCard | null {
  const id = praxisId.trim();
  if (!id) return null;
  return allPraxies().find((praxis) => praxis.id === id || praxis.title.toLowerCase() === id.toLowerCase()) || null;
}

function agentName(agent: PraxisLearnerAgent) {
  return agent.includes('openclaw') ? 'OpenClaw' : 'Hermes';
}

function runtimeEnv(agent: 'hermes' | 'openclaw') {
  return agent === 'hermes'
    ? { command: 'HERMES_LEARNER_COMMAND', allow: 'HERMES_LEARNER_ALLOW_EXTERNAL_COMMAND' }
    : { command: 'OPENCLAW_LEARNER_COMMAND', allow: 'OPENCLAW_LEARNER_ALLOW_EXTERNAL_COMMAND' };
}

function realAgentStatus(agent: 'hermes' | 'openclaw'): PraxisLearnerStatus {
  const contractStatus = agent === 'hermes' ? hermesRuntimeStatus() : openClawRuntimeStatus();
  const env = runtimeEnv(agent);
  const detectedCommand = process.env[env.command]?.trim();
  const safeRunnerAllowed = process.env[env.allow] === '1';
  const runnerImplemented = false;
  const runtimeAvailable = Boolean(contractStatus.readOnlyAvailable || (detectedCommand && safeRunnerAllowed && runnerImplemented));
  const blockedReason = contractStatus.readOnlyAvailable
    ? `${contractStatus.label}. Permissioned/autonomous execution is not implemented; no external command was executed.`
    : !detectedCommand
      ? `${env.command} is not configured. ${contractStatus.blockers[0]?.message || `Use mock-${agent} for local safe learning or configure an approved runtime bridge.`}`
      : !safeRunnerAllowed
        ? `${env.command} is configured (${detectedCommand}), but ${env.allow}=1 is not set. Real runtime execution remains blocked to avoid uncontrolled external actions.`
        : `${env.command} and ${env.allow}=1 are configured, but real Praxis runtime execution is not implemented/approved in this repo yet. No external command was executed.`;
  return {
    agent,
    available: false,
    runtimeAvailable,
    mode: contractStatus.readOnlyAvailable ? 'read-only' : 'external',
    safeMode: true,
    detectedCommand,
    blockedReason,
    requiredConfig: contractStatus.readOnlyAvailable ? [] : (contractStatus.requiredConfig.length ? contractStatus.requiredConfig : detectedCommand ? [env.allow, 'REAL_PRAXIS_RUNTIME_RUNNER'] : [env.command]),
  };
}

function fallbackSourceUrl(praxis: ExperimentCard) {
  if (praxis.sourceUrls.length) return praxis.sourceUrls;
  if (praxis.sourceNoteHref?.startsWith('http')) return [praxis.sourceNoteHref];
  return [];
}

function praxisText(praxis: ExperimentCard) {
  return [praxis.id, praxis.title, praxis.source, praxis.hypothesis, praxis.firstTest, praxis.successSignal, praxis.executionSteps.join(' ')].join(' ');
}

function recentLearnedPraxisIds(reports = readReportsRaw(), windowDays = praxisLearningGuardrails.recentLearningWindowDays) {
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  return new Set(reports
    .filter((report) => report.status === 'completed' && Date.parse(report.createdAt) >= cutoff)
    .map((report) => report.praxisId));
}

export function scorePraxisForLearning(praxis: ExperimentCard, learnedIds = recentLearnedPraxisIds()): PraxisLearningCandidate | null {
  const text = praxisText(praxis);
  const sourceUrls = fallbackSourceUrl(praxis);
  const reasons: string[] = [];
  const penalties: string[] = [];
  let score = 0;

  if (WORKFLOW_RE.test(text)) { score += 3; reasons.push('+3 concrete agent workflow/use case'); }
  if (ARTIFACT_TEXT_RE.test(text) || sourceUrls.some((url) => /github\.com|docs\.|hermesatlas\.com/i.test(url))) { score += 2; reasons.push('+2 concrete artifact'); }
  if (ECOSYSTEM_RE.test(text)) { score += 2; reasons.push('+2 agent ecosystem relevance'); }
  if (sourceUrls.some((url) => CREDIBLE_SOURCE_RE.test(url))) { score += 1; reasons.push('+1 credible source/social proof'); }
  if (VAGUE_RE.test(text) || !sourceUrls.length || !praxis.executionSteps.length) { score -= 3; penalties.push('-3 vague/no workflow/no artifact'); }
  const recentlyLearned = learnedIds.has(praxis.id);
  if (recentlyLearned) { score -= 2; penalties.push('-2 already learned recently'); }

  if (!sourceUrls.length) return null;
  return { id: praxis.id, title: praxis.title, score, reasons, penalties, sourceUrls, source: praxis.source, recentlyLearned };
}

export function rankPraxisLearningCandidates(limit = 10, options: { minScore?: number; includeRecent?: boolean } = {}): PraxisLearningCandidate[] {
  const minScore = options.minScore ?? praxisLearningGuardrails.minScoreDefault;
  return allPraxies()
    .map((praxis) => scorePraxisForLearning(praxis))
    .filter((candidate): candidate is PraxisLearningCandidate => Boolean(candidate))
    .filter((candidate) => candidate.score >= minScore)
    .filter((candidate) => options.includeRecent === true || !candidate.recentlyLearned)
    .sort((a, b) => b.score - a.score || b.sourceUrls.length - a.sourceUrls.length || a.title.localeCompare(b.title))
    .slice(0, limit);
}

function statusAgentRows(): PraxisLearnerStatus[] {
  return [
    { agent: 'mock-hermes', available: true, runtimeAvailable: true, mode: 'mock', safeMode: true },
    { agent: 'mock-openclaw', available: true, runtimeAvailable: true, mode: 'mock', safeMode: true },
    realAgentStatus('hermes'),
    realAgentStatus('openclaw'),
  ];
}

export function praxisLearningStatus(storage?: PraxisLearningStorageScope) {
  const aggregate = getLatestPraxisLearningAggregateForStorage(storage);
  const morning = getLatestPraxisLearningMorningReport(storage);
  return {
    ok: true,
    reportPath: path.relative(process.cwd(), reportPath(storage)),
    aggregatePath: path.relative(process.cwd(), overnightJsonPath(storage)),
    morningReportPath: path.relative(process.cwd(), morningJsonPath(storage)),
    skillDraftDir: path.relative(process.cwd(), skillDraftDir(storage)),
    guardrails: praxisLearningGuardrails,
    availableAgents: statusAgentRows(),
    candidates: rankPraxisLearningCandidates(10).map((praxis) => ({ id: praxis.id, title: praxis.title, score: praxis.score, reasons: praxis.reasons, penalties: praxis.penalties, sourceUrls: praxis.sourceUrls })),
    recentReports: listPraxisLearningReports(8, storage),
    latestAggregate: aggregate ? summarizeAggregate(aggregate) : null,
    latestMorningReport: morning ? summarizeAggregate(morning) : null,
  };
}

function summarizeAggregate(aggregate: PraxisLearningAggregateReport) {
  const completed = aggregate.counts?.completed ?? aggregate.reportsCreated ?? 0;
  return {
    id: aggregate.id,
    createdAt: aggregate.createdAt,
    reportKind: aggregate.reportKind || 'overnight',
    agentsUsed: aggregate.agentsUsed || [],
    selectedPraxisCount: aggregate.selectedPraxisCount ?? aggregate.praxisLearnedCount ?? 0,
    praxisLearnedCount: aggregate.praxisLearnedCount ?? 0,
    counts: aggregate.counts || { completed, blocked: 0, failed: 0 },
    topLearnedPatterns: (aggregate.topLearnedPatterns || []).slice(0, 5),
    repeatedBlockers: (aggregate.repeatedBlockers || []).slice(0, 5),
    bestNextActions: (aggregate.bestNextActions || []).slice(0, 5),
    promotedSkillDrafts: (aggregate.promotedSkillDrafts || []).slice(0, 5),
  };
}

function mockLearningReport(task: PraxisLearningTask, praxis: ExperimentCard): PraxisLearningReport {
  const name = agentName(task.agent);
  const sourceUrls = fallbackSourceUrl(praxis);
  const hasSources = sourceUrls.length > 0;
  const hasSteps = praxis.executionSteps.length > 0;
  const learned = [
    `${name} read Praxis: ${compact(praxis.title, 180)}`,
    ...(task.objective ? [`${name} followed the batch objective: ${compact(task.objective, 220)}`] : []),
    `${name} learned the reusable workflow: ${compact(praxis.hypothesis || praxis.title, 220)}`,
    `${name} identified the smallest safe first test: ${compact(praxis.firstTest, 220)}`,
    `${name} mapped the execution path: ${compact(praxis.executionSteps.join(' → ') || 'No execution steps supplied yet.', 260)}`,
    `${name} mapped the verification/stop rule: ${compact(praxis.killCriteria || praxis.successSignal, 220)}`,
  ];
  if (hasSources) learned.push(`${name} found ${sourceUrls.length} evidence URL(s) to verify before skill adoption.`);
  const blockers = [
    ...(!hasSources ? ['No source URL attached to this Praxis; agent must ask for evidence before running anything.'] : []),
    ...(!hasSteps ? ['No execution steps found; human should add a minimal test path.'] : []),
  ];
  const nextActions = [
    praxis.executionSteps[0] || praxis.firstTest || 'Open the Praxis source and define the smallest safe smoke test.',
    'Convert this pattern into a skill draft only after source evidence and verification stay strong.',
  ];
  const artifacts = [
    `praxis:${praxis.id}`,
    praxis.sourcePath ? `source-path:${praxis.sourcePath}` : 'source-path:missing',
    `safe-mode:${task.safeMode !== false}`,
  ];
  return {
    id: stableId('praxis-learning'),
    createdAt: nowIso(),
    praxisId: praxis.id,
    praxisTitle: praxis.title,
    agent: task.agent,
    status: 'completed',
    learned,
    artifacts,
    commands: [`POST /api/acp/praxis-learning/run { praxisId: "${praxis.id}", agent: "${task.agent}", safeMode: true }`],
    blockers: blockers.length ? blockers : undefined,
    nextActions,
    sourceUrls,
  };
}

function blockedRealReport(task: PraxisLearningTask, praxis: ExperimentCard): PraxisLearningReport {
  const status = realAgentStatus(task.agent as 'hermes' | 'openclaw');
  const name = agentName(task.agent);
  return {
    id: stableId('praxis-learning'),
    createdAt: nowIso(),
    praxisId: praxis.id,
    praxisTitle: praxis.title,
    agent: task.agent,
    status: 'blocked',
    learned: [`${name} did not execute a real runtime. No learning was hallucinated.`],
    artifacts: [`praxis:${praxis.id}`, 'runtime:not-executed'],
    blockers: [status.blockedReason || 'Real runtime unavailable.'],
    nextActions: [`Use mock-${task.agent} for local safe learning, or configure ${status.requiredConfig?.join(', ')} with an approved runner.`],
    sourceUrls: fallbackSourceUrl(praxis),
  };
}

function persistReport(report: PraxisLearningReport, storage?: PraxisLearningStorageScope) {
  writeReports([...readReportsRaw(storage), report], storage);
  appendPraxisLearningEvent(report, storage);
  return report;
}

export async function runPraxisLearningTask(task: PraxisLearningTask, storage?: PraxisLearningStorageScope): Promise<PraxisLearningReport> {
  const praxis = findPraxisForLearning(task.praxisId);
  if (!praxis) {
    const report: PraxisLearningReport = {
      id: stableId('praxis-learning'),
      createdAt: nowIso(),
      praxisId: task.praxisId,
      praxisTitle: 'Unknown Praxis',
      agent: task.agent,
      status: 'failed',
      learned: ['No Praxis was loaded, so no agent learning occurred.'],
      artifacts: ['praxis:not-found'],
      blockers: [`Praxis ${task.praxisId} was not found in current Praxis map.`],
      nextActions: ['Call GET /api/acp/praxis-learning/status and choose a listed candidate id.'],
      sourceUrls: [],
    };
    return persistReport(report, storage);
  }
  if (task.agent === 'mock-hermes' || task.agent === 'mock-openclaw') return persistReport(mockLearningReport(task, praxis), storage);
  return persistReport(blockedRealReport(task, praxis), storage);
}

function topRepeated(values: string[], limit: number) {
  const counts = new Map<string, number>();
  for (const value of values.map((item) => compact(item, 180)).filter(Boolean)) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value, count]) => count > 1 ? `${value} (${count}x)` : value);
}

function draftContent(report: PraxisLearningReport) {
  const trigger = `Use when an agent sees a workflow similar to "${report.praxisTitle}" and needs a safe, evidence-first execution path.`;
  return `---\nname: ${slugify(report.praxisTitle)}\ndescription: Draft skill from Agent Praxis learning report ${report.id}\n---\n\n# ${report.praxisTitle}\n\n## Trigger\n${trigger}\n\n## Workflow steps\n${(report.nextActions || ['Open source evidence.', 'Run smallest safe test.', 'Write result back to Praxis.']).map((item, index) => `${index + 1}. ${item}`).join('\n')}\n\n## Learned pattern\n${report.learned.map((item) => `- ${item}`).join('\n')}\n\n## Commands / artifacts\n${(report.commands || report.artifacts).map((item) => `- ${item}`).join('\n')}\n\n## Pitfalls / blockers\n${(report.blockers?.length ? report.blockers : ['Do not adopt without source evidence and a passing verification step.']).map((item) => `- ${item}`).join('\n')}\n\n## Verification\n- Confirm source URLs still resolve.\n- Re-run the smallest safe test before adopting.\n- Record evidence back into Praxis Learning.\n\n## Source URLs\n${report.sourceUrls.map((url) => `- ${url}`).join('\n')}\n`;
}

function promoteSkillDrafts(reports: PraxisLearningReport[], limit = 5, storage?: PraxisLearningStorageScope): PraxisSkillDraft[] {
  const drafts: PraxisSkillDraft[] = [];
  const completed = reports.filter((report) => report.status === 'completed' && report.sourceUrls.length > 0);
  for (const report of completed.slice(0, limit)) {
    const slug = `${slugify(report.praxisTitle)}-${report.agent}`;
    const dir = path.join(skillDraftDir(storage), slug);
    const file = path.join(dir, 'SKILL.md');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, draftContent(report));
    drafts.push({ slug, title: report.praxisTitle, path: path.relative(process.cwd(), file), praxisId: report.praxisId, agent: report.agent, sourceUrls: report.sourceUrls });
  }
  return drafts;
}

function aggregatePathsForStorage(reportKind: 'morning' | 'overnight', storage?: PraxisLearningStorageScope) {
  return reportKind === 'morning'
    ? { json: morningJsonPath(storage), markdown: morningMarkdownPath(storage) }
    : { json: overnightJsonPath(storage), markdown: overnightMarkdownPath(storage) };
}

function writeAggregateMarkdown(report: PraxisLearningAggregateReport, markdownPath: string) {
  const lines = [
    `# Praxis Learning ${report.reportKind === 'morning' ? 'Morning' : 'Overnight'} Report`,
    '',
    `Run: ${report.id}`,
    `Created: ${report.createdAt}`,
    `Agents: ${report.agentsUsed.join(', ')}`,
    `Selected Praxis: ${report.selectedPraxisCount}`,
    `Praxis learned: ${report.praxisLearnedCount}`,
    `Reports: ${report.reportsCreated} (${report.counts.completed} completed, ${report.counts.blocked} blocked, ${report.counts.failed} failed)`,
    report.selectionNote,
    '',
    '## CEO short',
    `Agents studied ${report.selectedPraxisCount} source-backed Praxis entries and produced ${report.counts.completed} completed local learning reports. Real runtime lanes stayed blocked unless configured, so no fake execution was recorded.`,
    '',
    '## Top learned patterns',
    ...report.topLearnedPatterns.map((item) => `- ${item}`),
    '',
    '## Best next actions today',
    ...report.bestNextActions.map((item) => `- ${item}`),
    '',
    '## Repeated blockers',
    ...(report.repeatedBlockers.length ? report.repeatedBlockers.map((item) => `- ${item}`) : ['- None recorded.']),
    '',
    '## Promoted skill drafts',
    ...(report.promotedSkillDrafts.length ? report.promotedSkillDrafts.map((draft) => `- ${draft.path}`) : ['- None created.']),
    '',
    '## Source evidence',
    ...report.sourceUrls.slice(0, 60).map((url) => `- ${url}`),
    '',
    '## Artifacts changed',
    ...report.artifactsChanged.map((item) => `- ${item}`),
    '',
    '## Real runtime blockers',
    ...Object.entries(report.realRuntimeBlockers).map(([agent, blocker]) => `- ${agent}: ${blocker}`),
    '',
  ];
  fs.writeFileSync(markdownPath, `${lines.join('\n')}\n`);
}

export async function runPraxisLearningBatch(options: PraxisLearningBatchOptions): Promise<PraxisLearningAggregateReport> {
  const storage = options.storage;
  const agents = unique(options.agents).filter((agent) => ['hermes', 'openclaw', 'mock-hermes', 'mock-openclaw'].includes(agent));
  const limit = Math.max(1, Math.min(praxisLearningGuardrails.maxPraxisPerRun, options.limit || 5));
  const minScore = options.minScore ?? praxisLearningGuardrails.minScoreDefault;
  const includeRealAgents = options.includeRealAgents === true || agents.some((agent) => agent === 'hermes' || agent === 'openclaw');
  const reportKind = options.reportKind || 'morning';
  const candidates = rankPraxisLearningCandidates(limit, { minScore, includeRecent: options.includeRecent });
  const runAgents: PraxisLearnerAgent[] = (includeRealAgents ? agents : agents.filter((agent) => agent.startsWith('mock-'))).slice(0, praxisLearningGuardrails.maxAgentsPerRun);
  if (!runAgents.length) throw new Error('No learner agents selected.');
  if (!candidates.length) throw new Error(`No source-backed Praxis candidates passed min score ${minScore}.`);

  const reports: PraxisLearningReport[] = [];
  for (const candidate of candidates) {
    for (const agent of runAgents) {
      reports.push(await runPraxisLearningTask({ praxisId: candidate.id, agent, objective: options.objective, safeMode: options.safeMode !== false }, storage));
    }
  }

  const counts = {
    completed: reports.filter((report) => report.status === 'completed').length,
    blocked: reports.filter((report) => report.status === 'blocked').length,
    failed: reports.filter((report) => report.status === 'failed').length,
  };
  const completedReports = reports.filter((report) => report.status === 'completed');
  const blockers = reports.flatMap((report) => report.blockers || []);
  const nextActions = reports
    .flatMap((report) => report.nextActions || [])
    .filter((item) => !/follow-up learning report after evidence improves|convert this pattern/i.test(item));
  const learned = completedReports.flatMap((report) => report.learned.filter((item) => !item.includes('read Praxis:') && !item.includes('followed the batch objective:')));
  const realRuntimeBlockers: Record<string, string> = {};
  for (const report of reports.filter((item) => item.status === 'blocked' && (item.agent === 'hermes' || item.agent === 'openclaw'))) {
    realRuntimeBlockers[report.agent] = report.blockers?.[0] || 'Real runtime blocked.';
  }
  const promotedSkillDrafts = options.promoteDrafts ? promoteSkillDrafts(completedReports, 5, storage) : [];
  const paths = aggregatePathsForStorage(reportKind, storage);
  const artifactsChanged = unique([
    path.relative(process.cwd(), reportPath(storage)),
    path.relative(process.cwd(), paths.json),
    path.relative(process.cwd(), paths.markdown),
    ...(reportKind === 'morning' ? [path.relative(process.cwd(), overnightJsonPath(storage)), path.relative(process.cwd(), overnightMarkdownPath(storage))] : []),
    ...(promotedSkillDrafts.length ? promotedSkillDrafts.map((draft) => draft.path) : []),
    path.relative(process.cwd(), acpLogPath(storage)),
  ]);
  const selectionNote = candidates.length < limit
    ? `Selected ${candidates.length}/${limit}; fewer source-backed candidates passed min score ${minScore}.`
    : `Selected top ${candidates.length} candidates with min score ${minScore}.`;

  const aggregate: PraxisLearningAggregateReport = {
    id: stableId(`praxis-learning-${reportKind}`),
    createdAt: nowIso(),
    reportKind,
    agentsUsed: runAgents,
    selectedPraxisCount: candidates.length,
    praxisLearnedCount: new Set(completedReports.map((report) => report.praxisId)).size,
    reportsCreated: reports.length,
    counts,
    candidates,
    topLearnedPatterns: topRepeated(learned, 10),
    repeatedBlockers: topRepeated(blockers, 10),
    bestNextActions: topRepeated(nextActions, 10),
    promotedSkillDrafts,
    sourceUrls: unique(reports.flatMap((report) => report.sourceUrls)).slice(0, 100),
    artifactsChanged,
    reportIds: reports.map((report) => report.id),
    realRuntimeBlockers,
    selectionNote,
    guardrails: praxisLearningGuardrails,
  };

  if (options.writeAggregate !== false) {
    fs.mkdirSync(opsDir(storage), { recursive: true });
    fs.writeFileSync(paths.json, `${JSON.stringify(aggregate, null, 2)}\n`);
    writeAggregateMarkdown(aggregate, paths.markdown);
    if (reportKind === 'morning') {
      fs.writeFileSync(overnightJsonPath(storage), `${JSON.stringify(aggregate, null, 2)}\n`);
      writeAggregateMarkdown(aggregate, overnightMarkdownPath(storage));
    }
  }
  return aggregate;
}

export function praxisLearningPathsForStorage(storage?: PraxisLearningStorageScope) {
  return {
    reports: path.relative(process.cwd(), reportPath(storage)),
    overnightJson: path.relative(process.cwd(), overnightJsonPath(storage)),
    overnightMarkdown: path.relative(process.cwd(), overnightMarkdownPath(storage)),
    morningJson: path.relative(process.cwd(), morningJsonPath(storage)),
    morningMarkdown: path.relative(process.cwd(), morningMarkdownPath(storage)),
    skillDraftDir: path.relative(process.cwd(), skillDraftDir(storage)),
  };
}

export const praxisLearningPaths = praxisLearningPathsForStorage();
