import { NextResponse } from 'next/server';
import { appendAcpEvent, readAcpEvents } from '@/lib/agent';
import { hasRequestPermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({ ok: true, decisions: readAcpEvents(50) });
}

export async function POST(request: Request) {
  if (!hasRequestPermission(request, 'append_acp_event')) return NextResponse.json({ ok: false, message: 'Missing append_acp_event permission.' }, { status: 401 });
  const body = await request.json() as { decision?: string; reason?: string; candidateSlug?: string; actor?: string; sourceUrls?: string[] };
  const event = appendAcpEvent({ type: body.decision === 'adopted' ? 'praxis_adopted' : body.decision === 'killed' ? 'praxis_killed' : 'praxis_selected', from: body.actor || 'agent', to: 'radar', payload: body, sourceSlugs: body.candidateSlug ? [body.candidateSlug] : [], sourceUrls: body.sourceUrls || [] });
  return NextResponse.json({ ok: true, event });
}
