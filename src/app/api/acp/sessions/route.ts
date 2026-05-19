import { NextResponse } from 'next/server';
import { appendAcpEvent } from '@/lib/agent';
import { getRequestAuth, requestActorLabel, requestOwnerLabel } from '@/lib/auth';
import { createUserSessionRecord, listUserSessions } from '@/lib/user-sessions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function unauthorized() { return NextResponse.json({ ok: false, message: 'Login or ACP key required.' }, { status: 401 }); }
function ownerId(auth: NonNullable<ReturnType<typeof getRequestAuth>>) {
  if (auth.kind === 'user') return auth.user.id;
  if (auth.kind === 'acp') return auth.key.ownerUserId || auth.key.owner;
  return 'master';
}

export async function GET(request: Request) {
  const auth = getRequestAuth(request);
  if (!auth) return unauthorized();
  return NextResponse.json({ ok: true, sessions: listUserSessions(ownerId(auth)), actor: requestActorLabel(auth) });
}

export async function POST(request: Request) {
  const auth = getRequestAuth(request);
  if (!auth) return unauthorized();
  let body = {} as Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON body.' }, { status: 400 });
  }
  const session = createUserSessionRecord({
    ownerUserId: ownerId(auth),
    owner: requestOwnerLabel(auth),
    title: body.title,
    adapter: body.adapter,
    status: body.status,
    praxisSlug: body.praxisSlug,
    summary: body.summary,
    notes: body.notes,
  });
  const event = appendAcpEvent({
    type: 'praxis_selected',
    from: requestActorLabel(auth),
    to: 'radar',
    payload: { sessionId: session.id, title: session.title, adapter: session.adapter, status: session.status, praxisSlug: session.praxisSlug },
    sourceSlugs: session.praxisSlug ? [session.praxisSlug] : [],
  });
  return NextResponse.json({ ok: true, session, event });
}
