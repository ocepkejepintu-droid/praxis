import { NextResponse } from 'next/server';
import { hasUserAccounts } from '@/lib/accounts';
import { getAuthenticatedUser, hasEditToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const user = await getAuthenticatedUser();
  return NextResponse.json({ ok: true, hasAccounts: hasUserAccounts(), hasSetupToken: hasEditToken(), user });
}
