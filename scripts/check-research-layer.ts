import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateResearchLayer, type ResearchJudgementPayload } from '../src/lib/research-layer.ts';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-radar-research-'));
const now = new Date('2026-05-17T15:30:00.000Z');
const runDir = path.join(root, '.omx/ingestion-runs/research-operator-regression');
fs.mkdirSync(runDir, { recursive: true });
fs.writeFileSync(path.join(root, '.omx/ingestion-runs/research-operator-regression.json'), JSON.stringify({
  id: 'research-operator-regression',
  startedAt: '2026-05-17T15:00:00.000Z',
  verificationGaps: ['One promoted item still needs primary source confirmation.'],
  progress: { xSearchEnriched: 1 },
  sidecars: { pending: 2, xSearchOk: 1, replyFetchOk: 1, replyFetchFailed: 1 },
}, null, 2));
fs.writeFileSync(path.join(runDir, 'merged.json'), JSON.stringify({
  items: [
    {
      statusUrl: 'https://x.com/research/status/2055704951062700434',
      sourceCard: 'Inbox/weak.md',
      enrichment: { browserExternalLinks: ['https://github.com/example/adapter'], xSearch: { status: 'pending' } },
      replyFetch: { firstReplyLinks: ['https://docs.example.com/adapter'] },
    },
    { sourceCard: 'Inbox/orphan.md', enrichment: { xSearch: { status: 'pending' } } },
  ],
}, null, 2));
const payload: ResearchJudgementPayload = {
  runId: 'research-operator-regression',
  summary: 'Regression payload for Research Operator Layer.',
  ideas: [
    {
      title: 'Weak buildroom idea must verify first',
      thesis: 'A single community post claims a new adapter can improve agent learning throughput.',
      whyNow: 'The signal is fresh but unverified.',
      nextMove: 'Verify primary repository and run one minimal reproduction.',
      sourceUrls: ['https://x.com/research/status/2055704951062700434'],
      sourceNotePath: 'Inbox/2026-05-17 weak-buildroom.md',
      dependencyUrls: ['https://github.com/example/adapter'],
      targetLane: 'buildroom',
      priority: 'high',
      owner: 'Hermes',
      verificationStatus: 'needs_verification',
      evidenceStrength: 'weak',
      claims: ['A new adapter can improve agent learning throughput.'],
    },
  ],
  experiments: [
    {
      title: 'Medium evidence adapter smoke test',
      hypothesis: 'If the adapter has docs and a repo, an agent can run a one-hour smoke test.',
      firstTest: 'Run the documented quickstart and record failure points.',
      successSignal: 'Quickstart completes and produces one learning report.',
      sourceUrls: ['https://hermesatlas.com/projects/example/adapter'],
      sourceNotePath: 'Repos/2026-05-17 example-adapter.md',
      dependencyUrls: ['https://github.com/example/adapter'],
      targetLane: 'buildroom',
      priority: 'medium',
      owner: 'OMX',
      verificationStatus: 'partially_verified',
      evidenceStrength: 'medium',
      claims: ['The adapter has enough documentation for a one-hour smoke test.'],
    },
  ],
  actions: [
    {
      text: 'Draft an operator note for the adapter signal.',
      reason: 'The signal is useful as content even before implementation.',
      sourceUrls: ['https://hermesatlas.com/'],
      sourceNotePath: 'Repos/2026-05-17 example-adapter.md',
      targetLane: 'content',
      priority: 'low',
      owner: 'Yoseph',
      verificationStatus: 'partially_verified',
      evidenceStrength: 'medium',
      claims: ['The adapter signal is useful for operator-facing content.'],
    },
    {
      text: 'Watch the unverified social-only adapter claim.',
      reason: 'No primary source has confirmed this claim yet.',
      sourceUrls: ['https://x.com/research/status/999'],
      sourceNotePath: 'Inbox/2026-05-17 social-only.md',
      targetLane: 'buildroom',
      priority: 'low',
      owner: 'Hermes',
      verificationStatus: 'unverified',
      evidenceStrength: 'weak',
      claims: ['A social-only claim says the adapter replaces existing eval harnesses.'],
    },
  ],
};

const first = generateResearchLayer(payload, { root, now, writtenFiles: ['Ideas/2026-05-17 weak-buildroom-idea-must-verify-first.md'] });
const second = generateResearchLayer(payload, { root, now, writtenFiles: ['Ideas/2026-05-17 weak-buildroom-idea-must-verify-first.md'] });
assert(first.ok && second.ok, 'research layer should return ok');
assert(first.runId === 'research-operator-regression', 'runId should round-trip');
assert(first.files.every((file) => file.startsWith('research-vault/') || file.startsWith('queue/')), 'all artifacts should stay in research-vault/ or queue/');
for (const file of first.files) assert(fs.existsSync(path.join(root, file)), `${file} should exist`);

