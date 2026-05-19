#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  createCardsFromXSignals,
  ensureIngestionDirs,
  getIngestionRunDir,
  validateCard,
  writeCards,
  writeRunStatus,
  type IngestionRunStatus,
  type KimiHealth,
  type XSignal,
} from '../src/lib/ingestion.ts';

type RawKimiHealth = Partial<KimiHealth> & { extensionConnected?: boolean; extension_connected?: boolean };

const rawArgs = process.argv.slice(2);
function num(name: string, fallback: number) {
  const i = rawArgs.findIndex((a) => a === name);
  const inline = rawArgs.find((a) => a.startsWith(`${name}=`));
  const raw = inline ? inline.slice(name.length + 1) : i >= 0 ? rawArgs[i + 1] : undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

const maxCards = Math.min(num('--max-cards', 30), 300);
const maxRounds = Math.min(num('--rounds', 8), 80);
const scrollsPerRound = Math.min(num('--scrolls-per-round', 3), 8);
const pauseMs = Math.min(num('--pause-ms', 2500), 30000);
const startedAt = new Date();
const date = startedAt.toISOString().slice(0, 10);
const runId = `${date}-${startedAt.toISOString().replace(/[:.]/g, '-').slice(11, 23)}-fast`;
const kimiBin = process.env.KIMI_WEBBRIDGE_BIN || '/Users/yoseph/.hermes/profiles/dev/home/.kimi-webbridge/bin/kimi-webbridge';
const kimiBaseUrl = process.env.KIMI_WEBBRIDGE_URL || 'http://127.0.0.1:10086';
const xTargetUrl = 'https://x.com/home';
const runDir = path.join(getIngestionRunDir(), runId);
const rawSignalsPath = path.join(runDir, 'raw-signals.jsonl');
const statusIdsPath = path.join(runDir, 'status-ids.json');

function runPaths(files: string[] = []) {
  return {
    rawSignals: path.relative(process.cwd(), rawSignalsPath),
    statusIds: path.relative(process.cwd(), statusIdsPath),
    enrichedDir: path.relative(process.cwd(), path.join(runDir, 'enriched')),
    replyFetchDir: path.relative(process.cwd(), path.join(runDir, 'reply-fetch')),
    merged: path.relative(process.cwd(), path.join(runDir, 'merged.json')),
    cards: files,
  };
}

function agentReady(status: IngestionRunStatus['status'], files: string[]) {
  return (status === 'ok' || status === 'partial') && files.length > 0 && fs.existsSync(path.join(runDir, 'merged.json'));
}

function extractStatusIds(signals: XSignal[]) {
  const seen = new Map<string, { handle: string; id: string; url: string }>();
  for (const signal of signals) {
    const joined = [signal.id, ...signal.urls].filter(Boolean).join(' ');
    const match = joined.match(/https?:\/\/(?:x|twitter)\.com\/([^\/\s]+)\/status\/(\d+)/i);
    if (!match) continue;
    seen.set(match[2], { handle: match[1], id: match[2], url: `https://x.com/${match[1]}/status/${match[2]}` });
  }
  return Array.from(seen.values());
}

function persistRunInputs(signals: XSignal[]) {
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(rawSignalsPath, signals.map((signal) => JSON.stringify(signal)).join('\n'));
  fs.writeFileSync(statusIdsPath, JSON.stringify(extractStatusIds(signals), null, 2));
}

function stagedStatus(input: {
  status: IngestionRunStatus['status'];
  health: KimiHealth;
  files: string[];
  cardsWritten: number;
  seenCount: number;
  rejectedCount: number;
  verificationGaps: string[];
  message: string;
  scrollsCompleted?: number;
  roundsCompleted?: number;
  stage?: IngestionRunStatus['stage'];
  errors?: string[];
  visibleUrl?: string;
}): IngestionRunStatus {
  const statusIds = extractStatusIds(Array.from(seenForStatus.values())).length;
  return {
    id: runId,
    source: 'home',
    stage: input.stage || 'discover',
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    mode: 'live',
    status: input.status,
    health: input.health,
    cardsCreated: input.cardsWritten,
    rejectedCount: input.rejectedCount,
    verificationGaps: input.verificationGaps,
    files: input.files,
    message: input.message,
    crawlStats: {
      searchUrl: input.visibleUrl || xTargetUrl,
      maxScrolls: maxRounds * scrollsPerRound,
      scrollsCompleted: input.scrollsCompleted,
      signalsExtracted: input.seenCount,
      uniquePosts: input.seenCount,
      durationMs: Date.now() - startedAt.getTime(),
    },
    progress: {
      roundsCompleted: input.roundsCompleted,
      scrollsCompleted: input.scrollsCompleted,
      rawSignals: input.seenCount,
      cardsWritten: input.cardsWritten,
      statusIds,
      xSearchEnriched: 0,
    },
    sidecars: {
      pending: statusIds,
      xSearchOk: 0,
      replyFetchOk: 0,
      replyFetchFailed: 0,
    },
    command: {
      maxCards,
      rounds: maxRounds,
      scrollsPerRound,
      pauseMs,
      source: 'home',
    },
    paths: runPaths(input.files),
    errors: input.errors || [],
    agent_ready: agentReady(input.status, input.files),
  };
}

const seenForStatus = new Map<string, XSignal>();

function readKimiHealth(): KimiHealth {
  try {
    const parsed = JSON.parse(execFileSync(kimiBin, ['status'], { encoding: 'utf8' })) as RawKimiHealth;
    return { running: Boolean(parsed.running), extension_connected: Boolean(parsed.extension_connected ?? parsed.extensionConnected), extension_version: parsed.extension_version, version: parsed.version, port: parsed.port, bin: kimiBin, baseUrl: kimiBaseUrl };
  } catch (error) {
    return { running: false, extension_connected: false, error: error instanceof Error ? error.message : String(error), bin: kimiBin, baseUrl: kimiBaseUrl };
  }
}

async function kimiCommand(action: string, args: Record<string, unknown>, timeoutMs = 45000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${kimiBaseUrl}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, args, session: 'x-digest-main' }),
      signal: controller.signal,
    });
    const text = await res.text();
    let parsed: any = null;
    try { parsed = text ? JSON.parse(text) : null; } catch {}
    if (!res.ok) throw new Error(`HTTP ${res.status} ${text.slice(0, 300)}`);
    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}

