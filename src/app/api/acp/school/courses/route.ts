import { NextResponse } from 'next/server';
import { listSchoolCourses } from '@/lib/school-progress';
import { requireSchoolAuth } from '../_auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const gate = requireSchoolAuth(request, 'read_reports');
  if (gate.response) return gate.response;
  try {
    const courses = await listSchoolCourses();
    return NextResponse.json({ ok: true, courses });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : String(error) }, { status: 503 });
  }
}
