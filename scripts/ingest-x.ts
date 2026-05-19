#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  createCardsFromXSignals,
  createDryRunCards,
  ensureIngestionDirs,
  validateCard,
  writeCards,
  writeRunStatus,
  type IngestionCrawlStats,
  type IngestionRunStatus,
  type KimiHealth,
  type XSignal,
} from '../src/lib/ingestion.ts';

type CliOptions = {
  dryRun: boolean;
  noWrite: boolean;
  healthOnly: boolean;
  help: boolean;
  maxScrolls: number;
  maxCards: number;
  minDurationMinutes: number;
};

type RawKimiHealth = Partial<KimiHealth> & {
  extensionConnected?: boolean;
  extension_connected?: boolean;
};

const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);
const ROOT = process.cwd();

function numberArg(name: string, fallback: number) {
  const prefix = `${name}=`;
  const inline = rawArgs.find((arg) => arg.startsWith(prefix));
  const separate = rawArgs.findIndex((arg) => arg === name);
  const raw = inline ? inline.slice(prefix.length) : separate >= 0 ? rawArgs[separate + 1] : undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const options: CliOptions = {
  dryRun: args.has('--dry-run'),
  noWrite: args.has('--no-write'),
  healthOnly: args.has('--health'),
  help: args.has('--help') || args.has('-h'),
  maxScrolls: Math.min(numberArg('--max-scrolls', 18), 80),
  maxCards: Math.min(numberArg('--max-cards', 40), 120),
  minDurationMinutes: Math.min(numberArg('--min-duration-minutes', 10), 180),
};
const unknownArgs = rawArgs.filter((arg, index) => {
  if (['--dry-run', '--no-write', '--health', '--help', '-h'].includes(arg)) return false;
  if (arg.startsWith('--max-scrolls=') || arg.startsWith('--max-cards=') || arg.startsWith('--min-duration-minutes=')) return false;
  if (rawArgs[index - 1] === '--max-scrolls' || rawArgs[index - 1] === '--max-cards' || rawArgs[index - 1] === '--min-duration-minutes') return false;
  if (arg === '--max-scrolls' || arg === '--max-cards' || arg === '--min-duration-minutes') return false;
  return true;
});
const startedAt = new Date();
const date = startedAt.toISOString().slice(0, 10);
const runId = `${date}-${startedAt.toISOString().replace(/[:.]/g, '-').slice(11, 23)}`;
const kimiBin = process.env.KIMI_WEBBRIDGE_BIN || '/Users/yoseph/.hermes/profiles/dev/home/.kimi-webbridge/bin/kimi-webbridge';
const kimiBaseUrl = process.env.KIMI_WEBBRIDGE_URL || 'http://127.0.0.1:10086';
const xSource = process.env.AGENT_RADAR_X_SOURCE === 'search' || process.env.AGENT_RADAR_X_QUERY ? 'search' : 'home';
const xSearchQuery = process.env.AGENT_RADAR_X_QUERY;
const xTargetUrl = xSource === 'search' && xSearchQuery
  ? `https://x.com/search?q=${encodeURIComponent(xSearchQuery)}&src=typed_query&f=live`
  : 'https://x.com/home';

function printHelp() {
  console.log(`Usage: npm run ingest:x -- [--dry-run] [--no-write] [--health] [--max-scrolls N] [--max-cards N] [--min-duration-minutes N]\n\nOptions:\n  --dry-run   Write deterministic preview cards/status under .omx/ingestion-runs/.\n  --no-write  Validate and report status without writing Markdown cards. Status JSON is still written.\n  --health    Print Kimi WebBridge daemon/extension readiness and exit.\n  --max-scrolls N  Live crawl scroll depth. Default: 18, max: 80.
  --max-cards N    Max Markdown cards to write. Default: 40, max: 120.
  --min-duration-minutes N  Minimum live doomscroll time. Default: 60, max: 180.
  --help      Show this help.\n\nEnvironment:\n  KIMI_WEBBRIDGE_BIN  Path to kimi-webbridge CLI. Default: /Users/yoseph/.hermes/profiles/dev/home/.kimi-webbridge/bin/kimi-webbridge\n  KIMI_WEBBRIDGE_URL  WebBridge command endpoint origin. Default: http://127.0.0.1:10086`);
}

function normalizeKimiHealth(parsed: RawKimiHealth): KimiHealth {
  return {
    running: Boolean(parsed.running),
    extension_connected: Boolean(parsed.extension_connected ?? parsed.extensionConnected),
    extension_version: parsed.extension_version,
    version: parsed.version,
    port: parsed.port,
    bin: kimiBin,
    baseUrl: kimiBaseUrl,
  };
}

function readKimiHealth(): KimiHealth {
  try {
    const raw = execFileSync(kimiBin, ['status'], { encoding: 'utf8' });
    return normalizeKimiHealth(JSON.parse(raw) as RawKimiHealth);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      running: false,
      extension_connected: false,
      error: `Unable to read Kimi WebBridge status from ${kimiBin}: ${message}`,
      bin: kimiBin,
      baseUrl: kimiBaseUrl,
    };
  }
}

