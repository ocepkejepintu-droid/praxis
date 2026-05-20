import { NextResponse } from 'next/server';
import { canRequestAuth, getRequestAuth } from '@/lib/auth';
import { submitLearningReport } from '@/lib/learning';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function unauthorized(message: string, status = 401) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(request: Request) {
  const auth = getRequestAuth(request);
  if (!auth) return unauthorized('Missing Authorization: Bearer <OpenClaw ACP key>.');
  if (auth.kind !== 'acp' || auth.key.adapter !== 'openclaw') return unauthorized('OpenClaw ACP key required.', 403);
  if (!canRequestAuth(auth, 'submit_learning_report')) return unauthorized('Missing submit_learning_report permission.');
  let body = {} as Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON body.' }, { status: 400 });
  }
  const status = ['learning', 'tried', 'adopted', 'killed', 'blocked'].includes(String(body.status)) ? body.status as 'learning' | 'tried' | 'adopted' | 'killed' | 'blocked' : 'learning';
  const report = submitLearningReport({
    agentId: auth.key.id,
    agentName: typeof body.agentName === 'string' ? body.agentName : auth.key.name,
    adapter: 'openclaw',
    praxisSlug: typeof body.praxisSlug === 'string' ? body.praxisSlug : undefined,
    praxisTitle: typeof body.praxisTitle === 'string' ? body.praxisTitle : undefined,
    runId: typeof body.runId === 'string' ? body.runId : undefined,
    category: typeof body.category === 'string' ? body.category : 'openclaw-learning',
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
