import { NextResponse } from 'next/server';
import { getAgentNote } from '@/lib/agent';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<unknown> }) {
  const { slug } = await params as { slug: string };
  const note = getAgentNote(slug);
  if (!note) return NextResponse.json({ ok: false, message: 'Note not found.' }, { status: 404 });
  return NextResponse.json({ ok: true, note });
}
