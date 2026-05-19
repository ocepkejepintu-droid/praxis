import { NextResponse } from 'next/server';
import { getRequestAuth, canRequestAuth } from '@/lib/auth';
import { visibleAgentProfilesForAuth } from '@/lib/access-scope';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = getRequestAuth(request);
  if (!canRequestAuth(auth, 'read_reports')) return NextResponse.json({ ok: false, message: 'Missing read_reports permission.' }, { status: 401 });
  return NextResponse.json({ ok: true, agents: visibleAgentProfilesForAuth(auth) });
}
