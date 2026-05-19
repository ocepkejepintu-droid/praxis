import { NextResponse } from 'next/server';
import { getLatestPraxisLearningMorningReport, praxisLearningPathsForStorage } from '@/lib/praxis-learning';
import { requirePraxisLearningAuth, praxisLearningTenant } from '../_auth';
import { tenantStorage } from '@/lib/praxis-learning-saas';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const gate = requirePraxisLearningAuth(request, 'read_reports');
  if (gate.response) return gate.response;
  if (!gate.auth) return NextResponse.json({ ok: false, message: 'Unauthorized.' }, { status: 401 });
  const tenant = praxisLearningTenant(gate.auth);
  const storage = tenantStorage(tenant.ownerId);
  const report = getLatestPraxisLearningMorningReport(storage);
  return NextResponse.json({ ok: Boolean(report), tenant, report, paths: praxisLearningPathsForStorage(storage) }, { status: report ? 200 : 404 });
}
