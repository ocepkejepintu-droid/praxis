#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const runArg = process.argv.includes('--run') ? process.argv[process.argv.indexOf('--run') + 1] : 'latest';
const runPath = runArg === 'latest' ? path.join(root, '.omx/ingestion-runs/latest.json') : path.join(root, '.omx/ingestion-runs', `${runArg}.json`);
const run = JSON.parse(fs.readFileSync(runPath, 'utf8'));
const runDir = path.join(root, '.omx/ingestion-runs', run.id);
const enrichedDir = path.join(runDir, 'enriched');
const mergedPath = path.join(runDir, 'merged.json');

function readJsonSafe(p: string) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }
function writeRun(next: any) {
  fs.writeFileSync(path.join(root, '.omx/ingestion-runs', `${run.id}.json`), JSON.stringify(next, null, 2));
  fs.writeFileSync(path.join(root, '.omx/ingestion-runs', 'latest.json'), JSON.stringify(next, null, 2));
}
function sidecarCounts() {
  const files = fs.existsSync(enrichedDir) ? fs.readdirSync(enrichedDir).filter(f => f.endsWith('.json')) : [];
  const items = files.map((f) => readJsonSafe(path.join(enrichedDir, f))).filter(Boolean) as any[];
  return {
    pending: items.filter((item) => !item.xSearch || item.xSearch.status === 'pending').length,
    xSearchOk: items.filter((item) => item.xSearch?.status === 'ok' || item.xSearch?.answer).length,
    replyFetchOk: items.filter((item) => item.replyFetch?.status === 'ok').length,
    replyFetchFailed: items.filter((item) => item.replyFetch?.status === 'failed').length,
  };
}
function cardText(rel: string) { try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch { return ''; } }
function classify(text: string, enriched: any) {
  const joined = `${text}\n${JSON.stringify(enriched)}`;
  if (/\b(sponsored|promoted|paid ad|advertisement|airdrop|testnet farming)\b/i.test(joined)) return 'ignore';
  if (/scorio|tournament|padel|bracket|sports/i.test(joined)) return 'scorio';
  if (/github\.com|repo|open source|sdk|mcp|cli/i.test(joined)) return 'experiment';
  if (/launch|released|now supports|beta|preview|new version|changelog|rolled out/i.test(joined)) return 'new-feature-update';
  if (/agent|browser|computer use|workflow|automation|context compaction/i.test(joined)) return 'idea';
  return 'inbox';
}

const files = fs.existsSync(enrichedDir) ? fs.readdirSync(enrichedDir).filter(f => f.endsWith('.json')) : [];
const merged = files.map(f => {
  const e = readJsonSafe(path.join(enrichedDir, f));
  const text = cardText(e?.sourceCard || '');
  const reply = e?.replyFetch?.path ? readJsonSafe(path.join(runDir, e.replyFetch.path)) : null;
  return { statusId: e?.status?.id, statusUrl: e?.status?.url, sourceCard: e?.sourceCard, bucket: classify(text, { ...e, reply }), browserMarkdown: text, enrichment: e, replyFetch: reply };
}).filter(x => x.statusId);

const buckets = merged.reduce((acc: any, x) => { (acc[x.bucket] ||= []).push(x); return acc; }, {});
fs.writeFileSync(mergedPath, JSON.stringify({ runId: run.id, mergedAt: new Date().toISOString(), count: merged.length, buckets: Object.fromEntries(Object.entries(buckets).map(([k,v]: any) => [k, v.length])), items: merged }, null, 2));
writeRun({
  ...run,
  stage: 'judge',
  status: run.status === 'failed' || run.status === 'blocked' ? 'partial' : run.status,
  finishedAt: new Date().toISOString(),
  progress: {
    ...run.progress,
    merged: merged.length,
    judged: merged.length,
    xSearchEnriched: sidecarCounts().xSearchOk,
  },
  sidecars: sidecarCounts(),
  paths: {
    ...run.paths,
    enrichedDir: path.relative(root, enrichedDir),
    merged: path.relative(root, mergedPath),
  },
  agent_ready: Boolean((run.files || []).length && fs.existsSync(mergedPath) && merged.length > 0),
});
console.log(JSON.stringify({ ok: true, runId: run.id, merged: merged.length, buckets: Object.fromEntries(Object.entries(buckets).map(([k,v]: any) => [k, v.length])), mergedPath }, null, 2));
