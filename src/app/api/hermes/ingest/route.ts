import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { isHermesIngestAuthorized, missingHermesTokenMessage } from '@/lib/ingest-auth';
import { POST as triggerXIngestion } from '../../ingest/x/route';
import { readIngestionRunHistory, readLatestIngestionRun } from '@/lib/ingestion-status';
import { hasExternalCards, ingestExternalCards } from '@/lib/external-cards';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function unauthorized() {
  return NextResponse.json({ ok: false, message: missingHermesTokenMessage() }, { status: 401 });
}


function readActiveLock() {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), '.omx', 'ingestion-runs', 'active.lock.json'), 'utf8')) as unknown;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  if (!isHermesIngestAuthorized(request)) return unauthorized();
  return NextResponse.json({
    ok: true,
    service: 'agent-radar-hermes-ingestion',
    latestRun: readLatestIngestionRun(),
    recentRuns: readIngestionRunHistory(12),
    activeLock: readActiveLock(),
    trigger: {
      method: 'POST',
      body: { mode: 'live', source: 'home', maxScrolls: 80, maxCards: 120, minDurationMinutes: 60 },
    },
  });
}

export async function POST(request: Request) {
  if (!isHermesIngestAuthorized(request)) return unauthorized();

  const text = await request.text();
  let body: unknown = {};
  try {
    body = text ? JSON.parse(text) as unknown : {};
  } catch {
    body = {};
  }

  if (hasExternalCards(body)) {
    return NextResponse.json(ingestExternalCards(body));
  }

  return triggerXIngestion(new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body: text || '{}',
  }));
}
