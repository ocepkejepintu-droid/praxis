import { NextResponse } from 'next/server';
import { getRequestAuth, requestActorLabel } from '@/lib/auth';
import { hermesAcpEndpoints, getHermesAcpConnection } from '@/lib/hermes-acp';

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
      message: 'Human/master auth works. Create a Hermes ACP key, then connect Hermes with that raw key.',
      endpoints: hermesAcpEndpoints(baseUrl),
    });
  }
  if (auth.key.adapter === 'hermes') {
    return NextResponse.json({ ok: true, connected: true, connection: getHermesAcpConnection(auth.key, baseUrl) });
  }
  return NextResponse.json({
    ok: true,
    connected: true,
    connection: {
      adapter: auth.key.adapter,
      keyId: auth.key.id,
      keyName: auth.key.name,
      owner: auth.key.owner,
      status: auth.key.status,
      permissions: auth.key.permissions,
      endpoints: hermesAcpEndpoints(baseUrl),
    },
  });
}
