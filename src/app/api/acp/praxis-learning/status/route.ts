import { NextResponse } from 'next/server';
import { praxisLearningStatus } from '@/lib/praxis-learning';
import { getRequestAuth } from '@/lib/auth';
import { praxisLearningTenant } from '../_auth';
import { tenantPraxisLearningDashboard } from '@/lib/praxis-learning-saas';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = getRequestAuth(request);
  if (auth) {
    const tenant = praxisLearningTenant(auth);
    return NextResponse.json(tenantPraxisLearningDashboard(tenant.ownerId, tenant.ownerLabel));
  }
  const status = praxisLearningStatus();
  return NextResponse.json({ ...status, public: true, recentReports: [], latestAggregate: null, latestMorningReport: null });
}
