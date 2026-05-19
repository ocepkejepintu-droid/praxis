import { NextResponse } from 'next/server';
import { listPraxisLearningReports } from '@/lib/praxis-learning';
import { requirePraxisLearningAuth, praxisLearningTenant } from '../_auth';
import { tenantStorage } from '@/lib/praxis-learning-saas';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const gate = requirePraxisLearningAuth(request, 'read_reports');
  if (gate.response) return gate.response;
  if (!gate.auth) return NextResponse.json({ ok: false, message: 'Unauthorized.' }, { status: 401 });
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get('limit'));
  const tenant = praxisLearningTenant(gate.auth);
  return NextResponse.json({ ok: true, tenant, reports: listPraxisLearningReports(Number.isFinite(limit) && limit > 0 ? limit : 30, tenantStorage(tenant.ownerId)) });
}
