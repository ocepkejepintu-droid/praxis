#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const runArg = process.argv.includes('--run') ? process.argv[process.argv.indexOf('--run') + 1] : 'latest';
const runPath = runArg === 'latest' ? path.join(root, '.omx/ingestion-runs/latest.json') : path.join(root, '.omx/ingestion-runs', `${runArg}.json`);
const run = JSON.parse(fs.readFileSync(runPath, 'utf8'));
const runDir = path.join(root, '.omx/ingestion-runs', run.id);
const enrichedDir = path.join(runDir, 'enriched');
fs.mkdirSync(enrichedDir, { recursive: true });

function uniq<T>(xs: T[]) { return Array.from(new Set(xs)); }
function writeRun(next: any) {
  fs.writeFileSync(path.join(root, '.omx/ingestion-runs', `${run.id}.json`), JSON.stringify(next, null, 2));
  fs.writeFileSync(path.join(root, '.omx/ingestion-runs', 'latest.json'), JSON.stringify(next, null, 2));
}
function sidecarCounts(items: any[]) {
  return {
    pending: items.filter((item) => !item.xSearch || item.xSearch.status === 'pending').length,
    xSearchOk: items.filter((item) => item.xSearch?.status === 'ok' || item.xSearch?.answer).length,
    replyFetchOk: items.filter((item) => item.replyFetch?.status === 'ok').length,
    replyFetchFailed: items.filter((item) => item.replyFetch?.status === 'failed').length,
  };
}
function extractStatusIds(text: string) {
  return uniq(Array.from(text.matchAll(/https?:\/\/(?:x|twitter)\.com\/([^\/\s]+)\/status\/(\d+)/g)).map((m) => ({ handle: m[1], id: m[2], url: `https://x.com/${m[1]}/status/${m[2]}` })));
}
function externalLinks(text: string) {
  const urlRe = new RegExp('https?://[^\\s)\\]\\"\\>]+', 'g');
  return uniq(Array.from(text.matchAll(urlRe)).map((m) => m[0].replace(/[.,;]+$/, '')).filter((u) => !/x\.com|twitter\.com|t\.co/i.test(u)));
}

const items: any[] = [];
for (const rel of run.files || []) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) continue;
  const markdown = fs.readFileSync(abs, 'utf8');
  const statuses = extractStatusIds(markdown);
  for (const status of statuses) {
    const sidecar = path.join(enrichedDir, `${status.id}.json`);
    const payload = fs.existsSync(sidecar) ? JSON.parse(fs.readFileSync(sidecar, 'utf8')) : {};
    const next = {
      ...payload,
      runId: run.id,
      sourceCard: rel,
      status,
      browserExternalLinks: externalLinks(markdown),
      xSearch: payload.xSearch || { status: 'pending', query: `conversation_id:${status.id}`, enable_image_understanding: true },
      replyFetch: payload.replyFetch || { status: 'pending' },
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(sidecar, JSON.stringify(next, null, 2));
    items.push(next);
  }
}
fs.writeFileSync(path.join(runDir, 'status-ids.json'), JSON.stringify(items.map((x) => x.status), null, 2));
writeRun({
  ...run,
  stage: 'prepare_enrichment',
  status: run.status === 'failed' || run.status === 'blocked' ? 'partial' : run.status,
  finishedAt: new Date().toISOString(),
  progress: {
    ...run.progress,
    cardsWritten: run.files?.length || run.progress?.cardsWritten || 0,
    statusIds: items.length,
    xSearchEnriched: sidecarCounts(items).xSearchOk,
  },
  sidecars: sidecarCounts(items),
  paths: {
    ...run.paths,
    statusIds: path.relative(root, path.join(runDir, 'status-ids.json')),
    enrichedDir: path.relative(root, enrichedDir),
    cards: run.files || [],
  },
  agent_ready: Boolean((run.files || []).length && fs.existsSync(path.join(runDir, 'merged.json'))),
});
console.log(JSON.stringify({ ok: true, runId: run.id, cards: run.files?.length || 0, statusIds: items.length, enrichedDir, note: 'Sidecars prepared. Agent/tool x_search should fill xSearch.answer for each pending sidecar.' }, null, 2));
