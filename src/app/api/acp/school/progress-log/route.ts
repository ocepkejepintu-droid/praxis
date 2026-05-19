import { NextResponse } from 'next/server';
import { listSchoolProgressLogs, logSchoolProgress } from '@/lib/school-progress';
import { requireSchoolAuth } from '../_auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const gate = requireSchoolAuth(request, 'read_reports');
  if (gate.response) return gate.response;
  return NextResponse.json({ ok: true, logs: listSchoolProgressLogs(30) });
}

export async function POST(request: Request) {
  const gate = requireSchoolAuth(request, 'submit_learning_report');
  if (gate.response) return gate.response;
  let body = {} as Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON body.' }, { status: 400 });
  }
  const log = await logSchoolProgress({
    courseId: typeof body.courseId === 'string' ? body.courseId : undefined,
    action: typeof body.action === 'string' ? body.action : 'progress_logged',
    summary: typeof body.summary === 'string' ? body.summary : 'Hermes logged school progress.',
    metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata as Record<string, unknown> : undefined,
    source: typeof body.source === 'string' ? body.source : 'hermes-acp-school',
  });
  return NextResponse.json({ ok: true, log, logs: listSchoolProgressLogs(10) });
}
