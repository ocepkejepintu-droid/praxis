import { NextResponse } from 'next/server';
import { listSchoolProgress } from '@/lib/school-progress';
import { requireSchoolAuth } from '../_auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const gate = requireSchoolAuth(request, 'read_reports');
  if (gate.response) return gate.response;
  try {
    const url = new URL(request.url);
    const progress = await listSchoolProgress(url.searchParams.get('courseId') || undefined);
    return NextResponse.json({ ok: true, progress });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : String(error) }, { status: 503 });
  }
}
