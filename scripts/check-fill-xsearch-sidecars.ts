#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-radar-xsearch-'));
const runId = 'test-run';
const runDir = path.join(tmp, '.omx/ingestion-runs', runId);
const enrichedDir = path.join(runDir, 'enriched');
fs.mkdirSync(enrichedDir, { recursive: true });

const run = {
  id: runId,
  status: 'ok',
  files: ['Inbox/test.md'],
  progress: { xSearchEnriched: 0, statusIds: 1 },
  sidecars: { pending: 1, xSearchOk: 0, replyFetchOk: 0, replyFetchFailed: 0 },
  paths: { enrichedDir: `.omx/ingestion-runs/${runId}/enriched` },
};
fs.writeFileSync(path.join(tmp, '.omx/ingestion-runs/latest.json'), JSON.stringify(run, null, 2));
fs.writeFileSync(path.join(tmp, '.omx/ingestion-runs', `${runId}.json`), JSON.stringify(run, null, 2));
fs.writeFileSync(path.join(enrichedDir, '123.json'), JSON.stringify({
  runId,
  sourceCard: 'Inbox/test.md',
  status: { handle: 'example', id: '123', url: 'https://x.com/example/status/123' },
  xSearch: { status: 'pending', query: 'conversation_id:123', enable_image_understanding: true },
  replyFetch: { status: 'pending' },
}, null, 2));

function runScript(args: string[]) {
  return execFileSync(process.execPath, ['--experimental-strip-types', path.join(process.cwd(), 'scripts/fill-xsearch-sidecars.ts'), ...args], { cwd: tmp, encoding: 'utf8' });
}

const listed = JSON.parse(runScript(['--run', 'latest', '--list', '--limit', '1']));
if (!listed.ok || listed.pending.length !== 1 || listed.pending[0].statusId !== '123') {
  throw new Error(`expected one pending sidecar, got ${JSON.stringify(listed)}`);
}

const applied = JSON.parse(runScript([
  '--run', 'latest',
  '--status-id', '123',
  '--query', 'conversation_id:123',
  '--answer', 'Verified answer',
  '--citations', 'https://x.com/example/status/123,https://example.com/docs',
]));
if (!applied.ok || applied.xSearchOk !== 1) throw new Error(`expected xSearchOk=1, got ${JSON.stringify(applied)}`);

const sidecar = JSON.parse(fs.readFileSync(path.join(enrichedDir, '123.json'), 'utf8'));
if (sidecar.xSearch.status !== 'ok') throw new Error('sidecar xSearch status not ok');
if (sidecar.xSearch.answer !== 'Verified answer') throw new Error('sidecar answer not written');
if (sidecar.xSearch.citations.length !== 2) throw new Error('citations not parsed');

const latest = JSON.parse(fs.readFileSync(path.join(tmp, '.omx/ingestion-runs/latest.json'), 'utf8'));
if (latest.progress.xSearchEnriched !== 1) throw new Error(`latest progress not updated: ${JSON.stringify(latest.progress)}`);
if (latest.sidecars.pending !== 0 || latest.sidecars.xSearchOk !== 1) throw new Error(`sidecar counts wrong: ${JSON.stringify(latest.sidecars)}`);



