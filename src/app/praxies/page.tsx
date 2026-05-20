import Link from 'next/link';
import { isAuthenticatedCookie, hasEditToken } from '@/lib/auth';
import { getDashboardData } from '@/lib/markdown';
import { getOperatingSlice, type ExperimentCard, type ExperimentStage } from '@/lib/os';
import { getHermesAtlasPraxisMap, getHermesAtlasStatus } from '@/lib/hermes-atlas';

export const dynamic = 'force-dynamic';

type PraxisCategory = {
  id: string;
  label: string;
  thesis: string;
  match: RegExp;
};

const PRAXIS_CATEGORIES: PraxisCategory[] = [
  { id: 'agent-ops', label: 'Agent ops', thesis: 'Multi-agent workflows, queues, reviews, and operating systems.', match: /agent ops|multi-agent|operator|workflow|queue|autonomous|codex|omx|openclaw|devin|swe-agent/i },
  { id: 'mcp-tools', label: 'MCP / tools', thesis: 'Adapters, API tools, plugins, connectors, and tool-use loops.', match: /mcp|adapter|plugin|connector|api|tool|server|integration/i },
  { id: 'coding-agents', label: 'Coding agents', thesis: 'Code generation, repo review, CLI, debugging, and implementation loops.', match: /code|coding|repo|github|pull request|cli|debug|review|terminal/i },
  { id: 'browser-mobile', label: 'Browser / mobile', thesis: 'Browser agents, phone control, web automation, and remote ops.', match: /browser|chrome|mobile|phone|remote|webbridge|scrcpy|termius|tmux/i },
  { id: 'runtime-local', label: 'Runtime / local', thesis: 'Sandboxing, local models, infrastructure, and execution environments.', match: /runtime|sandbox|local|ollama|hermes|model|gpu|desktop|worker|container|microvm/i },
  { id: 'content-reporting', label: 'Content / reports', thesis: 'Launch media, research reports, summaries, and executive artifacts.', match: /content|video|report|summary|research|brief|launch|audio|youtube/i },
  { id: 'commercial', label: 'Commercial', thesis: 'Pricing, go-to-market, commerce, payments, and product wedges.', match: /pricing|cost|commerce|payment|wallet|customer|sales|micro-saas|business/i },
];

