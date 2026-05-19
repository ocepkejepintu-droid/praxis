import { NextResponse } from 'next/server';
import { cancelTenantPraxisLearningJob, getTenantJob } from '@/lib/praxis-learning-saas';
import { requirePraxisLearningAuth, praxisLearningTenant } from '../../_auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Params) {
  const gate = requirePraxisLearningAuth(request, 'read_reports');
  if (gate.response) return gate.response;
  if (!gate.auth) return NextResponse.json({ ok: false, message: 'Unauthorized.' }, { status: 401 });
  const tenant = praxisLearningTenant(gate.auth);
  const { id } = await context.params;
  const job = getTenantJob(tenant.ownerId, id);
  if (!job) return NextResponse.json({ ok: false, message: 'Job not found.' }, { status: 404 });
  return NextResponse.json({ ok: true, tenant, job });
}

export async function DELETE(request: Request, context: Params) {
  const gate = requirePraxisLearningAuth(request, 'submit_learning_report');
  if (gate.response) return gate.response;
  if (!gate.auth) return NextResponse.json({ ok: false, message: 'Unauthorized.' }, { status: 401 });
  const tenant = praxisLearningTenant(gate.auth);
  const { id } = await context.params;
  const job = cancelTenantPraxisLearningJob(tenant.ownerId, id);
  if (!job) return NextResponse.json({ ok: false, message: 'Job not found.' }, { status: 404 });
  return NextResponse.json({ ok: true, tenant, job });
}
