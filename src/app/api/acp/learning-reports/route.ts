import { NextResponse } from 'next/server';
import { submitLearningReport } from '@/lib/learning';
import { canRequestAuth, getRequestAuth, requestActorLabel } from '@/lib/auth';
import { visibleLearningReportsForAuth } from '@/lib/access-scope';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = getRequestAuth(request);
  if (!canRequestAuth(auth, 'read_reports')) return NextResponse.json({ ok: false, message: 'Missing read_reports permission.' }, { status: 401 });
  const url = new URL(request.url);
  return NextResponse.json({ ok: true, reports: visibleLearningReportsForAuth(auth, Number(url.searchParams.get('limit')) || 100) });
}

export async function POST(request: Request) {
  const auth = getRequestAuth(request);
  if (!canRequestAuth(auth, 'submit_learning_report')) return NextResponse.json({ ok: false, message: 'Missing submit_learning_report permission.' }, { status: 401 });
  let body = {} as Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON body.' }, { status: 400 });
  }
  const status = ['learning', 'tried', 'adopted', 'killed', 'blocked'].includes(String(body.status)) ? body.status as 'learning' | 'tried' | 'adopted' | 'killed' | 'blocked' : 'learning';
  const report = submitLearningReport({
    agentId: auth?.kind === 'acp' ? auth.key.id : typeof body.agentId === 'string' ? body.agentId : undefined,
    agentName: auth?.kind === 'acp' ? auth.key.name : typeof body.agentName === 'string' ? body.agentName : requestActorLabel(auth),
    adapter: auth?.kind === 'acp' ? auth.key.adapter : body.adapter === 'openclaw' ? 'openclaw' : 'hermes',
    praxisSlug: typeof body.praxisSlug === 'string' ? body.praxisSlug : undefined,
    praxisTitle: typeof body.praxisTitle === 'string' ? body.praxisTitle : undefined,
    runId: typeof body.runId === 'string' ? body.runId : undefined,
    category: typeof body.category === 'string' ? body.category : undefined,
    status,
    summary: typeof body.summary === 'string' ? body.summary : undefined,
    learned: typeof body.learned === 'string' ? body.learned : undefined,
    tried: typeof body.tried === 'string' ? body.tried : undefined,
    worked: typeof body.worked === 'string' ? body.worked : undefined,
    failed: typeof body.failed === 'string' ? body.failed : undefined,
    nextAction: typeof body.nextAction === 'string' ? body.nextAction : undefined,
    evidenceUrls: Array.isArray(body.evidenceUrls) ? body.evidenceUrls.map(String) : [],
  });
  return NextResponse.json({ ok: true, report });
}
