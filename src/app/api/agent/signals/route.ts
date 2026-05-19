import { NextResponse } from 'next/server';
import { searchSignals } from '@/lib/agent';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  return NextResponse.json({ ok: true, signals: searchSignals({ q: url.searchParams.get('q') || undefined, category: url.searchParams.get('category') || undefined, runId: url.searchParams.get('runId') || undefined, limit: Number(url.searchParams.get('limit')) || undefined }) });
}