const dispatchPath = path.join(root, 'research-vault/ops/dispatch.json');
const dispatch = JSON.parse(fs.readFileSync(dispatchPath, 'utf8')) as {
  handoffs: Record<string, Array<{ title: string; targetLane: string; originalTargetLane: string | null; blockedReason: string | null; reroutedReason: string | null; sourceUrls: string[]; sourceNotePath: string; claims: string[]; evidenceStrength: string }>>;
  needsAttention: unknown[];
};
const allHandoffItems = Object.values(dispatch.handoffs).flat();
const handoffKeys = JSON.stringify(Object.keys(allHandoffItems[0]).sort());
assert(allHandoffItems.every((item) => JSON.stringify(Object.keys(item).sort()) === handoffKeys), 'all handoff items should expose stable keys');
assert(dispatch.handoffs.verify.some((item) => item.title === 'Weak buildroom idea must verify first'), 'weak buildroom idea should reroute to verify');
assert(dispatch.handoffs.verify.some((item) => item.title === 'Weak buildroom idea must verify first' && item.targetLane === 'verify'), 'handoff item should expose targetLane');
assert(!dispatch.handoffs.buildroom.some((item) => item.title === 'Weak buildroom idea must verify first'), 'weak buildroom idea should not remain in buildroom');
assert(!dispatch.handoffs.buildroom.some((item) => item.evidenceStrength === 'weak'), 'weak evidence should never enter buildroom');
assert(dispatch.handoffs.verify[0].reroutedReason === 'weak evidence cannot enter buildroom without verification', 'reroute reason should be recorded');
assert(dispatch.handoffs.buildroom.every((item) => item.reroutedReason === null && item.blockedReason === null && item.originalTargetLane === null), 'non-rerouted buildroom items should keep null optional fields');
assert(dispatch.handoffs.verify[0].sourceUrls.includes('https://x.com/research/status/2055704951062700434'), 'source URL should be preserved as string');
assert(dispatch.handoffs.verify[0].sourceNotePath === 'Inbox/2026-05-17 weak-buildroom.md', 'source note path should be preserved');
assert(dispatch.handoffs.verify[0].claims.includes('A new adapter can improve agent learning throughput.'), 'claim should be preserved');
assert(dispatch.handoffs.buildroom.some((item) => item.title === 'Medium evidence adapter smoke test'), 'medium evidence item can enter buildroom');
assert(dispatch.handoffs.watch.some((item) => item.title === 'Watch the unverified social-only adapter claim.'), 'unverified weak buildroom item should route to watch');
assert(dispatch.needsAttention.length >= 1, 'weak/rerouted item should need attention');

const verifyQueue = JSON.parse(fs.readFileSync(path.join(root, 'queue/verify-handoff.json'), 'utf8')) as { items: Array<{ title: string; reroutedReason?: string }> };
assert(verifyQueue.items.some((item) => item.title === 'Weak buildroom idea must verify first' && item.reroutedReason), 'verify queue should include rerouted weak item');
const buildQueue = JSON.parse(fs.readFileSync(path.join(root, 'queue/buildroom-handoff.json'), 'utf8')) as { items: Array<{ title: string }> };
assert(buildQueue.items.length === 1 && buildQueue.items[0].title === 'Medium evidence adapter smoke test', 'buildroom queue should only contain medium/strong evidence item');
const watchQueue = JSON.parse(fs.readFileSync(path.join(root, 'queue/watch-handoff.json'), 'utf8')) as { items: Array<{ title: string; evidenceStrength: string; verificationStatus: string }> };
assert(watchQueue.items.some((item) => item.title === 'Watch the unverified social-only adapter claim.' && item.evidenceStrength === 'weak' && item.verificationStatus === 'unverified'), 'watch queue should include unverified weak item');

