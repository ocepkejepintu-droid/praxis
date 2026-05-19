import { NextResponse } from 'next/server';
import { getSchoolStatus } from '@/lib/school-progress';
import { requireSchoolAuth } from '../_auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const gate = requireSchoolAuth(request, 'read_reports');
  if (gate.response) return gate.response;
  let body = {} as Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch {}
  const status = await getSchoolStatus({
    provider: typeof body.provider === 'string' ? body.provider : undefined,
    baseUrl: typeof body.baseUrl === 'string' ? body.baseUrl : undefined,
    apiKey: typeof body.apiKey === 'string' ? body.apiKey : undefined,
    oauthToken: typeof body.oauthToken === 'string' ? body.oauthToken : undefined,
  });
  return NextResponse.json({ ok: status.connected, status, message: status.connected ? 'School adapter connected.' : status.error || 'School adapter not configured. Set SCHOOL_ACP_PROVIDER=mock-school or SCHOOL_ACP_BASE_URL plus SCHOOL_ACP_API_KEY.' }, { status: status.connected ? 200 : 400 });
}
