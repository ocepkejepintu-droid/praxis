import { NextResponse } from 'next/server';
import { canRequestAuth, getRequestAuth } from '@/lib/auth';
import { getHermesLearningContext } from '@/lib/hermes-acp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function unauthorized(message: string, status = 401) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function GET(request: Request) {
  const auth = getRequestAuth(request);
  if (!auth) return unauthorized('Missing Authorization: Bearer <Hermes ACP key>.');
  if (auth.kind !== 'acp' || auth.key.adapter !== 'hermes') return unauthorized('Hermes ACP key required.', 403);
  for (const permission of ['read_signals', 'read_reports', 'read_praxies'] as const) {
    if (!canRequestAuth(auth, permission)) return unauthorized(`Missing ${permission} permission.`);
  }
  return NextResponse.json({ ok: true, context: getHermesLearningContext(auth.key, new URL(request.url).origin) });
}
