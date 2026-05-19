import { NextResponse } from 'next/server';
import { appendAcpEvent } from '@/lib/agent';
import { canRequestAuth, getRequestAuth, requestActorLabel } from '@/lib/auth';
import { getPraxisBySlug, updatePraxis } from '@/lib/praxis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function unauthorized() {
  return NextResponse.json({ ok: false, message: 'Unauthorized Praxis request.' }, { status: 401 });
}

export async function GET(request: Request, { params }: { params: Promise<unknown> }) {
  const auth = getRequestAuth(request);
  if (!canRequestAuth(auth, 'read_praxies')) return unauthorized();
  const { slug } = await params as { slug: string };
  const praxis = getPraxisBySlug(slug);
  if (!praxis) return NextResponse.json({ ok: false, message: 'Praxis not found.' }, { status: 404 });
  return NextResponse.json({ ok: true, praxis: { slug: praxis.slug, title: praxis.title, stage: praxis.stage, status: praxis.status, path: praxis.path, markdown: praxis.content, sourceUrls: praxis.sourceUrls } });
}

export async function PATCH(request: Request, { params }: { params: Promise<unknown> }) {
  const auth = getRequestAuth(request);
  if (!canRequestAuth(auth, 'update_praxis_status')) return unauthorized();
  const { slug } = await params as { slug: string };
  let body: { stage?: string; status?: string; markdown?: string; actor?: string } = {};
  try { body = await request.json() as typeof body; } catch {}
  try {
    const before = getPraxisBySlug(slug);
    const actor = body.actor?.trim() || requestActorLabel(auth);
    const praxis = updatePraxis(slug, { ...body, actor });
    if (!praxis) return NextResponse.json({ ok: false, message: 'Praxis not found.' }, { status: 404 });
    const event = appendAcpEvent({
      type: praxis.stage === 'adopted' ? 'praxis_adopted' : praxis.stage === 'killed' ? 'praxis_killed' : 'praxis_status_updated',
      from: actor,
      to: 'radar',
      payload: {
        slug,
        title: praxis.title,
        before: before ? { stage: before.stage, status: before.status } : null,
        after: { stage: praxis.stage, status: praxis.status },
        path: praxis.path,
      },
      sourceSlugs: [slug],
      sourceUrls: praxis.sourceUrls,
    });
    return NextResponse.json({ ok: true, praxis: { slug: praxis.slug, title: praxis.title, stage: praxis.stage, status: praxis.status, path: praxis.path }, event });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
