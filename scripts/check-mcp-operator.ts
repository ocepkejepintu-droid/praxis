#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }
const originalCwd = process.cwd();
const repoRoot = originalCwd;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-radar-mcp-operator-'));
process.chdir(tmp);

try {
  fs.mkdirSync(path.join(tmp, 'research-vault/ops'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'research-vault/health'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'research-vault/claims'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'queue'), { recursive: true });
  const item = { id: 'verify-1', title: 'Verify thing', evidenceStrength: 'weak', verificationStatus: 'needs_verification', sourceUrls: ['https://x.com/a/status/1'], nextAction: 'Verify source.' };
  const dispatch = { runId: 'operator-test', generatedAt: new Date().toISOString(), handoffs: { buildroom: [], verify: [item], content: [], watch: [] }, blocked: [], needsAttention: [item] };
  fs.writeFileSync(path.join(tmp, 'research-vault/ops/dispatch.json'), JSON.stringify(dispatch, null, 2));
  fs.writeFileSync(path.join(tmp, 'research-vault/ops/operator-brief.md'), '# Brief');
  fs.writeFileSync(path.join(tmp, 'research-vault/ops/focus.md'), '# Focus');
  fs.writeFileSync(path.join(tmp, 'research-vault/ops/action-ledger.md'), '# Ledger');
  fs.writeFileSync(path.join(tmp, 'research-vault/ops/operator-cockpit.html'), '<h1>Agent Radar Operator Cockpit</h1>');
  fs.writeFileSync(path.join(tmp, 'research-vault/health/latest-health-check.json'), JSON.stringify({ runId: 'operator-test', needsAttention: 1, weakEvidenceItems: 1, xSearch: { pending: 2, ok: 1 }, replyFetch: { ok: 0, failures: 0 } }, null, 2));
  fs.writeFileSync(path.join(tmp, 'research-vault/claims/claim-one.json'), JSON.stringify({ claimId: 'claim-one', statement: 'A traceable claim.' }, null, 2));
  for (const lane of ['buildroom', 'verify', 'content', 'watch']) fs.writeFileSync(path.join(tmp, 'queue', `${lane}-handoff.json`), JSON.stringify({ runId: 'operator-test', lane, items: lane === 'verify' ? [item] : [] }, null, 2));

  const operator = await import(`../src/lib/operator.ts?mcp=${Date.now()}`);
  const snapshot = operator.getOperatorSnapshot();
  assert(snapshot.dispatch.runId === 'operator-test', 'operator dispatch not read');
  assert(snapshot.lanes.verify === 1 && snapshot.lanes.buildroom === 0, 'operator lane counts wrong');
  assert(snapshot.claims === 1, 'claims count wrong');
  assert(operator.readHandoffQueue('verify').items.length === 1, 'verify queue not readable');
  const routeText = fs.readFileSync(path.join(repoRoot, 'src/app/api/mcp/route.ts'), 'utf8');
  for (const needle of ['agent-praxis://operator/dispatch', 'agent-praxis://operator/health', 'agent-praxis://operator/queues/{lane}', 'agent-praxis://claims', 'get_operator_dispatch', 'get_research_health', 'list_handoff_queue', 'list_claims']) assert(routeText.includes(needle), `MCP route missing ${needle}`);
  console.log(JSON.stringify({ ok: true, tmp, lanes: snapshot.lanes, claims: snapshot.claims }, null, 2));
} finally {
  process.chdir(originalCwd);
  fs.rmSync(tmp, { recursive: true, force: true });
}
