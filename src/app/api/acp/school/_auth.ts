import { NextResponse } from 'next/server';
import { canRequestAuth, getRequestAuth } from '@/lib/auth';
import type { AcpPermission } from '@/lib/acp';

export function requireSchoolAuth(request: Request, permission: AcpPermission = 'read_reports') {
  const auth = getRequestAuth(request);
  if (!auth) return { auth: null, response: NextResponse.json({ ok: false, message: 'Missing Authorization: Bearer <ACP_KEY> or user session.' }, { status: 401 }) };
  if (!canRequestAuth(auth, permission)) return { auth, response: NextResponse.json({ ok: false, message: `Missing ${permission} permission.` }, { status: 403 }) };
  return { auth, response: null };
}
