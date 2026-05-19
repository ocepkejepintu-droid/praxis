import { NextResponse } from 'next/server';
import { createAcpApiKey, isAcpAdapter, listAcpApiKeys, normalizePermissions, type AcpAdapter, type AcpPermission } from '@/lib/acp';
import { canRequestAuth, getRequestAuth, requestActorLabel, requestOwnerLabel } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function unauthorized() {
  return NextResponse.json({ ok: false, message: 'Unauthorized ACP settings request.' }, { status: 401 });
}

export async function GET(request: Request) {
  const auth = getRequestAuth(request);
  if (!auth) return unauthorized();
  const allKeys = listAcpApiKeys();
  const keys = auth.kind === 'master' || canRequestAuth(auth, 'admin_settings')
    ? allKeys
    : auth.kind === 'user'
      ? allKeys.filter((key) => key.ownerUserId === auth.user.id || key.owner === auth.user.email)
      : allKeys.filter((key) => key.id === auth.key.id);
  return NextResponse.json({ ok: true, keys, actor: requestActorLabel(auth) });
}

export async function POST(request: Request) {
  const auth = getRequestAuth(request);
  if (!auth || auth.kind === 'acp') return unauthorized();
  let body: { name?: string; owner?: string; adapter?: string; permissions?: unknown } = {};
  try { body = await request.json() as typeof body; } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON body.' }, { status: 400 });
  }
  const adapter = body.adapter || 'hermes';
  if (!isAcpAdapter(adapter)) return NextResponse.json({ ok: false, message: 'Adapter must be hermes or openclaw.' }, { status: 400 });
  const isAdminCreator = auth.kind === 'master' || canRequestAuth(auth, 'admin_settings');
  const owner = auth.kind === 'user' && !isAdminCreator ? auth.user.email : body.owner || requestOwnerLabel(auth);
  const ownerUserId = auth.kind === 'user' ? auth.user.id : undefined;
  const permissions = limitPermissions(adapter, body.permissions, isAdminCreator);
  try {
    const created = createAcpApiKey({
      name: body.name || '',
      owner,
      ownerUserId,
      adapter,
      permissions,
      createdBy: requestActorLabel(auth),
    });
    return NextResponse.json({ ok: true, key: created.key, record: created.record, warning: 'Copy this key now. It is stored only as a hash and will not be shown again.' });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}

function limitPermissions(adapter: AcpAdapter, raw: unknown, canIssueAdmin: boolean): AcpPermission[] {
  const normalized = normalizePermissions(raw, adapter);
  return canIssueAdmin ? normalized : normalized.filter((permission) => permission !== 'admin_settings');
}
