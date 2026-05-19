#!/usr/bin/env node
export {};
function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }

const mod = await import(`../src/lib/praxis-learning.ts?quality=${Date.now()}`);
const candidates = mod.rankPraxisLearningCandidates(10, { minScore: 5, includeRecent: true });
assert(candidates.length >= 10, `expected at least 10 quality-gated candidates, got ${candidates.length}`);
for (const candidate of candidates) {
  assert(candidate.score >= 5, `${candidate.id} should score >=5`);
  assert(candidate.sourceUrls.length > 0, `${candidate.id} should have sourceUrls`);
  assert(candidate.reasons.length > 0, `${candidate.id} should expose reason strings`);
  assert(candidate.reasons.some((reason: string) => reason.includes('agent workflow') || reason.includes('artifact') || reason.includes('ecosystem')), `${candidate.id} should explain workflow/artifact relevance`);
}

const topCandidate = candidates[0];
const praxis = mod.findPraxisForLearning(topCandidate.id);
assert(praxis, 'top candidate should resolve to Praxis');
const learnedIds = new Set([topCandidate.id]);
const rescored = mod.scorePraxisForLearning(praxis, learnedIds);
assert(rescored?.penalties.some((penalty: string) => penalty.includes('already learned recently')), 'recent learned penalty should be exposed');
assert(rescored.score === topCandidate.score - 2, 'recent learned penalty should subtract 2');

const learningStatus = mod.praxisLearningStatus();
const hermes = learningStatus.availableAgents.find((agent: { agent: string }) => agent.agent === 'hermes');
const openclaw = learningStatus.availableAgents.find((agent: { agent: string }) => agent.agent === 'openclaw');
assert(hermes?.runtimeAvailable === false && hermes.requiredConfig?.includes('HERMES_LEARNER_COMMAND'), 'Hermes status should expose missing runtime config');
assert(openclaw?.runtimeAvailable === false && openclaw.requiredConfig?.includes('OPENCLAW_LEARNER_COMMAND'), 'OpenClaw status should expose missing runtime config');
assert(learningStatus.guardrails.xSearchEnabledDefault === false, 'x_search should be disabled by default');

process.env.HERMES_LEARNER_COMMAND = 'echo should-not-run';
process.env.HERMES_LEARNER_ALLOW_EXTERNAL_COMMAND = '1';
const configuredStatus = mod.praxisLearningStatus();
const configuredHermes = configuredStatus.availableAgents.find((agent: { agent: string }) => agent.agent === 'hermes');
assert(configuredHermes?.available === false, 'Hermes must not be marked available before real runner implementation is approved');
assert(configuredHermes?.runtimeAvailable === false, 'Hermes runtime must remain blocked even when command env is present but runner is not implemented');
assert(configuredHermes?.blockedReason?.includes('not implemented/approved'), 'Hermes configured-runtime blocker should be explicit');
assert(configuredHermes?.requiredConfig?.includes('REAL_PRAXIS_RUNTIME_RUNNER'), 'Hermes configured-runtime blocker should name missing approved runner');

console.log(JSON.stringify({ ok: true, candidates: candidates.length, top: { id: topCandidate.id, score: topCandidate.score, reasons: topCandidate.reasons }, guardrails: learningStatus.guardrails }, null, 2));
