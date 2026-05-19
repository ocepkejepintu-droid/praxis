import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { isHermesIngestAuthorized, missingHermesTokenMessage } from '@/lib/ingest-auth';
import { readIngestionRun } from '@/lib/ingestion-status';
import { getDashboardData } from '@/lib/markdown';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function unauthorized() {
  return NextResponse.json({ ok: false, message: missingHermesTokenMessage() }, { status: 401 });
}


function readBuckets(runId: string, mergedPath?: string) {
  const filePath = path.join(process.cwd(), mergedPath || `.omx/ingestion-runs/${runId}/merged.json`);
  try {
    const merged = JSON.parse(fs.readFileSync(filePath, 'utf8')) as { items?: Array<{ sourceCard?: string; bucket?: string }> };
    return new Map((merged.items || []).filter((item) => item.sourceCard && item.bucket).map((item) => [item.sourceCard as string, item.bucket as string]));
  } catch {
    return new Map<string, string>();
  }
}

export async function GET(request: Request, { params }: { params: Promise<unknown> }) {
  if (!isHermesIngestAuthorized(request)) return unauthorized();
  const { runId } = await params as { runId: string };
  const run = readIngestionRun(runId);
  if (!run) return NextResponse.json({ ok: false, message: 'Run not found.' }, { status: 404 });
  const files = new Set(run.files || []);
  const buckets = readBuckets(run.id, run.paths?.merged);
  const notes = getDashboardData().notes
    .filter((note) => note.ingestionRunId === run.id || files.has(note.path))
    .map((note) => ({ slug: note.slug, title: note.title, path: note.path, type: note.type, category: note.category, bucket: buckets.get(note.path) || null, sourceUrls: note.sourceUrls, sourceStatusUrl: note.sourceStatusUrl || null, statusId: note.statusId || null, statusIdentityStatus: note.statusIdentityStatus || null, excerpt: note.excerpt }));
  return NextResponse.json({ ok: true, runId: run.id, count: notes.length, notes, cards: notes, files: run.files });
}
