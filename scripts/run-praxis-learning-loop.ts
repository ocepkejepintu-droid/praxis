#!/usr/bin/env node
import { runPraxisLearningBatch, praxisLearningGuardrails, type PraxisLearnerAgent } from '../src/lib/praxis-learning.ts';

const validAgents = new Set(['hermes', 'openclaw', 'mock-hermes', 'mock-openclaw']);

function argValue(name: string, fallback?: string) {
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1] || fallback;
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : fallback;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function parseAgents(value = 'mock-hermes,mock-openclaw'): PraxisLearnerAgent[] {
  const agents = value.split(',').map((agent) => agent.trim()).filter(Boolean);
  for (const agent of agents) {
    if (!validAgents.has(agent)) throw new Error(`Invalid agent ${agent}. Use hermes, openclaw, mock-hermes, mock-openclaw.`);
  }
  return agents as PraxisLearnerAgent[];
}

function parseFiniteNumber(name: string, fallback: string, options: { integer?: boolean; min?: number } = {}) {
  const raw = argValue(name, fallback) || fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a finite number, got "${raw}".`);
  if (options.integer && !Number.isInteger(parsed)) throw new Error(`${name} must be an integer, got "${raw}".`);
  if (options.min !== undefined && parsed < options.min) throw new Error(`${name} must be >= ${options.min}, got "${raw}".`);
  return parsed;
}

let agents: PraxisLearnerAgent[];
let limit: number;
let minScore: number;
try {
  agents = parseAgents(argValue('--agents'));
  limit = parseFiniteNumber('--limit', '10', { integer: true, min: 1 });
  minScore = parseFiniteNumber('--min-score', String(praxisLearningGuardrails.minScoreDefault));
} catch (error) {
  console.error(JSON.stringify({ ok: false, message: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
}
const safeMode = !process.argv.includes('--unsafe-mode');
const includeRecent = hasFlag('--include-recent');
const includeRealAgents = hasFlag('--include-real') || agents.some((agent) => agent === 'hermes' || agent === 'openclaw');
const reportKind = argValue('--report', 'morning') === 'overnight' ? 'overnight' : 'morning';
const promoteDrafts = hasFlag('--promote-drafts');
const objective = argValue('--objective') || 'Study real-world agent workflows overnight, extract reusable lessons, and draft skills only from evidence-backed Praxis.';

const aggregate = await runPraxisLearningBatch({ agents, limit, minScore, safeMode, includeRealAgents, includeRecent, objective, reportKind, promoteDrafts, writeAggregate: true });

console.log(JSON.stringify({
  ok: true,
  runId: aggregate.id,
  reportKind: aggregate.reportKind,
  agentsUsed: aggregate.agentsUsed,
  selectedPraxisCount: aggregate.selectedPraxisCount,
  praxisLearnedCount: aggregate.praxisLearnedCount,
  reportsCreated: aggregate.reportsCreated,
  counts: aggregate.counts,
  selectionNote: aggregate.selectionNote,
  topLearnedPatterns: aggregate.topLearnedPatterns.slice(0, 5),
  repeatedBlockers: aggregate.repeatedBlockers.slice(0, 5),
  bestNextActions: aggregate.bestNextActions.slice(0, 5),
  promotedSkillDrafts: aggregate.promotedSkillDrafts.map((draft) => draft.path),
  sourceUrls: aggregate.sourceUrls.slice(0, 10),
  artifactsChanged: aggregate.artifactsChanged,
  realRuntimeBlockers: aggregate.realRuntimeBlockers,
  guardrails: aggregate.guardrails,
}, null, 2));
