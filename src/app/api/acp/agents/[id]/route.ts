import { NextResponse } from 'next/server';
import { canRequestAuth, getRequestAuth } from '@/lib/auth';
import { visibleAgentProfilesForAuth } from '@/lib/access-scope';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getRequestAuth(request);
  if (!canRequestAuth(auth, 'read_reports')) return NextResponse.json({ ok: false, message: 'Missing read_reports permission.' }, { status: 401 });
  const { id } = await params;
  const agent = visibleAgentProfilesForAuth(auth).find((profile) => profile.id === id || profile.name.toLowerCase() === id.toLowerCase());
  if (!agent) return NextResponse.json({ ok: false, message: 'Agent not found.' }, { status: 404 });
  return NextResponse.json({ ok: true, agent });
}
