import { NextResponse } from 'next/server';
import { appendAcpEvent } from '@/lib/agent';
import { getRequestAuth, requestActorLabel } from '@/lib/auth';
import { updateUserSessionRecord } from '@/lib/user-sessions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function unauthorized() { return NextResponse.json({ ok: false, message: 'Login or ACP key required.' }, { status: 401 }); }
function ownerId(auth: NonNullable<ReturnType<typeof getRequestAuth>>) {
  if (auth.kind === 'user') return auth.user.id;
  if (auth.kind === 'acp') return auth.key.ownerUserId || auth.key.owner;
  return 'master';
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getRequestAuth(request);
  if (!auth) return unauthorized();
  const { id } = await params;
  let body = {} as Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON body.' }, { status: 400 });
  }
  const session = updateUserSessionRecord(ownerId(auth), id, {
    title: typeof body.title === 'string' ? body.title : undefined,
    adapter: body.adapter === 'openclaw' ? 'openclaw' : body.adapter === 'hermes' ? 'hermes' : undefined,
    status: body.status === 'paused' || body.status === 'archived' || body.status === 'active' ? body.status : undefined,
    praxisSlug: typeof body.praxisSlug === 'string' ? body.praxisSlug : undefined,
    summary: typeof body.summary === 'string' ? body.summary : undefined,
    notes: typeof body.notes === 'string' ? body.notes : undefined,
  });
  if (!session) return NextResponse.json({ ok: false, message: 'Session not found.' }, { status: 404 });
  const event = appendAcpEvent({ type: 'praxis_selected', from: requestActorLabel(auth), to: 'radar', payload: { sessionId: session.id, title: session.title, status: session.status }, sourceSlugs: session.praxisSlug ? [session.praxisSlug] : [] });
  return NextResponse.json({ ok: true, session, event });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const response = await PATCH(new Request(request.url, { method: 'PATCH', headers: request.headers, body: JSON.stringify({ status: 'archived' }) }), context);
  return response;
}
