import { NextResponse } from 'next/server';
import { createPraxisNote } from '@/lib/agent';
import { hasRequestPermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!hasRequestPermission(request, 'create_praxis')) return NextResponse.json({ ok: false, message: 'Missing create_praxis permission.' }, { status: 401 });
  const body = await request.json() as { title?: string; hypothesis?: string; firstTest?: string; successSignal?: string; killCriteria?: string; sourceUrls?: string[]; owner?: string };
  if (!body.title || !body.hypothesis || !body.firstTest) return NextResponse.json({ ok: false, message: 'title, hypothesis, and firstTest required.' }, { status: 400 });
  return NextResponse.json({ ok: true, praxis: createPraxisNote({ title: body.title, hypothesis: body.hypothesis, firstTest: body.firstTest, successSignal: body.successSignal, killCriteria: body.killCriteria, sourceUrls: body.sourceUrls, owner: body.owner }) });
}
