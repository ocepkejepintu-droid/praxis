import { NextResponse } from 'next/server';
import { getRequestAuth, requestActorLabel } from '@/lib/auth';
import { acpAdapterEndpoints, hermesAcpEndpoints, getAdapterAcpConnection } from '@/lib/hermes-acp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = getRequestAuth(request);
  const baseUrl = new URL(request.url).origin;
  if (!auth) {
    return NextResponse.json({ ok: false, connected: false, message: 'Missing Authorization: Bearer <ACP_KEY>.' }, { status: 401 });
  }
  if (auth.kind !== 'acp') {
    return NextResponse.json({
      ok: true,
      connected: false,
      actor: requestActorLabel(auth),
      message: 'Human/master auth works. Create a Hermes or OpenClaw ACP key, then connect the agent with that raw key.',
      endpoints: hermesAcpEndpoints(baseUrl),
      adapters: {
        hermes: acpAdapterEndpoints('hermes', baseUrl),
        openclaw: acpAdapterEndpoints('openclaw', baseUrl),
      },
    });
  }
  return NextResponse.json({ ok: true, connected: true, connection: getAdapterAcpConnection(auth.key, baseUrl) });
}
