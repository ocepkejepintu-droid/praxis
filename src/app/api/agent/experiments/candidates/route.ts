import { NextResponse } from 'next/server';
import { rankPraxisCandidates } from '@/lib/agent';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const candidates = rankPraxisCandidates({ focus: url.searchParams.get('focus') || undefined, limit: Number(url.searchParams.get('limit')) || undefined });
  return NextResponse.json({ ok: true, experiments: candidates, praxies: candidates });
}