function value<T>(result: any): T {
  if (result?.data?.value !== undefined) return result.data.value as T;
  if (result?.data !== undefined) return result.data as T;
  if (result?.value !== undefined) return result.value as T;
  return result as T;
}

function isSignal(v: unknown): v is XSignal {
  return Boolean(v && typeof v === 'object' && typeof (v as any).text === 'string' && Array.isArray((v as any).urls));
}

type PageProbe = { url?: string; title?: string; text?: string; articles?: number; tweets?: number };

const pageProbeJs = `
(() => ({
  url: location.href,
  title: document.title,
  text: String(document.body?.innerText || '').slice(0, 500),
  articles: document.querySelectorAll('article').length,
  tweets: document.querySelectorAll('[data-testid="tweet"]').length,
}))()`;

async function waitForTimeline(maxAttempts = 4) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const probe = value<PageProbe>(await kimiCommand('evaluate', { code: pageProbeJs }, 30000));
    if ((probe.articles || 0) > 0 || (probe.tweets || 0) > 0) return probe;
    if (/login|sign in/i.test(probe.text || '') || /login/i.test(probe.url || '')) return probe;
    if (attempt === 2) await kimiCommand('navigate', { url: xTargetUrl, newTab: false, group_title: 'Agent Radar X fast ingest' }, 30000).catch(() => null);
    await new Promise((r) => setTimeout(r, 2500));
  }
  return value<PageProbe>(await kimiCommand('evaluate', { code: pageProbeJs }, 30000));
}

const collectJs = (scrolls: number) => `
(async () => {
  const clean = v => String(v || '').replace(/\\s+/g, ' ').trim();
  const norm = href => { try { const u = new URL(href, location.href); if (u.pathname.includes('/photo/') || u.pathname.includes('/analytics') || u.pathname.includes('/compose')) return ''; return u.href; } catch { return ''; } };
  const collect = () => Array.from(document.querySelectorAll('article, [data-testid="tweet"]')).slice(0, 80).map(node => {
    const text = clean(node.innerText || node.textContent);
    const authorNode = node.querySelector('[data-testid="User-Name"]');
    const urls = Array.from(node.querySelectorAll('a[href]')).map(a => norm(a.getAttribute('href'))).filter(Boolean);
    const status = urls.find(u => /x\\.com\\/[^/]+\\/status\\/\\d+/.test(u)) || '';
    const images = Array.from(node.querySelectorAll('img')).map(img => ({ src: img.src, alt: img.alt })).filter(x => x.src && !x.src.includes('profile_images')).slice(0, 4);
    return { id: status || urls.join('|') || text.toLowerCase().slice(0, 180), text: text + (images.length ? '\\n\\nMedia: ' + images.map(i => i.alt || i.src).join(' | ') : ''), author: clean(authorNode && (authorNode.innerText || authorNode.textContent)), urls, capturedAt: new Date().toISOString() };
  }).filter(x => x.text.length > 40);
  const seen = new Map();
  for (let i = 0; i < ${scrolls}; i++) {
    for (const item of collect()) if (!seen.has(item.id)) seen.set(item.id, item);
    window.scrollBy(0, Math.max(900, Math.floor(window.innerHeight * 1.8)));
    await new Promise(r => setTimeout(r, 900));
  }
  for (const item of collect()) if (!seen.has(item.id)) seen.set(item.id, item);
  return { url: location.href, title: document.title, items: Array.from(seen.values()) };
})()`;

