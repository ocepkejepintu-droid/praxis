#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }
function writeJson(file: string, value: unknown) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2)); }
const repoRoot = process.cwd();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-radar-atlas-integration-'));
try {
  const xRunId = '2026-05-18-x-run';
  const atlasRunId = '2026-05-18-hermes-atlas-external';
  const xRunDir = path.join(tmp, '.omx/ingestion-runs', xRunId);
  const atlasRunDir = path.join(tmp, '.omx/ingestion-runs', atlasRunId);
  fs.mkdirSync(xRunDir, { recursive: true });
  fs.mkdirSync(atlasRunDir, { recursive: true });
  writeJson(path.join(tmp, '.omx/ingestion-runs/latest.json'), { id: xRunId, mode: 'live', source: 'home', status: 'ok', startedAt: '2026-05-18T00:00:00.000Z', finishedAt: '2026-05-18T00:01:00.000Z', health: { running: true, extension_connected: true }, cardsCreated: 1, rejectedCount: 0, verificationGaps: [], files: ['Inbox/homeclaw.md'], message: 'x run', sidecars: { pending: 0, xSearchOk: 0, replyFetchOk: 0, replyFetchFailed: 0 } });
  writeJson(path.join(tmp, '.omx/ingestion-runs', `${xRunId}.json`), JSON.parse(fs.readFileSync(path.join(tmp, '.omx/ingestion-runs/latest.json'), 'utf8')));
  writeJson(path.join(xRunDir, 'merged.json'), { items: [{
    bucket: 'experiment',
    statusId: '2055707450125500514',
    statusUrl: 'https://x.com/OmarShahine/status/2055707450125500514',
    sourceCard: 'Inbox/homeclaw.md',
    browserMarkdown: '# X signal: HomeClaw\n\nOmar shipped HomeClaw, a HomeKit CLI/MCP agent control project. https://github.com/omarshahine/HomeClaw',
    enrichment: {},
    replyFetch: {},
  }] });
  writeJson(path.join(tmp, '.omx/ingestion-runs/latest-hermes-atlas.json'), { id: atlasRunId, mode: 'external-cards', source: 'hermes-atlas', status: 'ok', startedAt: '2026-05-18T00:02:00.000Z', finishedAt: '2026-05-18T00:03:00.000Z', health: { running: true, extension_connected: true, baseUrl: 'https://hermesatlas.com/' }, cardsCreated: 1, rejectedCount: 0, verificationGaps: [], files: ['Repos/homeclaw.md'], message: 'atlas run', progress: { atlasCards: 1, atlasRepos: 1, atlasSummaries: 1 } });
  writeJson(path.join(tmp, '.omx/ingestion-runs', `${atlasRunId}.json`), JSON.parse(fs.readFileSync(path.join(tmp, '.omx/ingestion-runs/latest-hermes-atlas.json'), 'utf8')));
  writeJson(path.join(atlasRunDir, 'normalized-cards.json'), [{
    externalId: 'omarshahine/HomeClaw',
    title: 'HomeClaw',
    body: 'HomeClaw gives agents/CLIs control over Apple HomeKit via CLI, MCP server, OpenClaw plugin, and Claude Code plugin with audit and permission controls.',
    author: 'omarshahine',
    category: 'Agents & Tooling',
    sourceUrl: 'https://hermesatlas.com/projects/omarshahine/HomeClaw',
    canonicalUrl: 'https://github.com/omarshahine/HomeClaw',
    urls: ['https://github.com/omarshahine/HomeClaw'],
    metrics: { stars: 42, official: false, audit: 'ok' },
  }]);

  const out = execFileSync(process.execPath, ['--experimental-strip-types', path.join(repoRoot, 'scripts/generate-research-operator-from-run.ts'), '--run', xRunId], { cwd: tmp, encoding: 'utf8' });
  const parsed = JSON.parse(out);
  assert(parsed.ok, 'operator generation failed');
  const dispatch = JSON.parse(fs.readFileSync(path.join(tmp, 'research-vault/ops/dispatch.json'), 'utf8'));
  const all = Object.values(dispatch.handoffs).flat() as any[];
  const homeclaw = all.find((item) => JSON.stringify(item).includes('HomeClaw'));
  assert(homeclaw, 'HomeClaw item missing from operator dispatch');
  assert(homeclaw.sourceUrls.includes('https://hermesatlas.com/projects/omarshahine/HomeClaw'), 'Atlas project URL missing from sourceUrls');
  assert(homeclaw.sourceUrls.includes('https://github.com/omarshahine/HomeClaw'), 'GitHub canonical URL missing from sourceUrls');
  assert(homeclaw.claims.some((claim: string) => claim.includes('Hermes Atlas')), 'Atlas claim missing');
  assert(homeclaw.evidenceStrength === 'medium', 'Atlas + GitHub evidence should upgrade weak X signal to medium, not strong');
  const health = JSON.parse(fs.readFileSync(path.join(tmp, 'research-vault/health/latest-health-check.json'), 'utf8'));
  assert((health.sourceHosts['hermesatlas.com'] || 0) > 0, 'health should include hermesatlas.com source host');
  console.log(JSON.stringify({ ok: true, tmp, lane: homeclaw.targetLane, evidenceStrength: homeclaw.evidenceStrength, sourceUrls: homeclaw.sourceUrls }, null, 2));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