// Automation wrapper: rank useful pending cards, skip noisy posts, then apply Hermes batch JSON.
const autoTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-radar-xsearch-auto-'));
const autoRunId = 'auto-test-run';
const autoRunDir = path.join(autoTmp, '.omx/ingestion-runs', autoRunId);
const autoEnrichedDir = path.join(autoRunDir, 'enriched');
fs.mkdirSync(autoEnrichedDir, { recursive: true });
fs.mkdirSync(path.join(autoTmp, 'Inbox'), { recursive: true });
const autoRun = {
  id: autoRunId,
  status: 'ok',
  files: ['Inbox/tool.md', 'Inbox/ad.md', 'Inbox/crypto.md'],
  progress: { xSearchEnriched: 0, statusIds: 3 },
  sidecars: { pending: 3, xSearchOk: 0, replyFetchOk: 1, replyFetchFailed: 0 },
  paths: { enrichedDir: `.omx/ingestion-runs/${autoRunId}/enriched` },
};
fs.writeFileSync(path.join(autoTmp, '.omx/ingestion-runs/latest.json'), JSON.stringify(autoRun, null, 2));
fs.writeFileSync(path.join(autoTmp, '.omx/ingestion-runs', `${autoRunId}.json`), JSON.stringify(autoRun, null, 2));
fs.writeFileSync(path.join(autoTmp, 'Inbox/tool.md'), '# X signal: Useful MCP repo\n\nA GitHub repo for an MCP agent workflow with SDK docs and setup steps. https://github.com/example/useful-mcp');
fs.writeFileSync(path.join(autoTmp, 'Inbox/ad.md'), '# X signal: Sponsored ad\n\nPromoted paid social workflow. Buy now.');
fs.writeFileSync(path.join(autoTmp, 'Inbox/crypto.md'), '# X signal: crypto bait\n\nClaim $81 free crypto testnet farming reward.');
fs.writeFileSync(path.join(autoEnrichedDir, 'tool-1.json'), JSON.stringify({
  runId: autoRunId,
  sourceCard: 'Inbox/tool.md',
  status: { handle: 'builder', id: 'tool-1', url: 'https://x.com/builder/status/tool-1' },
  browserExternalLinks: ['https://github.com/example/useful-mcp'],
  xSearch: { status: 'pending', query: 'conversation_id:tool-1', enable_image_understanding: true },
  replyFetch: { status: 'ok', firstReplyLinks: ['https://docs.example.com/useful-mcp'] },
}, null, 2));
fs.writeFileSync(path.join(autoEnrichedDir, 'ad-1.json'), JSON.stringify({
  runId: autoRunId,
  sourceCard: 'Inbox/ad.md',
  status: { handle: 'adco', id: 'ad-1', url: 'https://x.com/adco/status/ad-1' },
  browserExternalLinks: ['https://example.com/?utm_campaign=paid&twclid=abc'],
  xSearch: { status: 'pending', query: 'conversation_id:ad-1', enable_image_understanding: true },
  replyFetch: { status: 'pending' },
}, null, 2));
fs.writeFileSync(path.join(autoEnrichedDir, 'crypto-1.json'), JSON.stringify({
  runId: autoRunId,
  sourceCard: 'Inbox/crypto.md',
  status: { handle: 'coin', id: 'crypto-1', url: 'https://x.com/coin/status/crypto-1' },
  browserExternalLinks: [],
  xSearch: { status: 'pending', query: 'conversation_id:crypto-1', enable_image_understanding: true },
  replyFetch: { status: 'pending' },
}, null, 2));

function runAuto(args: string[]) {
  return execFileSync(process.execPath, ['--experimental-strip-types', path.join(process.cwd(), 'scripts/auto-fill-xsearch-sidecars.ts'), ...args], { cwd: autoTmp, encoding: 'utf8' });
}

const worklist = JSON.parse(runAuto(['--run', 'latest', '--list', '--limit', '5']));
if (!worklist.ok || worklist.selected !== 1 || worklist.candidates[0].statusId !== 'tool-1') {
  throw new Error(`expected one useful tool candidate, got ${JSON.stringify(worklist)}`);
}
if (worklist.skipped.ad_or_promoted !== 1 || worklist.skipped.crypto_spam !== 1) {
  throw new Error(`expected noisy posts skipped, got ${JSON.stringify(worklist.skipped)}`);
}
const batchPath = path.join(autoTmp, 'hermes-batch.json');
fs.writeFileSync(batchPath, JSON.stringify({
  results: [{
    statusId: 'tool-1',
    query: 'conversation_id:tool-1',
    answer: 'Hermes verified this is a real MCP repo workflow.',
    citations: ['https://x.com/builder/status/tool-1', 'https://github.com/example/useful-mcp'],
  }],
}, null, 2));
const autoApplied = JSON.parse(runAuto(['--run', 'latest', '--apply', batchPath]));
if (!autoApplied.ok || autoApplied.appliedCount !== 1) throw new Error(`expected one auto apply, got ${JSON.stringify(autoApplied)}`);
const autoLatest = JSON.parse(fs.readFileSync(path.join(autoTmp, '.omx/ingestion-runs/latest.json'), 'utf8'));
if (autoLatest.progress.xSearchEnriched !== 1 || autoLatest.sidecars.xSearchOk !== 1) {
  throw new Error(`auto apply did not update counts: ${JSON.stringify(autoLatest)}`);
}

console.log(JSON.stringify({ ok: true, tmp, autoTmp, checked: ['list', 'apply', 'run-status-counts', 'auto-worklist', 'auto-apply'] }, null, 2));
