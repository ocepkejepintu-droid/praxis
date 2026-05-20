import Link from 'next/link';
import type { ReactNode } from 'react';
import { getDashboardData } from '@/lib/markdown';
import { getAgentProfiles } from '@/lib/learning';
import { listAcpApiKeys } from '@/lib/acp';
import { getAuthenticatedUser, isAuthenticatedCookie } from '@/lib/auth';
import { NavLinks } from './NavLinks';

export async function Shell({ children }: { children: ReactNode }) {
  const data = getDashboardData();
  const [authed, user] = await Promise.all([isAuthenticatedCookie(), getAuthenticatedUser()]);
  const allKeys = listAcpApiKeys();
  const visibleKeys = authed && user ? allKeys.filter((key) => key.ownerUserId === user.id || key.owner === user.email) : allKeys;
  const visibleKeyIds = new Set(visibleKeys.map((key) => key.id));
  const hasConnectedAgents = getAgentProfiles().some((agent) => agent.status === 'active' && (!authed || !user || visibleKeyIds.has(agent.id))) || visibleKeys.some((key) => key.status === 'active');
  return (
    <div className="dcShell">
      <a href="#main" className="skipLink">Skip to content</a>
      <header className="dcTopbar" aria-label="Agent Praxis navigation">
        <div className="dcTopbarInner">
          <Link href="/" className="dcBrand" aria-label="Agent Praxis home">
            <span className="dcBrandMark">$</span>
            <span>
              <strong>Agent Praxis</strong>
              <em>terminal workbench</em>
            </span>
          </Link>
          <NavLinks showAgentDashboard={hasConnectedAgents} />
          <div className="dcNavMeta" aria-label="Radar snapshot">
            <span>signals {data.stats.notes}</span>
            <span>repos {data.stats.repos}</span>
            <span>verify {data.stats.verify}</span>
          </div>
          <Link href="/dashboard" className="dcTopbarCta">{hasConnectedAgents ? 'Open cockpit' : 'Connect agent'}</Link>
        </div>
      </header>
      <main id="main" className="dcMain">{children}</main>
    </div>
  );
}
