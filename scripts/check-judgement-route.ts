import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateResearchLayer, normalizeResearchJudgementPayload } from '../src/lib/research-layer.ts';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-radar-judgement-route-'));
try {
  const normalized = normalizeResearchJudgementPayload({
    runId: 'route-normalization-regression',
    summary: 'Route normalization regression.',
    ideas: [{
      title: 'Whitespace weak signal must not build',
      thesis: 'A weak signal with whitespace tries to enter buildroom.',
      whyNow: 'Route markdown is written before the research layer.',
      nextMove: 'Verify before build work.',
      sourceUrls: ['https://x.com/research/status/trimmed'],
      sourceNotePath: 'Inbox/trimmed.md',
      targetLane: 'buildroom ' as never,
      priority: 'high ' as never,
      owner: 'Hermes ' as never,
      verificationStatus: 'needs_verification ' as never,
      evidenceStrength: 'weak ' as never,
      claims: ['Whitespace-padded weak evidence must not enter buildroom.'],
    }],
  });

  const idea = normalized.ideas?.[0];
  if (!idea) throw new Error('normalized idea should exist');
  assert(idea?.targetLane === 'verify', 'route normalization should trim and reroute weak buildroom to verify');
  assert(idea?.priority === 'high', 'route normalization should trim priority');
  assert(idea?.owner === 'Hermes', 'route normalization should trim owner');
  assert(idea?.verificationStatus === 'needs_verification', 'route normalization should trim verification status');
  assert(idea?.evidenceStrength === 'weak', 'route normalization should trim evidence strength');
  assert(idea.originalTargetLane === 'buildroom' && idea.reroutedReason === 'weak evidence cannot enter buildroom without verification', 'normalization should preserve reroute trace');

  const result = generateResearchLayer(normalized, { root, now: new Date('2026-05-17T15:45:00.000Z') });
  assert(result.counts.buildroom === 0 && result.counts.verify === 1, 'normalized weak payload should not enter buildroom');
  const dispatch = JSON.parse(fs.readFileSync(path.join(root, 'research-vault/ops/dispatch.json'), 'utf8')) as { handoffs: { buildroom: unknown[]; verify: Array<{ targetLane: string; evidenceStrength: string }> } };
  assert(dispatch.handoffs.buildroom.length === 0, 'dispatch buildroom should be empty for weak payload');
  assert(dispatch.handoffs.verify[0]?.targetLane === 'verify' && dispatch.handoffs.verify[0]?.evidenceStrength === 'weak', 'dispatch should preserve normalized verify/weak fields');
  const targetLane = idea.targetLane;
  console.log(JSON.stringify({ ok: true, buildroom: result.counts.buildroom, verify: result.counts.verify, targetLane }, null, 2));
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
