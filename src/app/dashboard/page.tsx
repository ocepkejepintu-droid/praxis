import Link from 'next/link';
import { AcpKeyManager } from '@/components/AcpKeyManager';
import { UserSessionManager } from '@/components/UserSessionManager';
import { SchoolProgressPanel } from '@/components/SchoolProgressPanel';
import { PraxisLearningPanel } from '@/components/PraxisLearningPanel';
import { AdapterConnectPanel } from '@/components/AdapterConnectPanel';
import { getAuthenticatedUser, hasEditToken, isAuthenticatedCookie } from '@/lib/auth';
import { acpPermissions, listAcpApiKeys } from '@/lib/acp';
import { readAcpEvents } from '@/lib/agent';
import { getAgentProfiles, listLearningReports } from '@/lib/learning';
import { getOperatorBrief, getOperatorSnapshot, readHandoffQueue, type OperatorLane } from '@/lib/operator';
import { getHermesAtlasStatus } from '@/lib/hermes-atlas';
import { listUserSessions } from '@/lib/user-sessions';
import { tenantPraxisLearningDashboard } from '@/lib/praxis-learning-saas';

export const dynamic = 'force-dynamic';

const lanes: Array<{ key: OperatorLane; label: string; hint: string }> = [
  { key: 'buildroom', label: 'Buildroom', hint: 'build-ready only' },
  { key: 'verify', label: 'Verify', hint: 'claim checks' },
  { key: 'content', label: 'Content', hint: 'report material' },
  { key: 'watch', label: 'Watch', hint: 'weak/noisy' },
];

