import { NextResponse } from 'next/server';
import { createUserAccount, createUserSession, hasUserAccounts } from '@/lib/accounts';
import { isValidEditToken, setAuthCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: { email?: string; name?: string; password?: string; setupToken?: string } = {};
  try { body = await request.json() as typeof body; } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON body.' }, { status: 400 });
  }
  if (hasUserAccounts()) return NextResponse.json({ ok: false, message: 'First admin already exists.' }, { status: 409 });
  if (!isValidEditToken(body.setupToken)) return NextResponse.json({ ok: false, message: 'Setup token required.' }, { status: 401 });
  try {
    const user = createUserAccount({ email: body.email || '', name: body.name || '', password: body.password || '', role: 'admin' });
    const session = createUserSession(user.id);
    await setAuthCookie(session);
    return NextResponse.json({ ok: true, user });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
