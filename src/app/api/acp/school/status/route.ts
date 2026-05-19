import { NextResponse } from 'next/server';
import { getSchoolStatus } from '@/lib/school-progress';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const status = await getSchoolStatus();
  return NextResponse.json({ ok: status.connected, status }, { status: status.connected ? 200 : 503 });
}