const claimFiles = first.files.filter((file) => file.startsWith('research-vault/claims/') && file.endsWith('.json')).sort();
const claimFiles2 = second.files.filter((file) => file.startsWith('research-vault/claims/') && file.endsWith('.json')).sort();
assert(claimFiles.length === 4, `expected 4 claim files, got ${claimFiles.length}`);
assert(JSON.stringify(claimFiles) === JSON.stringify(claimFiles2), 'claim file paths should be stable across same payload/time');
const firstClaim = JSON.parse(fs.readFileSync(path.join(root, claimFiles[0]), 'utf8')) as { claimId: string; statement: string; sourceUrls: string[]; firstSeen: string; lastReinforced: string; runIds: string[]; sourceCardIds: string[]; confidence: string; verificationStatus: string; evidenceStrength: string; traceability: Record<string, unknown> };
assert(firstClaim.claimId === path.basename(claimFiles[0], '.json'), 'claim ID should match filename');
assert(firstClaim.firstSeen === now.toISOString(), 'claim firstSeen should be fixed on first write');
assert(firstClaim.lastReinforced === now.toISOString(), 'claim lastReinforced should update to generation time');
assert(firstClaim.sourceUrls.every((url) => typeof url === 'string'), 'claim source URLs should stay strings');
assert(Array.isArray(firstClaim.runIds) && firstClaim.runIds.includes('research-operator-regression'), 'claim should track runIds separately');
assert(Array.isArray(firstClaim.sourceCardIds) && firstClaim.sourceCardIds.every((id) => !id.includes('research-operator-regression')), 'sourceCardIds should not be polluted by runId');
assert(firstClaim.traceability && typeof firstClaim.traceability.latestRunId === 'string', 'claim should include latest traceability');
const brief = fs.readFileSync(path.join(root, 'research-vault/ops/operator-brief.md'), 'utf8');
assert(brief.includes('## Needs attention'), 'operator brief should include needs attention');
assert(brief.includes('Weak buildroom idea must verify first'), 'operator brief should mention weak item');
const health = fs.readFileSync(path.join(root, 'research-vault/health/latest-health-check.md'), 'utf8');
assert(health.includes('Weak evidence items: 2'), 'health check should count weak evidence');
assert(health.includes('Rerouted weak buildroom items: 2'), 'health check should count reroutes');
assert(health.includes('xSearch pending: 2'), 'health check should include xSearch pending count');
assert(health.includes('Reply fetch ok: 1'), 'health check should include reply fetch ok count');
assert(health.includes('Reply fetch failures: 1'), 'health check should include reply fetch failures');
const healthJson = JSON.parse(fs.readFileSync(path.join(root, 'research-vault/health/latest-health-check.json'), 'utf8')) as { sourceBalance: { x: number; primary: number; external: number }; verificationGaps: string[]; xSearch: { pending: number; ok: number }; replyFetch: { ok: number; failures: number }; orphanNoSourceCount: number };
assert(healthJson.sourceBalance.x >= 1 && healthJson.sourceBalance.primary >= 1, `health JSON should include source balance, got ${JSON.stringify(healthJson.sourceBalance)}`);
assert(healthJson.verificationGaps.length >= 3, 'health JSON should include run and item verification gaps');
assert(healthJson.xSearch.pending === 2 && healthJson.xSearch.ok === 1, 'health JSON should include xSearch counts');
assert(healthJson.replyFetch.ok === 1 && healthJson.replyFetch.failures === 1, 'health JSON should include reply fetch counts');
assert(healthJson.orphanNoSourceCount >= 1, 'health JSON should count orphan/no-source records');
const cockpit = fs.readFileSync(path.join(root, 'research-vault/ops/operator-cockpit.html'), 'utf8');
assert(cockpit.includes('Agent Radar Operator Cockpit') && cockpit.includes('Buildroom') && cockpit.includes('Verify'), 'operator cockpit should render lanes');

const third = generateResearchLayer({
  runId: 'research-operator-regression',
  summary: 'Regression payload with weaker duplicate claim.',
  ideas: [{
    title: 'Duplicate weak reinforcement should not downgrade',
    thesis: 'The adapter has enough documentation for a one-hour smoke test.',
    whyNow: 'A weaker social repost repeats an already stronger claim.',
    nextMove: 'Keep existing stronger claim status and send repost to verify.',
    sourceUrls: ['https://x.com/research/status/repost'],
    sourceNotePath: 'Inbox/repost.md',
    targetLane: 'verify',
    priority: 'low',
    owner: 'Hermes',
    verificationStatus: 'unverified',
    evidenceStrength: 'weak',
    claims: ['The adapter has enough documentation for a one-hour smoke test.'],
  }],
}, { root, now: new Date('2026-05-17T16:30:00.000Z') });
assert(third.ok, 'duplicate weaker claim generation should return ok');
function stableHashForTest(value: string) { let hash = 2166136261; for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(16); }
const duplicateClaimPath = path.join(root, 'research-vault/claims', `claim-${stableHashForTest('The adapter has enough documentation for a one-hour smoke test.'.toLowerCase().replace(/\s+/g, ' ').trim())}.json`);
const duplicateClaim = JSON.parse(fs.readFileSync(duplicateClaimPath, 'utf8')) as { confidence: string; verificationStatus: string; evidenceStrength: string; sourceUrls: string[]; lastReinforced: string };
assert(duplicateClaim.confidence === 'medium' && duplicateClaim.verificationStatus === 'partially_verified' && duplicateClaim.evidenceStrength === 'medium', 'weaker duplicate claim should not downgrade stronger evidence state');
assert(duplicateClaim.sourceUrls.includes('https://x.com/research/status/repost'), 'duplicate claim should merge newer source URL');
assert(duplicateClaim.lastReinforced === '2026-05-17T16:30:00.000Z', 'duplicate claim lastReinforced should update');

fs.rmSync(root, { recursive: true, force: true });
console.log(JSON.stringify({ files: first.files.length, claims: claimFiles.length, verify: dispatch.handoffs.verify.length, buildroom: dispatch.handoffs.buildroom.length }, null, 2));
