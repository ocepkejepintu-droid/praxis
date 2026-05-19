import { NextResponse } from 'next/server';
import { getAgentReport } from '@/lib/agent';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({ ok: true, ...getAgentReport() });
}
