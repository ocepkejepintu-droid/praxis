import Link from 'next/link';
import { ExperimentKanban } from '@/components/ExperimentKanban';
import { isAuthenticatedCookie, hasEditToken } from '@/lib/auth';
import { getDashboardData } from '@/lib/markdown';
import { getOperatingSlice } from '@/lib/os';
import { getHermesAtlasPraxisMap, getHermesAtlasStatus } from '@/lib/hermes-atlas';

export const dynamic = 'force-dynamic';

export default async function PraxiesPage() {
  const os = getOperatingSlice(getDashboardData());
  const authed = await isAuthenticatedCookie();
  const atlas = getHermesAtlasStatus();
  const atlasMap = getHermesAtlasPraxisMap();
  const nativePraxies = os.experiments.filter((praxis) => !praxis.id.startsWith('hermes-atlas-'));
  return (
    <div className="dcPage dcWorkbenchPage">
      <section className="dcPageHero">
        <div>
          <p className="dcEyebrow">Praxis missions</p>
          <h1>Clean fieldwork for agents.</h1>
          <p>Source-linked missions with objective, first test, proof path, success signal, stop rule, and learning status. Hermes Atlas repos are grouped as generated Praxis entries, not dumped into one long feed.</p>
        </div>
        <div className="dcHeroActionsCard">
          {authed ? <Link className="dcButton dcButtonPrimary" href="#praxis-board">Editor unlocked</Link> : <Link className="dcButton dcButtonPrimary" href={hasEditToken() ? '/login?next=/praxies' : '/praxies'}>{hasEditToken() ? 'Login to edit' : 'Set edit token'}</Link>}
          <Link className="dcButton dcButtonOutline" href="/dashboard">Operator queues</Link>
        </div>
      </section>

      <section className="dcMetricStrip" aria-label="Praxis source status">
        <MetricCard label="Hermes Atlas" value={String(atlasMap.totalRepos)} copy={`${atlasMap.totalSubcategories} subcategories`} />
        <MetricCard label="Latest Atlas run" value={compactRun(atlas.latestAtlasRun)} copy={`${atlas.latestAtlasRun || 'No Atlas run yet'} · ${atlas.atlasRepos} repos · ${atlas.atlasSummaries} summaries`} />
        <MetricCard label="Praxis queue" value={String(os.experiments.length)} copy={`${nativePraxies.length} native · ${atlasMap.totalRepos} Atlas`} />
      </section>

      <section className="dcSourceMap" aria-label="Hermes Atlas categorized Praxis map">
        <div className="dcSectionIntro">
          <p className="dcEyebrow">Hermes Atlas source</p>
          <h2>Repo Praxies grouped by category.</h2>
          <p>Each entry keeps Atlas URL, GitHub dependency URL, first test, success signal, and stop rule for Research Operator.</p>
        </div>
        <div className="dcPraxisGroups">
          {atlasMap.subcategories.map((group) => (
            <article className="dcPraxisGroup" key={group.name}>
              <header>
                <span>Hermes Atlas</span>
                <h3>{group.name}</h3>
                <strong>{group.count} Praxies</strong>
              </header>
              <div className="dcPraxisRows">
                {group.praxies.map((praxis) => (
                  <a href={praxis.atlasUrl || praxis.githubUrl || '#'} target="_blank" rel="noreferrer" className="dcPraxisRow" key={praxis.id}>
                    <span>{praxis.stage.replace('_', ' ')}</span>
                    <strong>{praxis.title}</strong>
                    <p>{praxis.overview || praxis.hypothesis}</p>
                    <em>{praxis.stars} stars · audit {praxis.audit} · {praxis.githubUrl ? 'GitHub linked' : 'source linked'}</em>
                  </a>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="dcBoardHeader" aria-label="Native Praxis board intro">
        <div className="dcSectionIntro">
          <p className="dcEyebrow">Native board</p>
          <h2>X and operator Praxies.</h2>
          <p>Human and agent editable markdown Praxies remain below. Open a card for evidence, execution path, and status edits.</p>
        </div>
      </section>
      <div id="praxis-board" className="dcKanbanWrap"><ExperimentKanban experiments={nativePraxies} overview authed={authed} /></div>
    </div>
  );
}

function MetricCard({ label, value, copy }: { label: string; value: string; copy: string }) {
  return <article><span>{label}</span><strong>{value}</strong><p>{copy}</p></article>;
}

function compactRun(runId?: string | null) {
  if (!runId) return 'none';
  return runId.slice(0, 10);
}
