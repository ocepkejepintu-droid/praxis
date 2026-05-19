import { NextResponse } from 'next/server';
import { isHermesIngestAuthorized, missingHermesTokenMessage } from '@/lib/ingest-auth';
import { readLatestIngestionRun } from '@/lib/ingestion-status';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function unauthorized() {
  return NextResponse.json({ ok: false, message: missingHermesTokenMessage() }, { status: 401 });
}


export async function GET(request: Request) {
  if (!isHermesIngestAuthorized(request)) return unauthorized();
  return NextResponse.json({ ok: true, run: readLatestIngestionRun() });
}