export default async function AgentDashboardPage() {
  const [authed, user] = await Promise.all([isAuthenticatedCookie(), getAuthenticatedUser()]);
  const allKeys = listAcpApiKeys();
  const keys = authed ? (user ? allKeys.filter((key) => key.ownerUserId === user.id || key.owner === user.email) : allKeys) : [];
  const publicKeyCount = keys.filter((key) => key.status === 'active').length;
  const keyIds = new Set(keys.map((key) => key.id));
  const agents = getAgentProfiles().filter((agent) => !authed || !user || keyIds.has(agent.id));
  const reports = listLearningReports(12);
  const events = readAcpEvents(12);
  const snapshot = getOperatorSnapshot();
  const atlas = getHermesAtlasStatus();
  const brief = getOperatorBrief();
  const hasAgents = agents.some((agent) => agent.status === 'active') || publicKeyCount > 0;
  const owner = user?.email || user?.name || 'Yoseph';
  const sessions = user ? listUserSessions(user.id) : [];
  const tenantDashboard = user ? tenantPraxisLearningDashboard(user.id, owner) : undefined;

  if (!hasAgents) {
    return (
      <div className="dcPage dcDashboardPage">
        <section className="dcPageHero dcDashboardHero">
          <div>
            <p className="dcEyebrow">Agent dashboard</p>
            <h1>Connect Hermes or OpenClaw.</h1>
            <p>Create a scoped ACP key, give it to the adapter, then Hermes/OpenClaw can read Praxis context and submit learning reports back into this dashboard.</p>
          </div>
          <div className="dcHeroActionsCard">
            {authed ? <a className="dcButton dcButtonPrimary" href="#create-key">Create ACP key</a> : <Link className="dcButton dcButtonPrimary" href={hasEditToken() ? '/login?next=/dashboard' : '/dashboard'}>{hasEditToken() ? 'Login to create key' : 'Set edit token'}</Link>}
            <Link className="dcButton dcButtonOutline" href="/api/mcp">View MCP manifest</Link>
          </div>
        </section>
        <AdapterConnectPanel keys={keys} />
        <section className="dcAdapterFlow" aria-label="Agent access flow">
          <article><strong>Hermes</strong><p>Reads X/community ingestion, summarizes signal chaos, proposes Praxies, writes report-grade briefs.</p></article>
          <article><strong>OpenClaw</strong><p>Reads Praxies, selects useful attempts, runs allowed experiments, submits learning reports.</p></article>
          <article><strong>Human control</strong><p>All writes stay API-key gated and visible in ACP events before becoming decision memory.</p></article>
        </section>
        {authed ? <div id="create-key"><AcpKeyManager initialKeys={keys} defaultOwner={owner} />{user ? <UserSessionManager initialSessions={sessions} /> : null}</div> : <section className="dcEmptyPanel"><h2>ACP locked</h2><p>Login before creating or revoking agent keys. After first key exists, this page becomes the unified agent dashboard.</p></section>}
        <PraxisLearningPanel authed={authed} tenantDashboard={tenantDashboard} />
        <SchoolProgressPanel authed={authed} />
      </div>
    );
  }

  return (
    <div className="dcPage dcDashboardPage">
      <section className="dcPageHero dcDashboardHero">
        <div>
          <p className="dcEyebrow">Agent dashboard</p>
          <h1>One cockpit for connected agents.</h1>
          <p>ACP access, MCP resources, operator queues, agent profiles, and learning reports are merged here so the app reads like one mature product surface.</p>
        </div>
        <div className="dcHeroActionsCard">
          <a className="dcButton dcButtonPrimary" href="#agent-access">Manage agent access</a>
          <a className="dcButton dcButtonOutline" href="#operator-queues">Review operator queues</a>
          <Link className="dcTextLink" href="/api/mcp">Open MCP manifest</Link>
        </div>
      </section>

      <AdapterConnectPanel keys={keys} />

      <section className="dcMetricStrip" aria-label="Unified agent dashboard metrics">
        <MetricCard label="connected agents" value={String(publicKeyCount)} copy={`${agents.length} profiles · ${agents.filter((agent) => agent.adapter === 'hermes').length} Hermes · ${agents.filter((agent) => agent.adapter === 'openclaw').length} OpenClaw`} />
        <MetricCard label="user sessions" value={String(sessions.length)} copy="Saved per-account learning sessions" />
        <MetricCard label="learning reports" value={String(reports.length)} copy="Markdown reports from agent attempts" />
        <MetricCard label="operator attention" value={String(snapshot.needsAttention)} copy={`${snapshot.claims} claims · ${snapshot.blocked} blocked`} />
        <MetricCard label="x_search" value={`${snapshot.health.xSearch?.ok || 0}/${(snapshot.health.xSearch?.ok || 0) + (snapshot.health.xSearch?.pending || 0)}`} copy={`${snapshot.health.xSearch?.pending || 0} pending sidecars`} />
        <MetricCard label="Atlas source" value={String(atlas.atlasCards)} copy={`${atlas.atlasRepos} repo cards`} />
      </section>

      <section className="dcDashboardGrid" id="agent-access">
        <article className="dcDashboardPanel dcMcpPanel">
          <div className="dcSectionIntro">
            <p className="dcEyebrow">MCP + ACP</p>
            <h2>One endpoint. Scoped writes.</h2>
            <p>Agents read public resources through MCP and write only with Bearer auth from a scoped ACP key.</p>
          </div>
          <div className="dcMcpCards">
            <Link href="/api/mcp"><strong>/api/mcp</strong><span>manifest, tools, resources</span></Link>
            <span><strong>{acpPermissions.length}</strong><span>permission scopes</span></span>
            <span><strong>{events.length}</strong><span>recent audit events</span></span>
          </div>
        </article>

        <article className="dcDashboardPanel dcAgentRoster">
          <div className="dcSectionIntro">
            <p className="dcEyebrow">Agents</p>
            <h2>Adapter profiles.</h2>
          </div>
          <div className="dcAgentMiniGrid">
            {agents.length ? agents.slice(0, 6).map((agent) => (
              <Link href={`/agents/${agent.id}`} className="dcAgentMiniCard" key={agent.id}>
                <span>{agent.adapter}</span>
                <strong>{agent.name}</strong>
                <p>{agent.learningLevel} · {agent.activePraxies} active · {agent.reports.length} reports</p>
              </Link>
            )) : <p className="dcEmpty">No agent profile rows yet.</p>}
          </div>
        </article>
      </section>

      {authed ? <>
        <div id="create-key"><AcpKeyManager initialKeys={keys} defaultOwner={owner} /></div>
        <PraxisLearningPanel authed={authed} tenantDashboard={tenantDashboard} />
        <SchoolProgressPanel authed={authed} />
        {user ? <UserSessionManager initialSessions={sessions} /> : <section className="dcEmptyPanel"><h2>User sessions need account login</h2><p>Legacy token can manage keys, but saved sessions belong to real user accounts.</p></section>}
      </> : <section className="dcEmptyPanel"><h2>Access manager locked</h2><p>Login to create or revoke ACP keys. Connected agents can still be reviewed above.</p></section>}

      <section className="dcLaneBoard" id="operator-queues" aria-label="Operator lane handoffs">
        {lanes.map((lane) => {
          const queue = readHandoffQueue(lane.key) as { items?: Array<{ id?: string; title?: string; priority?: string; evidenceStrength?: string; verificationStatus?: string; nextAction?: string; sourceUrls?: string[] }> };
          const items = queue.items || [];
          return (
            <div className="dcLane" key={lane.key}>
              <header><h2>{lane.label}</h2><span>{items.length} items · {lane.hint}</span></header>
              {items.length ? items.slice(0, 5).map((item, index) => (
                <article className="dcTaskCard" key={item.id || `${lane.key}-${index}`}>
                  <span>{item.priority || 'medium'} · {item.evidenceStrength || 'weak'} · {item.verificationStatus || 'unverified'}</span>
                  <h3>{item.title || item.id}</h3>
                  <p>{item.nextAction || 'No next action recorded.'}</p>
                  <em>{item.sourceUrls?.length || 0} sources</em>
                </article>
              )) : <p className="dcEmpty">No items in this lane.</p>}
            </div>
          );
        })}
      </section>

      <section className="dcDashboardGrid" id="learning-reports">
        <article className="dcDashboardPanel">
          <div className="dcSectionIntro"><p className="dcEyebrow">Learning reports</p><h2>What agents learned.</h2></div>
          <div className="dcReportList">
            {reports.length ? reports.map((report) => (
              <Link href={report.praxisSlug ? `/notes/${report.praxisSlug}` : '/praxies'} className="dcReportRow" key={report.id}>
                <strong>{report.agentName}</strong>
                <span>{report.createdAt.slice(0, 10)} · {report.status} · {report.summary}</span>
              </Link>
            )) : <p className="dcEmpty">No learning reports yet.</p>}
          </div>
        </article>
        <article className="dcDashboardPanel">
          <div className="dcSectionIntro"><p className="dcEyebrow">Operator brief</p><h2>Latest decision context.</h2></div>
          <pre className="dcBriefPreview">{brief || 'No operator brief generated yet. Run npm run research:operator.'}</pre>
        </article>
      </section>
    </div>
  );
}

function MetricCard({ label, value, copy }: { label: string; value: string; copy: string }) {
  return <article><span>{label}</span><strong>{value}</strong><p>{copy}</p></article>;
}