export default async function PraxiesPage() {
  const os = getOperatingSlice(getDashboardData());
  const authed = await isAuthenticatedCookie();
  const atlas = getHermesAtlasStatus();
  const atlasMap = getHermesAtlasPraxisMap();
  const atlasPraxies = os.experiments.filter((praxis) => praxis.id.startsWith('hermes-atlas-'));
  const nativePraxies = os.experiments.filter((praxis) => !praxis.id.startsWith('hermes-atlas-'));
  const xPraxies = nativePraxies.filter(isXSourcePraxis);
  const xCategories = groupByCategory(xPraxies);
  const queue = prioritizePraxies(xPraxies).slice(0, 6);
  const stageCounts = stageSummary([...xPraxies, ...atlasPraxies]);

  return (
    <div className="praxisV2 dcPage dcWorkbenchPage">
      <section className="pvHero pvShell">
        <div className="pvHeroCopy pvCore">
          <p className="pvBadge">Praxis command atlas</p>
          <h1>Praxis, sorted.</h1>
          <p>Use categories first, then open only the missions worth learning from. Public Praxis shows X use cases and Atlas repo evidence only.</p>
          <div className="pvActions">
            {authed ? <Link className="pvButton pvButtonPrimary" href="#priority-queue"><span>Editor unlocked</span><b>↗</b></Link> : <Link className="pvButton pvButtonPrimary" href={hasEditToken() ? '/login?next=/praxies' : '/praxies'}><span>{hasEditToken() ? 'Login to edit' : 'Set edit token'}</span><b>↗</b></Link>}
            <Link className="pvButton" href="/dashboard"><span>Open operator queue</span><b>→</b></Link>
          </div>
        </div>
        <aside className="pvHeroPanel pvCore" aria-label="Praxis source mix">
          <Metric label="X use cases" value={xPraxies.length} />
          <Metric label="Atlas repos" value={atlasMap.totalRepos} />
          <Metric label="Categories" value={xCategories.length + atlasMap.totalSubcategories} />
          <Metric label="Learning now" value={stageCounts.learning} />
        </aside>
      </section>

      <section className="pvBoard pvSourceBoard" aria-label="Praxis sources">
        <div className="pvSourceIntro pvCore">
          <p className="pvBadge">Source separation</p>
          <h2>Two public shelves.</h2>
          <p>X is for use-case discovery. Atlas is for repo evidence. Internal experiments stay in operator space, not public Praxis.</p>
        </div>
        <div className="pvSourceCards">
          <SourceCard title="X / community" count={xPraxies.length} copy="Real-world workflows from posts. Needs evidence ranking and experiments." href="#x-categories" />
          <SourceCard title="Hermes Atlas" count={atlasMap.totalRepos} copy="Repo-backed projects grouped by Atlas taxonomy. Collapsed by default." href="#atlas-categories" />
        </div>
      </section>

      <section id="priority-queue" className="pvBoard pvPriorityBoard">
        <div className="pvSectionHead">
          <p className="pvBadge">Morning triage</p>
          <h2>Best missions to inspect first.</h2>
          <p>After source/category scan, inspect only these priority candidates.</p>
        </div>
        <div className="pvPriorityGrid">
          {queue.map((praxis, index) => <PraxisBriefCard praxis={praxis} rank={index + 1} key={praxis.id} />)}
        </div>
      </section>

      <section id="x-categories" className="pvBoard">
        <div className="pvSectionHead">
          <p className="pvBadge">Source · X/community</p>
          <h2>Use-case categories.</h2>
          <p>Grouped by agent job-to-be-done, not ingestion order. Open category details only when needed.</p>
        </div>
        <div className="pvCategoryGrid">
          {xCategories.map((group) => <CategoryPanel group={group} key={group.category.id} />)}
        </div>
      </section>

      <section id="atlas-categories" className="pvBoard pvAtlasBoard">
        <div className="pvSectionHead">
          <p className="pvBadge">Source · Hermes Atlas</p>
          <h2>Repo library, collapsed by category.</h2>
          <p>117 repositories should not become 117 screaming cards. The top layer is taxonomy; rows appear only inside category drawers.</p>
        </div>
        <div className="pvAtlasMeta">
          <span>Latest run: {compactRun(atlas.latestAtlasRun)}</span>
          <span>{atlas.atlasRepos} repos</span>
          <span>{atlas.atlasSummaries} summaries</span>
        </div>
        <div className="pvAtlasGrid">
          {atlasMap.subcategories.map((group, index) => (
            <details className="pvAtlasDrawer pvShell" key={group.name} open={index < 2}>
              <summary className="pvCore">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{group.name}</strong>
                <em>{group.count} repos</em>
              </summary>
              <div className="pvAtlasRows">
                {group.praxies.slice(0, 8).map((praxis) => (
                  <a href={praxis.atlasUrl || praxis.githubUrl || '#'} target="_blank" rel="noreferrer" className="pvAtlasRow" key={praxis.id}>
                    <strong>{praxis.title}</strong>
                    <p>{praxis.overview || praxis.hypothesis}</p>
                    <em>{praxis.stars} stars · audit {praxis.audit} · {praxis.githubUrl ? 'GitHub' : 'Atlas'}</em>
                  </a>
                ))}
                {group.praxies.length > 8 ? <p className="pvMore">+ {group.praxies.length - 8} more in this category. Use Atlas source link for full directory.</p> : null}
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
}

function SourceCard({ title, count, copy, href }: { title: string; count: number; copy: string; href: string }) {
  return <a href={href} className="pvSourceCard pvShell"><span className="pvCore"><em>{count}</em><strong>{title}</strong><small>{copy}</small></span></a>;
}

function PraxisBriefCard({ praxis, rank }: { praxis: ExperimentCard; rank: number }) {
  const category = categoryForPraxis(praxis);
  const score = praxisScore(praxis);
  const source = sourceBadge(praxis);
  const evidence = evidenceLabel(praxis);
  const firstStep = praxis.executionSteps[0] || praxis.firstTest;
  return (
    <Link href={praxis.sourceNoteHref} className="pvBriefCard pvMissionCard pvShell">
      <article className="pvCore">
        <div className="pvMissionTop">
          <span className="pvMissionRank">{String(rank).padStart(2, '0')}</span>
          <span className="pvMissionSource">{source}</span>
          <em>{stageLabel(praxis.stage)}</em>
        </div>

        <div className="pvMissionBody">
          <span className="pvMissionCategory">{category.label}</span>
          <h3>{praxis.title}</h3>
          <p>{praxisSummary(praxis)}</p>
        </div>

        <div className="pvMissionLedger" aria-label="Praxis evidence and ownership">
          <span><small>Evidence</small><strong>{evidence}</strong></span>
          <span><small>Owner</small><strong>{praxis.owner}</strong></span>
          <span><small>Score</small><strong>{score}</strong></span>
        </div>

        <div className="pvMissionTest">
          <span>First safe move</span>
          <strong>{firstStep}</strong>
        </div>

        <div className="pvMissionFooter">
          <span>{praxis.sourceUrls.length} source{praxis.sourceUrls.length === 1 ? '' : 's'}</span>
          <span>{praxis.executionSteps.length} steps</span>
          <b><span>Open mission</span><i>↗</i></b>
        </div>
      </article>
    </Link>
  );
}

function CategoryPanel({ group }: { group: { category: PraxisCategory; items: ExperimentCard[] } }) {
  const lead = prioritizePraxies(group.items).slice(0, 3);
  return (
    <details className="pvCategoryPanel pvShell" open={group.items.length <= 4}>
      <summary className="pvCore">
        <span>{group.items.length} missions</span>
        <strong>{group.category.label}</strong>
        <p>{group.category.thesis}</p>
      </summary>
      <div className="pvCategoryList">
        {lead.map((praxis, index) => <PraxisBriefCard praxis={praxis} rank={index + 1} key={praxis.id} />)}
      </div>
    </details>
  );
}

function praxisSummary(praxis: ExperimentCard) {
  return praxis.hypothesis || praxis.firstTest || 'Open Praxis detail for source evidence and learning path.';
}

function compactRun(runId?: string | null) {
  if (!runId) return 'none';
  return runId.slice(0, 10);
}

function isXSourcePraxis(praxis: ExperimentCard) {
  const haystack = [praxis.source, praxis.sourcePath, praxis.sourceNoteHref, ...praxis.sourceUrls].join(' ');
  return /(^|\b)(x\.com|twitter\.com|x-signal|logged-in x|X Feed)(\b|\/|$)/i.test(haystack);
}

function categoryForPraxis(praxis: ExperimentCard): PraxisCategory {
  const haystack = [praxis.title, praxis.hypothesis, praxis.firstTest, praxis.successSignal, praxis.sourcePath, ...praxis.sourceUrls].join(' ');
  return PRAXIS_CATEGORIES.find((category) => category.match.test(haystack)) || { id: 'uncategorized', label: 'Unsorted signals', thesis: 'Needs human classification before learning.', match: /$a/ };
}

function sourceBadge(praxis: ExperimentCard) {
  if (praxis.id.startsWith('hermes-atlas-')) return 'Atlas repo';
  if (isXSourcePraxis(praxis)) return 'X use-case';
  return 'Operator note';
}

function evidenceLabel(praxis: ExperimentCard) {
  const url = praxis.sourceUrls.find(Boolean);
  if (!url) return praxis.sourcePath ? 'source note' : 'needs source';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'source link';
  }
}

function stageLabel(stage: ExperimentStage) {
  return stage.replace('_', ' ');
}

function groupByCategory(items: ExperimentCard[]) {
  const groups = new Map<string, { category: PraxisCategory; items: ExperimentCard[] }>();
  for (const item of items) {
    const category = categoryForPraxis(item);
    if (!groups.has(category.id)) groups.set(category.id, { category, items: [] });
    groups.get(category.id)?.items.push(item);
  }
  return Array.from(groups.values()).sort((a, b) => b.items.length - a.items.length || a.category.label.localeCompare(b.category.label));
}

function praxisScore(praxis: ExperimentCard) {
  const stageRank: Record<ExperimentStage, number> = { learning: 7, verifying: 6, queued: 5, worth_trying: 4, tried: 3, adopted: 2, killed: 1 };
  const sourceScore = Math.min(4, praxis.sourceUrls.length);
  const actionScore = /run|build|verify|test|compare|connect|create|inspect/i.test(`${praxis.firstTest} ${praxis.executionSteps.join(' ')}`) ? 2 : 0;
  return stageRank[praxis.stage] + sourceScore + actionScore;
}

function prioritizePraxies(items: ExperimentCard[]) {
  return [...items].sort((a, b) => praxisScore(b) - praxisScore(a) || a.title.localeCompare(b.title));
}

function stageSummary(items: ExperimentCard[]) {
  return items.reduce<Record<ExperimentStage, number>>((acc, item) => {
    acc[item.stage] = (acc[item.stage] || 0) + 1;
    return acc;
  }, { worth_trying: 0, queued: 0, verifying: 0, learning: 0, tried: 0, adopted: 0, killed: 0 });
}
