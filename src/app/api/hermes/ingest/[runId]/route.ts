import { NextResponse } from 'next/server';
import { isHermesIngestAuthorized, missingHermesTokenMessage } from '@/lib/ingest-auth';
import { readIngestionRun } from '@/lib/ingestion-status';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function unauthorized() {
  return NextResponse.json({ ok: false, message: missingHermesTokenMessage() }, { status: 401 });
}


export async function GET(request: Request, { params }: { params: Promise<unknown> }) {
  if (!isHermesIngestAuthorized(request)) return unauthorized();
  const { runId } = await params as { runId: string };
  const run = readIngestionRun(runId);
  if (!run) return NextResponse.json({ ok: false, message: 'Run not found.' }, { status: 404 });
  return NextResponse.json({ ok: true, run });
}
