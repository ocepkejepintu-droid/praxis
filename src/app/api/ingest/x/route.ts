import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ROOT = process.cwd();
const RUN_DIR = path.join(ROOT, '.omx', 'ingestion-runs');
const LOCK_FILE = path.join(RUN_DIR, 'active.lock.json');
const TIMEOUT_MS = 75 * 60_000;

type TriggerBody = {
  mode?: 'live' | 'dry-run' | 'health';
  maxScrolls?: number;
  maxCards?: number;
  minDurationMinutes?: number;
  query?: string;
  source?: 'home' | 'search';
};

export type IngestionTriggerOptions = Required<Pick<TriggerBody, 'mode' | 'source'>> & Pick<TriggerBody, 'maxScrolls' | 'maxCards' | 'minDurationMinutes' | 'query'>;

function isPidAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireLock() {
  fs.mkdirSync(RUN_DIR, { recursive: true });
  if (fs.existsSync(LOCK_FILE)) {
    try {
      const lock = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8')) as { pid?: number; startedAt?: string };
      if (lock.pid && isPidAlive(lock.pid)) return { ok: false as const, lock };
    } catch {
      // Stale or corrupt lock; replace it below.
    }
    fs.rmSync(LOCK_FILE, { force: true });
  }
  const lock = { pid: process.pid, startedAt: new Date().toISOString() };
  fs.writeFileSync(LOCK_FILE, JSON.stringify(lock, null, 2), { flag: 'wx' });
  return { ok: true as const, lock };
}

function releaseLock() {
  fs.rmSync(LOCK_FILE, { force: true });
}

function boundedInteger(value: unknown, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function normalizeOptions(body: TriggerBody): IngestionTriggerOptions {
  return {
    mode: body.mode === 'dry-run' || body.mode === 'health' ? body.mode : 'live',
    maxScrolls: boundedInteger(body.maxScrolls, 18, 80),
    maxCards: boundedInteger(body.maxCards, 40, 120),
    minDurationMinutes: boundedInteger(body.minDurationMinutes, 60, 180),
    query: typeof body.query === 'string' && body.query.trim() ? body.query.trim().slice(0, 240) : undefined,
    source: body.source === 'search' ? 'search' : 'home',
  };
}

function parseScriptJson(stdout: string) {
  try {
    return JSON.parse(stdout.trim()) as unknown;
  } catch {
    return null;
  }
}

async function runIngestion(options: IngestionTriggerOptions) {
  const args = ['--experimental-strip-types', 'scripts/ingest-x.ts'];
  if (options.mode === 'dry-run') args.push('--dry-run');
  if (options.mode === 'health') args.push('--health');
  if (options.mode === 'live') args.push('--max-scrolls', String(options.maxScrolls), '--max-cards', String(options.maxCards), '--min-duration-minutes', String(options.minDurationMinutes));

  return new Promise<{ exitCode: number | null; stdout: string; stderr: string; timedOut: boolean }>((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      env: {
        ...process.env,
        HOME: process.env.HOME || '/Users/yoseph',
        KIMI_WEBBRIDGE_BIN: process.env.KIMI_WEBBRIDGE_BIN || '/Users/yoseph/.kimi-webbridge/bin/kimi-webbridge',
        AGENT_RADAR_X_SOURCE: options.source,
        ...(options.query ? { AGENT_RADAR_X_QUERY: options.query } : {}),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      resolve({ exitCode: null, stdout, stderr, timedOut: true });
    }, TIMEOUT_MS);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ exitCode, stdout, stderr, timedOut: false });
    });
  });
}

export async function POST(request: Request) {
  let body: TriggerBody = {};
  try {
    body = await request.json() as TriggerBody;
  } catch {
    body = {};
  }
  const options = normalizeOptions(body);
  const lock = acquireLock();
  if (!lock.ok) {
    return NextResponse.json({ ok: false, status: 'running', message: 'Ingestion is already running.', lock: lock.lock }, { status: 409 });
  }

  try {
    const result = await runIngestion(options);
    const parsed = parseScriptJson(result.stdout);
    const ok = !result.timedOut && (result.exitCode === 0 || result.exitCode === 2);
    return NextResponse.json({
      ok,
      ...options,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      run: parsed,
      stdout: parsed ? undefined : result.stdout.slice(-4000),
      stderr: result.stderr.slice(-4000),
    }, { status: ok ? 200 : 500 });
  } finally {
    releaseLock();
  }
}