async function run() {
  ensureIngestionDirs();
  const health = readKimiHealth();
  if (!health.running || !health.extension_connected) {
    const failed: IngestionRunStatus = { id: runId, startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(), mode: 'live', status: 'blocked', health, cardsCreated: 0, rejectedCount: 0, verificationGaps: ['Kimi WebBridge not connected'], files: [], message: 'Kimi WebBridge not connected' };
    writeRunStatus(failed);
    console.log(JSON.stringify(failed, null, 2));
    process.exit(2);
  }

  await kimiCommand('find_tab', { url: 'https://x.com', active: true }).catch(() => null);
  await kimiCommand('navigate', { url: xTargetUrl, newTab: false, group_title: 'Agent Radar X fast ingest' }, 30000);
  await new Promise((r) => setTimeout(r, 5500));
  const initialProbe = await waitForTimeline();
  if ((initialProbe.articles || 0) === 0 && (initialProbe.tweets || 0) === 0) {
    const failed: IngestionRunStatus = {
      id: runId,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      mode: 'live',
      status: 'blocked',
      health,
      cardsCreated: 0,
      rejectedCount: 0,
      verificationGaps: [`X timeline not ready: ${initialProbe.url || xTargetUrl} ${String(initialProbe.text || '').slice(0, 180)}`],
      files: [],
      message: 'X timeline loaded without visible tweet articles; not writing fallback no-signal card.',
      errors: ['x_timeline_not_ready'],
    };
    writeRunStatus(failed);
    console.log(JSON.stringify(failed, null, 2));
    process.exit(3);
  }

  const seen = new Map<string, XSignal>();
  let visibleUrl = xTargetUrl;
  let scrollsCompleted = 0;
  let files: string[] = [];
  let cardsWritten = 0;

  for (let round = 1; round <= maxRounds && cardsWritten < maxCards; round++) {
    const extracted = await kimiCommand('evaluate', { code: collectJs(scrollsPerRound) }, 60000);
    const out = value<{ url?: string; items?: unknown[] }>(extracted);
    visibleUrl = out.url || visibleUrl;
    const roundSignals = (Array.isArray(out.items) ? out.items : []).filter(isSignal);
    for (const s of roundSignals) {
      const key = s.id || s.urls.join('|') || s.text.toLowerCase().slice(0, 180);
      if (!seen.has(key)) seen.set(key, s);
    }
    scrollsCompleted += scrollsPerRound;
    for (const [key, signal] of seen.entries()) seenForStatus.set(key, signal);
    persistRunInputs(Array.from(seen.values()));
    const cards = createCardsFromXSignals(Array.from(seen.values()), visibleUrl, maxCards);
    const gaps = cards.flatMap(validateCard);
    files = writeCards(cards, { runId, date, ingestedAt: startedAt.toISOString(), sourceChannel: 'x_home' });
    cardsWritten = files.length;
    const status = stagedStatus({ status: 'running', health, files, cardsWritten, seenCount: seen.size, rejectedCount: Math.max(0, seen.size - cardsWritten), verificationGaps: gaps, message: `FAST progress round ${round}/${maxRounds}: ${seen.size} unique signals, ${cardsWritten} cards written.`, scrollsCompleted, roundsCompleted: round, visibleUrl });
    writeRunStatus(status);
    console.log(status.message);
    if (cardsWritten >= maxCards) break;
    await new Promise((r) => setTimeout(r, pauseMs));
  }

  for (const [key, signal] of seen.entries()) seenForStatus.set(key, signal);
  persistRunInputs(Array.from(seen.values()));
  const status = stagedStatus({ status: 'ok', health: readKimiHealth(), files, cardsWritten, seenCount: seen.size, rejectedCount: Math.max(0, seen.size - cardsWritten), verificationGaps: [], message: `FAST complete: ${seen.size} unique signals, ${cardsWritten} cards written.`, scrollsCompleted, roundsCompleted: Math.ceil(scrollsCompleted / scrollsPerRound), visibleUrl });
  const statusPath = writeRunStatus(status);
  console.log(JSON.stringify({ ...status, statusPath }, null, 2));
}

run().catch((error) => {
  const health = readKimiHealth();
  const existingFiles = fs.existsSync(runDir) ? [] : [];
  const status = stagedStatus({ status: existingFiles.length ? 'partial' : 'failed', health, files: existingFiles, cardsWritten: existingFiles.length, seenCount: 0, rejectedCount: 0, verificationGaps: [error instanceof Error ? error.message : String(error)], message: existingFiles.length ? 'Fast ingestion stopped with partial persisted data.' : 'Fast ingestion failed before completion.', errors: [error instanceof Error ? error.message : String(error)] });
  writeRunStatus(status);
  console.error(JSON.stringify(status, null, 2));
  process.exit(1);
});
