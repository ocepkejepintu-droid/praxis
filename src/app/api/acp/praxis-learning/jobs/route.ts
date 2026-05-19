import { NextResponse } from 'next/server';
import { createAndRunPraxisLearningJob, createPraxisLearningJobInput, listTenantJobs, readTenantUsage, validatePlanRequest } from '@/lib/praxis-learning-saas';
import { requirePraxisLearningAuth, praxisLearningTenant } from '../_auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const gate = requirePraxisLearningAuth(request, 'read_reports');
  if (gate.response) return gate.response;
  if (!gate.auth) return NextResponse.json({ ok: false, message: 'Unauthorized.' }, { status: 401 });
  const tenant = praxisLearningTenant(gate.auth);
  return NextResponse.json({ ok: true, tenant, usage: readTenantUsage(tenant.ownerId), jobs: listTenantJobs(tenant.ownerId) });
}

export async function POST(request: Request) {
  const gate = requirePraxisLearningAuth(request, 'submit_learning_report');
  if (gate.response) return gate.response;
  if (!gate.auth) return NextResponse.json({ ok: false, message: 'Unauthorized.' }, { status: 401 });
  let body = {} as Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON body.' }, { status: 400 });
  }
  const tenant = praxisLearningTenant(gate.auth);
  try {
    const jobRequest = createPraxisLearningJobInput(body);
    const guard = validatePlanRequest(tenant.ownerId, { agents: jobRequest.agents, limit: jobRequest.limit, xSearchCallsRequested: jobRequest.xSearchCallsRequested });
    if (!guard.ok) return NextResponse.json({ ok: false, code: 'PLAN_LIMIT_EXCEEDED', plan: guard.plan, usage: guard.usage, violations: guard.violations }, { status: 429 });
    const result = await createAndRunPraxisLearningJob(tenant.ownerId, tenant.ownerLabel, jobRequest);
    if (!result.ok) return NextResponse.json({ ok: false, code: 'PLAN_LIMIT_EXCEEDED', plan: result.guard.plan, usage: result.guard.usage, violations: result.guard.violations }, { status: 429 });
    return NextResponse.json({ ok: true, tenant, job: result.job }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
