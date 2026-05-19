import { listPraxisLearningReports, praxisLearningStatus } from '@/lib/praxis-learning';
import type { PraxisLearningTenantDashboard } from '@/lib/praxis-learning-saas';

export function PraxisLearningPanel({ authed, tenantDashboard }: { authed: boolean; tenantDashboard?: PraxisLearningTenantDashboard }) {
  const status = tenantDashboard?.status || praxisLearningStatus();
  const reports = tenantDashboard?.reports?.slice(0, 6) || (authed ? listPraxisLearningReports(6) : status.recentReports);
  const mockHermes = status.availableAgents.find((agent) => agent.agent === 'mock-hermes');
  const mockOpenClaw = status.availableAgents.find((agent) => agent.agent === 'mock-openclaw');
  const realBlocked = status.availableAgents.filter((agent) => !agent.available && agent.mode === 'external');
  const firstCandidate = status.candidates[0];
  const aggregate = status.latestMorningReport || status.latestAggregate;
  const latestJob = tenantDashboard?.latestJob;

  return (
    <section className="dcDashboardPanel dcPraxisLearningPanel" id="praxis-learning-loop">
      <div className="dcSectionIntro">
        <p className="dcEyebrow">Praxis learning loop</p>
        <h2>Agents learn from Praxis and report back.</h2>
        <p>Mock Hermes/OpenClaw run locally with no side effects. Real runtimes stay blocked until explicit runner config exists.</p>
      </div>
      <div className="dcMcpCards">
        <span><strong>{mockHermes?.available ? 'ready' : 'blocked'}</strong><span>mock Hermes</span></span>
        <span><strong>{mockOpenClaw?.available ? 'ready' : 'blocked'}</strong><span>mock OpenClaw</span></span>
        <span><strong>{tenantDashboard?.plan ? `$${tenantDashboard.plan.priceUsdMonthly}` : '$100'}</strong><span>monthly alpha plan</span></span>
        <span><strong>{reports.length}</strong><span>recent learning reports</span></span>
        <span><strong>{aggregate?.praxisLearnedCount || 0}</strong><span>latest batch learned</span></span>
        <span><strong>{aggregate?.promotedSkillDrafts?.length || 0}</strong><span>skill drafts</span></span>
      </div>
      {tenantDashboard ? (
        <div className="dcUsageBox">
          <span>Tenant-safe SaaS mode · {tenantDashboard.tenant.ownerLabel}</span>
          <strong>{latestJob ? `Latest job ${latestJob.state}` : 'No learning job yet'}</strong>
          <p>{tenantDashboard.usage.jobsCreated}/{tenantDashboard.plan.maxNightlyRunsPerDay} runs today · {tenantDashboard.usage.reportsGenerated} reports · {tenantDashboard.usage.xSearchCalls}/{tenantDashboard.plan.xSearchCallsPerDay} x_search calls · {tenantDashboard.limitsRemaining.runtimeMsToday}ms runtime left</p>
          <p>Reports, jobs, settings, skill drafts, and morning reports are stored under {tenantDashboard.paths.reports.replace('/praxis-learning-reports.json', '')}.</p>
        </div>
      ) : null}
      {aggregate ? (
        <div className="dcAggregateBox">
          <span>Latest {aggregate.reportKind || 'morning'} report · {aggregate.createdAt.slice(0, 10)} · {aggregate.agentsUsed.join(', ')}</span>
          <strong>{aggregate.topLearnedPatterns[0] || 'No aggregate pattern yet.'}</strong>
          {aggregate.bestNextActions[0] ? <p>{aggregate.bestNextActions[0]}</p> : null}
          {aggregate.promotedSkillDrafts?.length ? <p>Drafts: {aggregate.promotedSkillDrafts.slice(0, 3).map((draft) => draft.path).join(' · ')}</p> : null}
        </div>
      ) : null}
      {firstCandidate ? (
        <div className="dcCommandBox">
          <span>API trigger</span>
          <code>{`POST /api/acp/praxis-learning/run { "praxisId": "${firstCandidate.id}", "agent": "mock-hermes", "safeMode": true }`}</code>
          <code>{`POST /api/acp/praxis-learning/jobs { "agents": ["mock-hermes","mock-openclaw"], "limit": 5, "promoteDrafts": true }`}</code>
          <code>{`npm run praxis:learn -- --agents mock-hermes,mock-openclaw,hermes,openclaw --limit 10 --min-score 5 --safe-mode --report morning --promote-drafts`}</code>
        </div>
      ) : <p className="dcEmpty">No Praxis candidate available yet.</p>}
      {realBlocked.length ? (
        <div className="dcBlockedList">
          {realBlocked.map((agent) => <p key={agent.agent}><strong>{agent.agent}</strong>: {agent.blockedReason}</p>)}
        </div>
      ) : null}
      <div className="dcReportList">
        {reports.length ? reports.map((report) => (
          <article className="dcReportRow" key={report.id}>
            <strong>{report.agent} · {report.praxisTitle}</strong>
            <span>{report.createdAt.slice(0, 10)} · {report.status}</span>
            <ul>
              {report.learned.slice(0, 3).map((item) => <li key={item}>{item}</li>)}
            </ul>
            {report.blockers?.length ? <em>{report.blockers[0]}</em> : null}
          </article>
        )) : <p className="dcEmpty">No Praxis learning reports yet. Trigger the API with a mock agent first.</p>}
      </div>
    </section>
  );
}