function healthMessage(health: KimiHealth) {
  if (health.running && health.extension_connected) return 'Kimi WebBridge is ready for live X crawling.';
  if (health.running) return 'Kimi WebBridge daemon is running, but the browser extension is not connected.';
  return 'Kimi WebBridge daemon is not running or the CLI status check failed.';
}

async function kimiCommand(action: string, commandArgs: Record<string, unknown>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300_000);
  const response = await fetch(`${kimiBaseUrl}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, args: commandArgs, session: 'agent-radar-x-ingest' }),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));
  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!response.ok) {
    const detail = parsed && typeof parsed === 'object' ? JSON.stringify(parsed).slice(0, 500) : text.slice(0, 500);
    throw new Error(`Kimi WebBridge ${action} failed: HTTP ${response.status}${detail ? ` ${detail}` : ''}`);
  }
  return parsed;
}

async function kimiCommandWithRetry(action: string, commandArgs: Record<string, unknown>, attempts = 3) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await kimiCommand(action, commandArgs);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('HTTP 502') || attempt === attempts) break;
      await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
    }
  }
  throw lastError;
}

function commandValue<T>(result: unknown): T {
  if (result && typeof result === 'object') {
    if ('data' in result) {
      const data = (result as { data?: unknown }).data;
      if (data && typeof data === 'object' && 'value' in data) return (data as { value: T }).value;
      return data as T;
    }
    if ('value' in result) return (result as { value: T }).value;
  }
  return result as T;
}

function isXSignal(value: unknown): value is XSignal {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<XSignal>;
  return typeof candidate.text === 'string' && Array.isArray(candidate.urls);
}

async function extractXSignals(): Promise<{ signals: XSignal[]; visibleUrl: string; title?: string; stats: IngestionCrawlStats }> {
  const crawlStarted = Date.now();
  // Reuse the existing X tab. Do not open a fresh tab on every ingestion/farm attempt.
  await kimiCommandWithRetry('find_tab', { url: 'https://x.com', active: true }).catch(() => null);
  await kimiCommandWithRetry('navigate', { url: xTargetUrl, newTab: false, group_title: 'Agent Radar X ingest' });
  await kimiCommandWithRetry('find_tab', { url: 'https://x.com', active: true }).catch(() => null);
  await new Promise((resolve) => setTimeout(resolve, 6500));
  const extractionJs = `
    (async function() {
      const maxScrolls = __MAX_SCROLLS__;
      const settleMs = 1200;
      const clean = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
      const normalizeUrl = (href) => {
        try {
          const url = new URL(href, location.href);
          if (url.pathname.includes('/photo/') || url.pathname.includes('/analytics')) return '';
          if (url.pathname.includes('/i/status/compose')) return '';
          return url.href;
        } catch {
          return '';
        }
      };
      const postKey = (node, text, urls) => {
        const status = Array.from(node.querySelectorAll('a[href]')).map((anchor) => normalizeUrl(anchor.getAttribute('href'))).find((href) => href.includes('/status/') && /\\d+/.test(href));
        return status || urls.join('|') || text.toLowerCase().slice(0, 180);
      };
      const collect = () => {
        const nodes = Array.from(document.querySelectorAll('article, [data-testid="tweet"]')).slice(0, 60);
        return nodes.map((node) => {
          const text = clean(node.innerText || node.textContent);
          const authorNode = node.querySelector('[data-testid="User-Name"]');
          const urls = Array.from(node.querySelectorAll('a[href]')).map((anchor) => normalizeUrl(anchor.getAttribute('href'))).filter(Boolean);
          return { id: postKey(node, text, urls), text, author: clean(authorNode && (authorNode.innerText || authorNode.textContent)), urls, capturedAt: new Date().toISOString() };
        }).filter((item) => item.text.length > 40);
      };
      const openFirstReplyLinks = async () => {
        const candidates = collect()
          .filter((item) => item.id && item.id.includes('/status/'))
          .filter((item) => !item.urls.some((url) => url.includes('github.com')))
          .slice(0, 3);
        const replySignals = [];
        const currentUrl = location.href;
        for (const item of candidates) {
          const statusUrl = item.id;
          try {
            history.pushState(null, '', statusUrl);
            window.dispatchEvent(new PopStateEvent('popstate'));
            await new Promise((resolve) => setTimeout(resolve, 5000 + Math.floor(Math.random() * 5000)));
            const articles = Array.from(document.querySelectorAll('article, [data-testid="tweet"]')).slice(0, 8);
            for (const node of articles) {
              const text = clean(node.innerText || node.textContent);
              const urls = Array.from(node.querySelectorAll('a[href]')).map((anchor) => normalizeUrl(anchor.getAttribute('href'))).filter(Boolean);
              if (text.length > 40 && urls.length) {
                const authorNode = node.querySelector('[data-testid="User-Name"]');
                replySignals.push({ id: postKey(node, text, urls), text, author: clean(authorNode && (authorNode.innerText || authorNode.textContent)), urls, capturedAt: new Date().toISOString() });
              }
            }
          } catch {}
        }
        try {
          history.pushState(null, '', currentUrl);
          window.dispatchEvent(new PopStateEvent('popstate'));
          await new Promise((resolve) => setTimeout(resolve, 1200));
        } catch {}
        return replySignals;
      };
      const seen = new Map();
      let stableScrolls = 0;
      let lastHeight = 0;
      let completed = 0;
      for (let i = 0; i <= maxScrolls; i += 1) {
        completed = i;
        for (const item of collect()) if (!seen.has(item.id)) seen.set(item.id, item);
        const before = seen.size;
        const height = document.scrollingElement ? document.scrollingElement.scrollHeight : document.body.scrollHeight;
        window.scrollBy(0, Math.max(900, Math.floor(window.innerHeight * 1.35)));
        await new Promise((resolve) => setTimeout(resolve, settleMs));
        for (const item of collect()) if (!seen.has(item.id)) seen.set(item.id, item);
        for (const item of await openFirstReplyLinks()) if (!seen.has(item.id)) seen.set(item.id, item);
        const after = seen.size;
        const newHeight = document.scrollingElement ? document.scrollingElement.scrollHeight : document.body.scrollHeight;
        stableScrolls = after === before && newHeight === lastHeight ? stableScrolls + 1 : 0;
        lastHeight = newHeight || height;
        if (stableScrolls >= 4 && seen.size > 0) break;
      }
      if (!seen.size) {
        seen.set('visible-page', { id: 'visible-page', text: clean(document.body && (document.body.innerText || document.body.textContent)).slice(0, 3000), author: 'visible-page', urls: Array.from(document.querySelectorAll('a[href]')).slice(0, 80).map((anchor) => normalizeUrl(anchor.getAttribute('href'))).filter(Boolean), capturedAt: new Date().toISOString() });
      }
      return { url: location.href, title: document.title, scrollsCompleted: completed, items: Array.from(seen.values()) };
    })()
  `;
  const seenSignals = new Map<string, XSignal>();
  let visibleUrl = xTargetUrl;
  let title: string | undefined;
  let scrollsCompleted = 0;
  const scrollsPerRound = 1;
  const minDurationMs = options.minDurationMinutes * 60_000;

  while (scrollsCompleted < options.maxScrolls || Date.now() - crawlStarted < minDurationMs) {
    const remainingScrolls = Math.max(1, options.maxScrolls - scrollsCompleted);
    const roundScrolls = Math.min(scrollsPerRound, remainingScrolls);
    const roundJs = extractionJs.replace('__MAX_SCROLLS__', String(roundScrolls));
    try {
      const extracted = await kimiCommandWithRetry('evaluate', { code: roundJs }, 4);
      const value = commandValue<{ items?: unknown[]; url?: string; title?: string; scrollsCompleted?: number }>(extracted);
      visibleUrl = value.url || visibleUrl;
      title = value.title || title;
      const roundSignals = (Array.isArray(value.items) ? value.items : []).filter(isXSignal);
      for (const signal of roundSignals) {
        const key = signal.id || signal.urls.join('|') || signal.text.toLowerCase().slice(0, 180);
        if (!seenSignals.has(key)) seenSignals.set(key, signal);
      }
      scrollsCompleted += value.scrollsCompleted ?? roundScrolls;
    } catch (error) {
      if (seenSignals.size > 0) break;
      throw error;
    }
    if (Date.now() - crawlStarted < minDurationMs) await new Promise((resolve) => setTimeout(resolve, 10_000));
  }

  const signals = Array.from(seenSignals.values());
  return {
    signals,
    visibleUrl,
    title,
    stats: {
      searchUrl: visibleUrl,
      maxScrolls: options.maxScrolls,
      scrollsCompleted,
      signalsExtracted: signals.length,
      uniquePosts: signals.length,
      durationMs: Date.now() - crawlStarted,
    },
  };
}

function buildRunStatus(fields: Omit<IngestionRunStatus, 'id' | 'startedAt' | 'finishedAt'>): IngestionRunStatus {
  return {
    id: runId,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    ...fields,
  };
}

function statusIdsFromCards(cards: Array<{ statusId?: string; sourceStatusUrl?: string }>) {
  return cards
    .filter((card) => card.statusId && card.sourceStatusUrl)
    .map((card) => {
      const handle = card.sourceStatusUrl?.match(/x\.com\/([^/]+)\/status\//)?.[1] || 'unknown';
      return { handle, id: card.statusId, url: card.sourceStatusUrl };
    });
}

async function run() {
  if (options.help) {
    printHelp();
    return;
  }
  if (unknownArgs.length) {
    throw new Error(`Unknown arguments: ${unknownArgs.join(', ')}. Run npm run ingest:x -- --help for usage.`);
  }

  ensureIngestionDirs();
  const health = readKimiHealth();

  if (options.healthOnly) {
    const ready = health.running && health.extension_connected;
    console.log(JSON.stringify({ ready, message: healthMessage(health), health }, null, 2));
    if (!ready) process.exitCode = 2;
    return;
  }

  const verificationGaps: string[] = [];
  let cards = createDryRunCards();
  let status: IngestionRunStatus['status'] = 'ok';
  let crawlStats: IngestionCrawlStats | undefined;
  let message = options.noWrite
    ? 'Dry-run validated. No Markdown cards written because --no-write was set.'
    : 'Dry-run preview generated. Reconnect Kimi WebBridge extension for live X crawling.';

  if (!options.dryRun) {
    if (!health.running || !health.extension_connected) {
      status = 'blocked';
      message = `${healthMessage(health)} Start/reconnect Kimi WebBridge, then rerun npm run ingest:x.`;
      verificationGaps.push('Kimi WebBridge extension is not connected.');
      if (health.error) verificationGaps.push(health.error);
      cards = [];
    } else {
      const extraction = await extractXSignals();
      crawlStats = extraction.stats;
      cards = createCardsFromXSignals(extraction.signals, extraction.visibleUrl || xTargetUrl, options.maxCards);
      const extractedCount = extraction.signals.length;
      message = options.noWrite
        ? `Deep X crawl scrolled ${crawlStats?.scrollsCompleted ?? options.maxScrolls} times and extracted ${extractedCount} unique visible signals. No Markdown cards written because --no-write was set.`
        : `Deep X crawl scrolled ${crawlStats?.scrollsCompleted ?? options.maxScrolls} times, extracted ${extractedCount} unique visible signals, and wrote structured Markdown cards into local folders.`;
    }
  }

  for (const card of cards) verificationGaps.push(...validateCard(card));
  const rejectedCount = Math.max(0, (options.dryRun ? 3 : 0) - cards.length);
  const files = options.noWrite || status === 'blocked' ? [] : writeCards(cards, { dryRun: options.dryRun, runId, date, ingestedAt: startedAt.toISOString(), sourceChannel: options.dryRun ? 'dry_run' : xSource === 'search' ? 'x_search' : 'x_home' });
  const runDir = path.join(ROOT, '.omx', 'ingestion-runs', runId);
  const statusIds = statusIdsFromCards(cards);
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, 'status-ids.json'), JSON.stringify(statusIds, null, 2));
  const runStatus = buildRunStatus({
    mode: options.dryRun ? 'dry-run' : 'live',
    status,
    source: xSource,
    stage: 'discover',
    health,
    cardsCreated: files.length,
    rejectedCount,
    verificationGaps,
    files,
    message,
    crawlStats,
    progress: {
      scrollsCompleted: crawlStats?.scrollsCompleted,
      rawSignals: crawlStats?.signalsExtracted ?? cards.length,
      cardsWritten: files.length,
      statusIds: statusIds.length,
      xSearchEnriched: 0,
    },
    sidecars: {
      pending: statusIds.length,
      xSearchOk: 0,
      replyFetchOk: 0,
      replyFetchFailed: 0,
    },
    command: {
      maxCards: options.maxCards,
      maxScrolls: options.maxScrolls,
      minDurationMinutes: options.minDurationMinutes,
      source: xSource,
      query: xSearchQuery,
    },
    paths: {
      statusIds: path.relative(ROOT, path.join(runDir, 'status-ids.json')),
      enrichedDir: path.relative(ROOT, path.join(runDir, 'enriched')),
      replyFetchDir: path.relative(ROOT, path.join(runDir, 'reply-fetch')),
      merged: path.relative(ROOT, path.join(runDir, 'merged.json')),
      cards: files,
    },
    errors: verificationGaps,
    agent_ready: false,
  });
  const statusPath = writeRunStatus(runStatus);
  console.log(JSON.stringify({ ...runStatus, statusPath }, null, 2));
  if (status === 'blocked') process.exitCode = 2;
}

run().catch((error) => {
  const health = readKimiHealth();
  const failed = buildRunStatus({
    mode: options.dryRun ? 'dry-run' : 'live',
    status: 'failed',
    health,
    cardsCreated: 0,
    rejectedCount: 0,
    verificationGaps: [error instanceof Error ? error.message : String(error)],
    files: [],
    message: 'Ingestion run failed before cards were written.',
  });
  writeRunStatus(failed);
  console.error(JSON.stringify(failed, null, 2));
  process.exit(1);
});
