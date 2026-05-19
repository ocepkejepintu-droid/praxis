#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'research-vault/ops/operator-brief.md',
  'research-vault/ops/action-ledger.md',
  'research-vault/ops/focus.md',
  'research-vault/ops/dispatch.json',
  'research-vault/ops/operator-cockpit.html',
  'research-vault/health/latest-health-check.md',
  'research-vault/health/latest-health-check.json',
  'queue/buildroom-handoff.json',
  'queue/verify-handoff.json',
  'queue/content-handoff.json',
  'queue/watch-handoff.json',
];
const lanes = ['buildroom', 'verify', 'content', 'watch'] as const;
const requiredItemKeys = [
  'id', 'kind', 'title', 'runId', 'priority', 'owner', 'statement', 'nextAction',
  'sourceUrls', 'sourceNotePath', 'dependencyUrls', 'targetLane', 'originalTargetLane',
  'verificationStatus', 'evidenceStrength', 'claims', 'blockedReason', 'reroutedReason',
];
const requiredClaimKeys = [
  'claimId', 'statement', 'sourceCardIds', 'sourceUrls', 'dependencyUrls', 'runIds',
  'confidence', 'firstSeen', 'lastReinforced', 'verificationStatus', 'evidenceStrength',
  'originatingItems', 'observedInLanes', 'traceability',
];
function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }
function readJson(rel: string) { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); }
function exists(rel: string) { return fs.existsSync(path.join(root, rel)); }
for (const file of requiredFiles) assert(exists(file), `${file} missing`);
const dispatch = readJson('research-vault/ops/dispatch.json') as { runId: string; generatedAt: string; handoffs: Record<string, any[]>; blocked: any[]; needsAttention: any[] };
assert(typeof dispatch.runId === 'string' && dispatch.runId.length > 0, 'dispatch.runId missing');
assert(!Number.isNaN(Date.parse(dispatch.generatedAt)), 'dispatch.generatedAt invalid');
for (const lane of lanes) assert(Array.isArray(dispatch.handoffs?.[lane]), `dispatch.handoffs.${lane} missing`);
const allItems = lanes.flatMap((lane) => dispatch.handoffs[lane]);
for (const item of allItems) {
  for (const key of requiredItemKeys) assert(Object.prototype.hasOwnProperty.call(item, key), `handoff item ${item.title || item.id} missing ${key}`);
  assert(item.targetLane !== 'buildroom' || item.evidenceStrength !== 'weak', `weak evidence entered buildroom: ${item.title}`);
  assert(Array.isArray(item.claims) && item.claims.length > 0, `handoff item has no claims: ${item.title}`);
  assert(Array.isArray(item.sourceUrls), `sourceUrls not array: ${item.title}`);
  assert(typeof item.sourceNotePath === 'string' && item.sourceNotePath.length > 0, `sourceNotePath missing: ${item.title}`);
  if (item.sourceUrls.length === 0 || item.sourceNotePath === 'pending') {
    assert(['verify', 'watch'].includes(item.targetLane), `orphan item must stay verify/watch: ${item.title}`);
  }
}
for (const lane of lanes) {
  const queue = readJson(`queue/${lane}-handoff.json`) as { runId: string; lane: string; items: any[] };
  assert(queue.runId === dispatch.runId, `${lane} queue runId mismatch`);
  assert(queue.lane === lane, `${lane} queue lane mismatch`);
  assert(JSON.stringify(queue.items) === JSON.stringify(dispatch.handoffs[lane]), `${lane} queue differs from dispatch`);
}
assert(Array.isArray(dispatch.blocked), 'dispatch.blocked must be array');
assert(Array.isArray(dispatch.needsAttention), 'dispatch.needsAttention must be array');
const health = readJson('research-vault/health/latest-health-check.json') as any;
assert(health.runId === dispatch.runId, 'health runId mismatch');
assert(typeof health.sourceBalance?.x === 'number' && typeof health.sourceBalance?.primary === 'number' && typeof health.sourceBalance?.external === 'number', 'health sourceBalance malformed');
assert(typeof health.staleItems === 'number' && typeof health.weakEvidenceItems === 'number' && typeof health.orphanNoSourceCount === 'number', 'health quality counters malformed');
assert(typeof health.xSearch?.pending === 'number' && typeof health.xSearch?.ok === 'number', 'health xSearch counters malformed');
assert(typeof health.replyFetch?.ok === 'number' && typeof health.replyFetch?.failures === 'number', 'health replyFetch counters malformed');
const healthMd = fs.readFileSync(path.join(root, 'research-vault/health/latest-health-check.md'), 'utf8');
for (const phrase of ['Source balance', 'Quality flags', 'Verification gaps', 'xSearch pending', 'Reply fetch failures']) assert(healthMd.includes(phrase), `health md missing ${phrase}`);
const cockpit = fs.readFileSync(path.join(root, 'research-vault/ops/operator-cockpit.html'), 'utf8');
for (const phrase of ['Agent Radar Operator Cockpit', 'Buildroom', 'Verify', 'Content', 'Watch']) assert(cockpit.includes(phrase), `cockpit missing ${phrase}`);
const claimDir = path.join(root, 'research-vault/claims');
const claimFiles = fs.existsSync(claimDir) ? fs.readdirSync(claimDir).filter((file) => file.endsWith('.json')) : [];
assert(claimFiles.length > 0, 'no claim files found');
let checkedClaims = 0;
for (const file of claimFiles) {
  const claim = JSON.parse(fs.readFileSync(path.join(claimDir, file), 'utf8')) as any;
  for (const key of requiredClaimKeys) assert(Object.prototype.hasOwnProperty.call(claim, key), `${file} missing ${key}`);
  assert(claim.claimId === path.basename(file, '.json'), `${file} claimId mismatch`);
  assert(typeof claim.statement === 'string' && claim.statement.length >= 10, `${file} statement too short`);
  assert(Array.isArray(claim.runIds), `${file} runIds not array`);
  assert(Array.isArray(claim.sourceCardIds), `${file} sourceCardIds not array`);
  assert(claim.sourceCardIds.every((id: string) => !/^\d{4}-\d{2}-\d{2}|research-|manual/.test(id)), `${file} sourceCardIds polluted by runId`);
  assert(!Number.isNaN(Date.parse(claim.firstSeen)) && !Number.isNaN(Date.parse(claim.lastReinforced)), `${file} temporal fields invalid`);
  assert(['low', 'medium', 'high'].includes(claim.confidence), `${file} confidence invalid`);
  assert(['unverified', 'needs_verification', 'partially_verified', 'verified'].includes(claim.verificationStatus), `${file} verificationStatus invalid`);
  assert(['weak', 'medium', 'strong'].includes(claim.evidenceStrength), `${file} evidenceStrength invalid`);
  checkedClaims += 1;
}
console.log(JSON.stringify({ ok: true, runId: dispatch.runId, items: allItems.length, buildroom: dispatch.handoffs.buildroom.length, verify: dispatch.handoffs.verify.length, content: dispatch.handoffs.content.length, watch: dispatch.handoffs.watch.length, claims: checkedClaims, weakEvidence: health.weakEvidenceItems, xSearch: health.xSearch }, null, 2));
