import { NextResponse } from 'next/server';
import { isValidEditToken, setAuthCookie } from '@/lib/auth';
import { createUserSession, verifyUserPassword } from '@/lib/accounts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: { token?: string; email?: string; password?: string } = {};
  try { body = await request.json() as typeof body; } catch {}
  const user = verifyUserPassword(body.email, body.password);
  if (user) {
    await setAuthCookie(createUserSession(user.id));
    return NextResponse.json({ ok: true, user });
  }
  if (isValidEditToken(body.token)) {
    await setAuthCookie(body.token || '');
    return NextResponse.json({ ok: true, legacy: true });
  }
  return NextResponse.json({ ok: false, message: 'Invalid account credentials.' }, { status: 401 });
}
