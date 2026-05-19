import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { NextResponse } from 'next/server';
import { isHermesIngestAuthorized, missingHermesTokenMessage } from '@/lib/ingest-auth';
import { readIngestionRun } from '@/lib/ingestion-status';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STAGE_SCRIPT: Record<string, string> = {
  enrich: 'scripts/enrich-x-cards.ts',
  replies: 'scripts/fetch-first-replies.ts',
  merge: 'scripts/judge-enriched-cards.ts',
  judge: 'scripts/judge-enriched-cards.ts',
  'x-search': 'scripts/auto-fill-xsearch-sidecars.ts',
  'hermes-atlas': 'scripts/ingest-hermes-atlas.ts',
};

function unauthorized() {
  return NextResponse.json({ ok: false, message: missingHermesTokenMessage() }, { status: 401 });
}


async function runStage(script: string, runId: string, args: string[] = []) {
  return new Promise<{ exitCode: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(process.execPath, ['--experimental-strip-types', script, '--run', runId, ...args], { cwd: process.cwd(), env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (exitCode) => resolve({ exitCode, stdout, stderr }));
  });
}

function xSearchArgs(body: { action?: string; limit?: number; batch?: unknown; batchPath?: string }) {
  if (body.action === 'apply') {
    if (body.batchPath) return ['--apply', body.batchPath];
    if (body.batch) {
      const file = path.join(os.tmpdir(), `agent-radar-xsearch-batch-${Date.now()}.json`);
      fs.writeFileSync(file, JSON.stringify(body.batch, null, 2));
      return ['--apply', file];
    }
    return ['--list', '--limit', String(body.limit || 10)];
  }
  return ['--list', '--limit', String(body.limit || 10)];
}

export async function POST(request: Request, { params }: { params: Promise<unknown> }) {
  if (!isHermesIngestAuthorized(request)) return unauthorized();
  const { runId, stage } = await params as { runId: string; stage: string };
  const run = readIngestionRun(runId);
  if (!run) return NextResponse.json({ ok: false, message: 'Run not found.' }, { status: 404 });
  const script = STAGE_SCRIPT[stage];
  if (!script) return NextResponse.json({ ok: false, message: `Unsupported stage: ${stage}` }, { status: 400 });
  let body: { limit?: number; sinceDays?: number; action?: string; batch?: unknown; batchPath?: string } = {};
  try { body = await request.json() as typeof body; } catch {}
  const args = stage === 'replies'
    ? ['--limit', String(body.limit || 10)]
    : stage === 'x-search'
      ? xSearchArgs(body)
      : stage === 'hermes-atlas'
        ? ['--max-cards', String(body.limit || 30), '--since-days', String(body.sinceDays || 30)]
        : [];
  const result = await runStage(script, run.id, args);
  const ok = result.exitCode === 0;
  return NextResponse.json({ ok, runId: run.id, stage, exitCode: result.exitCode, stdout: result.stdout.slice(-8000), stderr: result.stderr.slice(-4000), note: stage === 'x-search' ? 'No x_search network call made. This stage lists Hermes work or applies provided Hermes batch JSON.' : stage === 'hermes-atlas' ? 'Hermes Atlas source ingested as first-class external enrichment; latest X run is preserved by default.' : undefined }, { status: ok ? 200 : 500 });
}
