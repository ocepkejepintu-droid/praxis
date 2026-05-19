import { NextResponse } from 'next/server';
import { runPraxisLearningTask, type PraxisLearnerAgent } from '@/lib/praxis-learning';
import { requirePraxisLearningAuth, praxisLearningTenant } from '../_auth';
import { tenantStorage } from '@/lib/praxis-learning-saas';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const agents = ['hermes', 'openclaw', 'mock-hermes', 'mock-openclaw'] as const;
function isAgent(value: unknown): value is PraxisLearnerAgent {
  return typeof value === 'string' && (agents as readonly string[]).includes(value);
}

export async function POST(request: Request) {
  const gate = requirePraxisLearningAuth(request, 'submit_learning_report');
  if (gate.response) return gate.response;
  if (!gate.auth) return NextResponse.json({ ok: false, message: 'Unauthorized.' }, { status: 401 });
  let body = {} as Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON body.' }, { status: 400 });
  }
  const praxisId = typeof body.praxisId === 'string' ? body.praxisId.trim() : '';
  if (!praxisId) return NextResponse.json({ ok: false, message: 'praxisId required.' }, { status: 400 });
  if (!isAgent(body.agent)) return NextResponse.json({ ok: false, message: 'agent must be hermes, openclaw, mock-hermes, or mock-openclaw.' }, { status: 400 });
  const tenant = praxisLearningTenant(gate.auth);
  const report = await runPraxisLearningTask({ praxisId, agent: body.agent, objective: typeof body.objective === 'string' ? body.objective : undefined, safeMode: body.safeMode !== false }, tenantStorage(tenant.ownerId));
  return NextResponse.json({ ok: report.status !== 'failed', tenant, report }, { status: report.status === 'failed' ? 404 : 200 });
}
