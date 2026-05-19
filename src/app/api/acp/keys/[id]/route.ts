import { NextResponse } from 'next/server';
import { listAcpApiKeys, revokeAcpApiKey } from '@/lib/acp';
import { canRequestAuth, getRequestAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function unauthorized() {
  return NextResponse.json({ ok: false, message: 'Unauthorized ACP settings request.' }, { status: 401 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getRequestAuth(request);
  if (!auth) return unauthorized();
  const { id } = await params;
  const existing = listAcpApiKeys().find((key) => key.id === id);
  if (!existing) return NextResponse.json({ ok: false, message: 'API key not found.' }, { status: 404 });
  const canRevoke = auth.kind === 'master'
    || canRequestAuth(auth, 'admin_settings')
    || (auth.kind === 'user' && (existing.ownerUserId === auth.user.id || existing.owner === auth.user.email));
  if (!canRevoke) return unauthorized();
  const record = revokeAcpApiKey(id);
  return NextResponse.json({ ok: true, record });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return DELETE(request, context);
}
