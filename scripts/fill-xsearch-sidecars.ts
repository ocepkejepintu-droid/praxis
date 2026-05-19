#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const args = process.argv.slice(2);

function arg(name: string, fallback = '') {
  const i = args.findIndex((a) => a === name);
  const inline = args.find((a) => a.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  return i >= 0 ? args[i + 1] || fallback : fallback;
}
function has(name: string) { return args.includes(name); }
function num(name: string, fallback: number) {
  const n = Number(arg(name, String(fallback)));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}
function readJsonSafe(p: string) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}
function writeJson(p: string, value: unknown) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(value, null, 2));
}
function parseCsv(value: string) {
  return value.split(',').map((x) => x.trim()).filter(Boolean);
}
function extractCitations(answer: string) {
  return Array.from(new Set(Array.from(answer.matchAll(/https?:\/\/[^\s)\]"'>]+/g)).map((m) => m[0].replace(/[.,;]+$/, ''))));
}

const runArg = arg('--run', 'latest');
const runPath = runArg === 'latest'
  ? path.join(root, '.omx/ingestion-runs/latest.json')
  : path.join(root, '.omx/ingestion-runs', `${runArg}.json`);
const run = readJsonSafe(runPath);
if (!run?.id) {
  console.error(JSON.stringify({ ok: false, error: `run not found: ${runPath}` }, null, 2));
  process.exit(2);
}
const runDir = path.join(root, '.omx/ingestion-runs', run.id);
const enrichedDir = path.join(runDir, 'enriched');

function sidecarFiles() {
  return fs.existsSync(enrichedDir)
    ? fs.readdirSync(enrichedDir).filter((f) => f.endsWith('.json')).map((f) => path.join(enrichedDir, f))
    : [];
}
function readSidecars() {
  return sidecarFiles().map((file) => ({ file, item: readJsonSafe(file) })).filter((x) => x.item?.status?.id);
}
function sidecarCounts(items = readSidecars().map((x) => x.item)) {
  return {
    pending: items.filter((item) => !item.xSearch || item.xSearch.status === 'pending').length,
    xSearchOk: items.filter((item) => item.xSearch?.status === 'ok' || item.xSearch?.answer).length,
    replyFetchOk: items.filter((item) => item.replyFetch?.status === 'ok').length,
    replyFetchFailed: items.filter((item) => item.replyFetch?.status === 'failed').length,
  };
}
function writeRunStatus(extra: Record<string, unknown> = {}) {
  const counts = sidecarCounts();
  const next = {
    ...run,
    ...extra,
    finishedAt: new Date().toISOString(),
    progress: {
      ...run.progress,
      xSearchEnriched: counts.xSearchOk,
    },
    sidecars: counts,
    paths: {
      ...run.paths,
      enrichedDir: path.relative(root, enrichedDir),
    },
  };
  writeJson(path.join(root, '.omx/ingestion-runs', `${run.id}.json`), next);
  writeJson(path.join(root, '.omx/ingestion-runs/latest.json'), next);
  return { next, counts };
}

if (has('--list')) {
  const limit = num('--limit', 10);
  const pending = readSidecars()
    .map(({ item }) => item)
    .filter((item) => !item.xSearch || item.xSearch.status === 'pending')
    .slice(0, limit)
    .map((item) => ({
      statusId: item.status.id,
      statusUrl: item.status.url,
      sourceCard: item.sourceCard,
      query: item.xSearch?.query || `conversation_id:${item.status.id}`,
      enable_image_understanding: item.xSearch?.enable_image_understanding ?? true,
      browserExternalLinks: item.browserExternalLinks || [],
      replyLinks: item.replyFetch?.firstReplyLinks || [],
    }));
  console.log(JSON.stringify({ ok: true, runId: run.id, pending }, null, 2));
  process.exit(0);
}

const statusId = arg('--status-id');
if (!statusId) {
  console.error(JSON.stringify({ ok: false, error: 'missing --status-id or --list' }, null, 2));
  process.exit(2);
}
const hit = readSidecars().find(({ item }) => item.status?.id === statusId);
if (!hit) {
  console.error(JSON.stringify({ ok: false, error: `sidecar not found for status ${statusId}` }, null, 2));
  process.exit(2);
}

const answerFile = arg('--answer-file');
const answer = answerFile ? fs.readFileSync(answerFile, 'utf8').trim() : arg('--answer');
if (!answer) {
  console.error(JSON.stringify({ ok: false, error: 'missing --answer or --answer-file' }, null, 2));
  process.exit(2);
}
const query = arg('--query', hit.item.xSearch?.query || `conversation_id:${statusId}`);
const citations = Array.from(new Set([...parseCsv(arg('--citations')), ...extractCitations(answer)]));
const checkedAt = new Date().toISOString();
const nextSidecar = {
  ...hit.item,
  xSearch: {
    ...(hit.item.xSearch || {}),
    status: 'ok',
    query,
    answer,
    citations,
    checkedAt,
    provider: arg('--provider', 'grok/x_search'),
  },
  updatedAt: checkedAt,
};
writeJson(hit.file, nextSidecar);
const { counts } = writeRunStatus({ stage: 'xsearch_enrichment' });
console.log(JSON.stringify({ ok: true, runId: run.id, statusId, xSearchOk: counts.xSearchOk, pending: counts.pending, sidecar: path.relative(root, hit.file) }, null, 2));
