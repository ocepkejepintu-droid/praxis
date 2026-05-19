#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

type AnyRecord = Record<string, any>;

type Candidate = {
  rank: number;
  score: number;
  statusId: string;
  statusUrl: string;
  handle: string;
  sourceCard: string;
  query: string;
  enable_image_understanding: boolean;
  browserExternalLinks: string[];
  replyLinks: string[];
  reasons: string[];
  title: string;
  excerpt: string;
  hermesInstruction: string;
};

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
function readJsonSafe(p: string): AnyRecord | null {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}
function readTextSafe(p: string) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}
function arr(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];
}
function uniq(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}
function stripFrontmatter(markdown: string) {
  return markdown.replace(/^---[\s\S]*?---\s*/u, '').trim();
}
function titleFrom(markdown: string, fallback: string) {
  const body = stripFrontmatter(markdown);
  const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return heading || fallback;
}
function excerptFrom(markdown: string) {
  return stripFrontmatter(markdown).replace(/\s+/g, ' ').slice(0, 420).trim();
}
function extractUrls(text: string) {
  return Array.from(new Set(Array.from(text.matchAll(/https?:\/\/[^\s)\]"'>]+/g)).map((m) => m[0].replace(/[.,;]+$/, ''))));
}
function csv(values: string[]) {
  return uniq(values).join(',');
}

function resolveRun() {
  const runArg = arg('--run', 'latest');
  const runPath = runArg === 'latest'
    ? path.join(root, '.omx/ingestion-runs/latest.json')
    : path.join(root, '.omx/ingestion-runs', `${runArg}.json`);
  const run = readJsonSafe(runPath);
  if (!run?.id) throw new Error(`run not found: ${runPath}`);
  const runDir = path.join(root, '.omx/ingestion-runs', run.id);
  const enrichedDir = path.join(runDir, 'enriched');
  return { runArg, run, runDir, enrichedDir };
}

function readSidecars(enrichedDir: string) {
  if (!fs.existsSync(enrichedDir)) return [];
  return fs.readdirSync(enrichedDir)
    .filter((f) => f.endsWith('.json'))
    .map((file) => ({ file: path.join(enrichedDir, file), item: readJsonSafe(path.join(enrichedDir, file)) }))
    .filter((entry) => entry.item?.status?.id);
}

function skipReason(text: string, sidecar: AnyRecord) {
  const joined = `${text}\n${JSON.stringify(sidecar)}`;
  const links = [...arr(sidecar.browserExternalLinks), ...arr(sidecar.replyFetch?.firstReplyLinks)].join('\n');
  if (/\b(ad|ads|promoted|sponsored|paid social|advertisement)\b/i.test(joined) || /utm_(source|medium|campaign)|twclid=/i.test(links)) return 'ad_or_promoted';
  if (/\b(crypto|airdrop|testnet farming|trading bot|meme coin|memecoin|token presale|100x|claim\s+\$?\d+)\b/i.test(joined)) return 'crypto_spam';
  if (/\b(viral video|1 prompt|one prompt|copy.?paste|revenue bible|get rich|free gemini pro|claim .* free)\b/i.test(joined)) return 'viral_prompt_bait';
  return '';
}

function scoreCandidate(text: string, sidecar: AnyRecord) {
  const joined = `${text}\n${JSON.stringify(sidecar)}`;
  const reasons: string[] = [];
  let score = 0;
  const external = arr(sidecar.browserExternalLinks).filter((u) => !/pbs\.twimg\.com|video_thumb/i.test(u));
  const replies = arr(sidecar.replyFetch?.firstReplyLinks).filter((u) => !/twclid=|utm_campaign/i.test(u));

  const add = (points: number, reason: string) => { score += points; reasons.push(reason); };
  if (/github\.com|\brepo\b|open source|source code/i.test(joined)) add(8, 'repo/open-source signal');
  if (/\b(mcp|sdk|cli|api|plugin|extension|framework)\b/i.test(joined)) add(6, 'tooling/dependency signal');
  if (/\b(agent|codex|claude code|browser|computer use|automation|workflow|context|memory)\b/i.test(joined)) add(5, 'agent workflow signal');
  if (/\b(launch|released|now supports|beta|preview|changelog|rolled out|update)\b/i.test(joined)) add(3, 'product/update signal');
  if (external.length > 0) add(4, 'browser external link');
  if (replies.length > 0) add(5, 'first-reply external link');
  if (sidecar.replyFetch?.status === 'ok') add(2, 'reply context fetched');
  if ((sidecar.replyFetch?.mediaCount || 0) > 0) add(1, 'media context available');
  if (/\b(thread|tutorial|guide|how to|steps|demo)\b/i.test(joined)) add(2, 'execution-path clue');
  if (score === 0) add(1, 'pending unverified source');
  return { score, reasons };
}

function buildWorklist(limit: number) {
  const { run, runDir, enrichedDir } = resolveRun();
  const pending = readSidecars(enrichedDir)
    .map(({ item }) => item as AnyRecord)
    .filter((item) => !item.xSearch || item.xSearch.status === 'pending');

  const skipped: Record<string, number> = {};
  const candidates: Omit<Candidate, 'rank'>[] = [];
  for (const sidecar of pending) {
    const sourceCard = String(sidecar.sourceCard || '');
    const cardPath = path.join(root, sourceCard);
    const cardText = readTextSafe(cardPath);
    const reply = sidecar.replyFetch?.path ? readJsonSafe(path.join(runDir, sidecar.replyFetch.path)) : null;
    const text = `${cardText}\n${JSON.stringify(reply || {})}`;
    const reason = skipReason(text, sidecar);
    if (reason) {
      skipped[reason] = (skipped[reason] || 0) + 1;
      continue;
    }
    const scored = scoreCandidate(text, sidecar);
    const statusId = String(sidecar.status.id);
    const statusUrl = String(sidecar.status.url || `https://x.com/i/web/status/${statusId}`);
    const externalLinks = uniq([...arr(sidecar.browserExternalLinks), ...extractUrls(cardText)]).filter((u) => !/pbs\.twimg\.com|x\.com\//i.test(u));
    const replyLinks = uniq([...(reply?.firstReplyLinks || []), ...arr(sidecar.replyFetch?.firstReplyLinks)]).filter((u) => !/twclid=|utm_campaign/i.test(u));
    candidates.push({
      score: scored.score,
      statusId,
      statusUrl,
      handle: String(sidecar.status.handle || ''),
      sourceCard,
      query: String(sidecar.xSearch?.query || `conversation_id:${statusId}`),
      enable_image_understanding: sidecar.xSearch?.enable_image_understanding ?? true,
      browserExternalLinks: externalLinks,
      replyLinks,
      reasons: scored.reasons,
      title: titleFrom(cardText, sourceCard),
      excerpt: excerptFrom(cardText),
      hermesInstruction: `Run Hermes/x_search for query "${sidecar.xSearch?.query || `conversation_id:${statusId}`}" with image understanding enabled. Return JSON: {"statusId":"${statusId}","query":"${sidecar.xSearch?.query || `conversation_id:${statusId}`}","answer":"...","citations":["..."]}. Do not invent citations.`,
    });
  }

  const ranked = candidates
    .sort((a, b) => b.score - a.score || a.sourceCard.localeCompare(b.sourceCard))
    .slice(0, limit)
    .map((candidate, index) => ({ rank: index + 1, ...candidate } satisfies Candidate));

  return {
    ok: true,
    runId: run.id,
    mode: 'x_search_worklist',
    generatedAt: new Date().toISOString(),
    pending: pending.length,
    selected: ranked.length,
    skipped,
    candidates: ranked,
  };
}

function normalizeBatch(input: any): AnyRecord[] {
  if (Array.isArray(input)) return input;
  if (Array.isArray(input?.results)) return input.results;
  if (Array.isArray(input?.items)) return input.items;
  if (input?.statusId) return [input];
  return [];
}

function applyBatch(batchFile: string) {
  const { runArg } = resolveRun();
  const payload = readJsonSafe(path.resolve(root, batchFile));
  const results = normalizeBatch(payload);
  if (results.length === 0) throw new Error(`no results found in batch: ${batchFile}`);

  const fillScript = path.join(scriptDir, 'fill-xsearch-sidecars.ts');
  const applied = [];
  const failed = [];
  for (const result of results) {
    const statusId = String(result.statusId || result.status_id || result.id || '');
    const answer = String(result.answer || result.summary || '').trim();
    if (!statusId || !answer) {
      failed.push({ statusId, error: 'missing statusId or answer' });
      continue;
    }
    const tmp = path.join(os.tmpdir(), `agent-radar-xsearch-${statusId}-${Date.now()}.txt`);
    fs.writeFileSync(tmp, answer);
    try {
      const output = execFileSync(process.execPath, [
        '--experimental-strip-types',
        fillScript,
        '--run', runArg,
        '--status-id', statusId,
        '--query', String(result.query || `conversation_id:${statusId}`),
        '--answer-file', tmp,
        '--citations', csv(arr(result.citations || result.sources || result.sourceUrls)),
        '--provider', String(result.provider || 'grok/x_search'),
      ], { cwd: root, encoding: 'utf8' });
      applied.push(JSON.parse(output));
    } catch (error: any) {
      failed.push({ statusId, error: error?.stderr?.toString?.() || error?.message || String(error) });
    } finally {
      try { fs.unlinkSync(tmp); } catch {}
    }
  }
  return { ok: failed.length === 0, runId: resolveRun().run.id, appliedCount: applied.length, failedCount: failed.length, applied, failed };
}

try {
  const batchFile = arg('--apply') || arg('--batch-file');
  if (batchFile) {
    console.log(JSON.stringify(applyBatch(batchFile), null, 2));
    process.exit(0);
  }
  if (has('--list') || args.length === 0) {
    console.log(JSON.stringify(buildWorklist(num('--limit', 10)), null, 2));
    process.exit(0);
  }
  console.error(JSON.stringify({ ok: false, error: 'use --list or --apply <batch.json>' }, null, 2));
  process.exit(2);
} catch (error: any) {
  console.error(JSON.stringify({ ok: false, error: error?.message || String(error) }, null, 2));
  process.exit(2);
}
