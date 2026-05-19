import { NextResponse } from 'next/server';
import { appendAcpEvent, readAcpEvents } from '@/lib/agent';
import { hasRequestPermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  return NextResponse.json({ ok: true, events: readAcpEvents(Number(url.searchParams.get('limit')) || 50) });
}

export async function POST(request: Request) {
  if (!hasRequestPermission(request, 'append_acp_event')) return NextResponse.json({ ok: false, message: 'Missing append_acp_event permission.' }, { status: 401 });
  const body = await request.json();
  return NextResponse.json({ ok: true, event: appendAcpEvent(body) });
}
