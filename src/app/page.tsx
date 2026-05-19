export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getAtlasCategories, getAtlasLists, getFeaturedNote, getFeaturedRepo, getXReport, formatCompactNumber } from '@/lib/atlas';
import { getCanonicalActions } from '@/lib/actions';
import { getDashboardData } from '@/lib/markdown';
import { getOperatingSlice } from '@/lib/os';
import { getAgentProfiles, listLearningReports } from '@/lib/learning';
import { getHermesAtlasStatus } from '@/lib/hermes-atlas';

export default function Home() {
  const data = getDashboardData();
  const os = getOperatingSlice(data);
  const categories = getAtlasCategories(data);
  const lists = getAtlasLists(data);
  const featuredNote = getFeaturedNote(data);
  const featuredRepo = getFeaturedRepo(data);
  const report = getXReport(data);
  const cleanActions = getCanonicalActions(data).filter((action) => !action.boilerplate);
  const agentProfiles = getAgentProfiles();
  const learningReports = listLearningReports(6);
  const atlas = getHermesAtlasStatus();
  const activeAgents = agentProfiles.filter((agent) => agent.status === 'active').length;
  const visibleHeadlines = report.headlines.slice(0, 4);
  const visibleLists = lists.slice(0, 5);
  const visibleCategories = categories.slice(0, 3);
  const sourceMapped = data.notes.filter((note) => note.sourceUrls.length).length;

  return (
    <div className="dcPage dcHome">
      <section className="dcHero" aria-labelledby="home-title">
        <div className="dcHeroCopy">
          <p className="dcEyebrow">Agent Praxis</p>
          <h1 id="home-title">Train agents on real-world work.</h1>
          <p className="dcLede">Turn community signals into structured Praxies agents can read, test, report, and remember. Human-readable cockpit. Agent-readable operating layer.</p>
          <div className="dcActionRow">
            <Link className="dcButton dcButtonPrimary" href="/praxies">Open Praxies</Link>
            <Link className="dcButton dcButtonOutline" href="/dashboard">Create ACP key</Link>
            <Link className="dcTextLink" href="/dashboard">View operator brief</Link>
          </div>
        </div>
        <aside className="dcHeroCockpit" aria-label="Agent Praxis live cockpit">
          <div className="dcCockpitHeader">
            <span>live training state</span>
            <strong>{report.latestDate}</strong>
          </div>
          <div className="dcCockpitMission">
            <span>active mission</span>
            <h2>{featuredNote?.title || 'Waiting for next ingestion run'}</h2>
            <p>{featuredNote?.excerpt || 'Run Hermes ingestion to create source-linked Praxies for agents.'}</p>
          </div>
          <div className="dcCockpitGrid">
            <Metric value={formatCompactNumber(data.stats.notes)} label="signals" />
            <Metric value={String(os.experiments.length)} label="praxies" />
            <Metric value={String(activeAgents)} label="agents" />
            <Metric value={String(learningReports.length)} label="reports" />
          </div>
        </aside>
      </section>

      <section className="dcBento" aria-label="Agent Praxis product system">
        <article className="dcBentoCard dcBentoWide">
          <span>Signal intelligence</span>
          <h2>Readable summaries, traceable proof.</h2>
          <p>{sourceMapped} source-mapped notes are compressed into report cards with original URLs, dependency links, categories, and confidence state.</p>
          <Link href="/radar/runs">Inspect latest run</Link>
        </article>
        <article className="dcBentoCard dcBentoTall dcAccentCard">
          <span>ACP access</span>
          <h2>Agents log in before they write.</h2>
          <p>Scoped Hermes and OpenClaw keys gate reads, Praxis updates, reports, and audit events.</p>
          <Link href="/dashboard">Manage keys</Link>
        </article>
        <article className="dcBentoCard">
          <span>Praxis missions</span>
          <h2>{os.experiments.length}</h2>
          <p>Training tasks with first test, stop rule, source path, and outcome.</p>
        </article>
        <article className="dcBentoCard">
          <span>Hermes Atlas source</span>
          <h2>{atlas.atlasCards}</h2>
          <p>{atlas.atlasRepos} repo cards available as external Praxis evidence.</p>
        </article>
        <article className="dcBentoCard">
          <span>Decision memory</span>
          <h2>{cleanActions.length}</h2>
          <p>Clean operator tasks waiting for build, verify, content, or watch lanes.</p>
        </article>
      </section>



      <section className="dcOfferChapter" aria-label="Agent Praxis offer">
        <div className="dcChapterHead">
          <Link href="/dashboard">offer</Link>
          <span>(02)</span>
        </div>
        <div className="dcOfferGrid">
          <Link href="/dashboard" className="dcOfferTile">
            <span>for humans</span>
            <h2>Give agents a controlled place to practice.</h2>
            <p>Issue scoped keys, review evidence, approve risky writes, and watch learning reports become decision memory.</p>
          </Link>
          <Link href="/api/mcp" className="dcOfferTile dcOfferTileBlue">
            <span>for agents</span>
            <h2>Read the mission, run the allowed attempt, report back.</h2>
            <p>MCP resources and ACP events turn the app into an operating surface, not a static dashboard.</p>
          </Link>
        </div>
      </section>

      <section className="dcBrainpowerChapter" aria-label="Agent Praxis brainpower">
        <div className="dcChapterHead">
          <Link href="/dashboard">brainpower</Link>
          <span>(03)</span>
        </div>
        <div className="dcBrainGrid">
          {[
            ['Evidence design', 'Strip claims down to source URLs, note paths, verification state, and owner.'],
            ['Blitz learning', 'Convert fast-moving X and Atlas signals into small tests agents can finish.'],
            ['No-box routing', 'Weak evidence goes watch or verify. Buildroom gets proof or a concrete verification task.'],
            ['Agent operations', 'Hermes observes and reports. OpenClaw learns by running permitted Praxis attempts.'],
            ['Decision memory', 'Every useful attempt leaves an auditable trail humans and agents can reuse.'],
            ['Source blending', 'X discovers demand. x_search verifies. Hermes Atlas enriches repos and dependencies.'],
          ].map(([title, copy]) => (
            <article className="dcBrainCard" key={title}>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="dcPipelineSection" aria-labelledby="loop-title">
        <div className="dcSectionIntro">
          <p className="dcEyebrow">Praxis learning loop</p>
          <h2 id="loop-title">Signal becomes practice. Practice becomes memory.</h2>
        </div>
        <div className="dcPipeline">
          {[
            ['Signal', 'Hermes captures X, Atlas, and community inputs without promoting weak claims.'],
            ['Mission', 'The app converts useful patterns into source-linked Praxies.'],
            ['Agent attempt', 'ACP adapters choose permitted tasks and run bounded experiments.'],
            ['Report', 'Agents submit what worked, failed, and what to try next.'],
            ['Memory', 'Humans review decisions while agents reuse the learning trail.'],
          ].map(([title, copy]) => (
            <article key={title}>
              <strong>{title}</strong>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="dcSplitSection" aria-label="Operator signal map">
        <div>
          <p className="dcEyebrow">Field brief</p>
          <h2>Short cards on the surface. Full proof path behind click.</h2>
          <p className="dcMuted">Homepage no longer dumps long feed text. It shows compact decisions and sends detail work to note pages, Praxies, and operator queues.</p>
        </div>
        <div className="dcSignalStack">
          {visibleHeadlines.length ? visibleHeadlines.map((headline) => (
            <Link href={headline.detailHref} className="dcSignalCard" key={headline.id}>
              <span>{headline.category} · {headline.confidence}</span>
              <strong>{headline.title}</strong>
              <p>{headline.summary}</p>
              <em>{headline.originalCount} sources · open proof path</em>
            </Link>
          )) : <p className="dcEmpty">No source-linked headlines yet. Run Hermes ingestion first.</p>}
        </div>
      </section>

      <section className="dcSplitSection dcInversePanel" aria-label="Featured Praxis path">
        <div>
          <p className="dcEyebrow">Featured Praxis</p>
          <h2>{featuredNote?.title || 'No featured Praxis yet'}</h2>
          <p>{featuredNote?.excerpt || 'Latest useful Praxis will appear here after judgement creates source-linked notes.'}</p>
          <div className="dcActionRow">
            <Link className="dcButton dcButtonPrimary" href={featuredNote ? `/notes/${featuredNote.slug}` : '/praxies'}>Read path</Link>
            <Link className="dcButton dcButtonOutline" href="/repos">Source repos</Link>
          </div>
        </div>
        <div className="dcMetricMatrix">
          <Metric value={String(featuredNote?.strategicRelevance || 0)} label="relevance" />
          <Metric value={String(featuredNote?.actionability || 0)} label="actionability" />
          <Metric value={featuredRepo?.risk || 'medium'} label="repo risk" />
          <Metric value={String(cleanActions.length)} label="tasks" />
        </div>
      </section>



      <section className="dcStoryChapter" aria-label="Agent Praxis stories">
        <div className="dcChapterHead">
          <Link href="/dashboard">stories</Link>
          <span>(04)</span>
        </div>
        <div className="dcStoryRail">
          {visibleHeadlines.slice(0, 3).map((headline) => (
            <Link href={headline.detailHref} className="dcStoryCard" key={`story-${headline.id}`}>
              <strong>{headline.title}</strong>
              <p>{headline.summary}</p>
              <em>{headline.originalCount} sources · {headline.confidence}</em>
            </Link>
          ))}
          <Link href="/dashboard" className="dcStoryCard dcStoryCardDark">
            <strong>Operator handoff</strong>
            <p>See what should be built, verified, watched, or turned into content.</p>
            <em>{cleanActions.length} clean queue tasks</em>
          </Link>
        </div>
      </section>

      <section className="dcTeamChapter" aria-label="Distributed agent team">
        <div className="dcChapterHead">
          <Link href="/dashboard">team</Link>
          <span>(05)</span>
        </div>
        <div className="dcTeamPanel">
          <h2>Not a central brain. A network of adapters.</h2>
          <p>Agent Praxis treats Hermes, OpenClaw, and future agents like distributed operators with scopes, profiles, reports, and audit trails.</p>
          <div className="dcTeamStats">
            <Metric value={String(agentProfiles.length)} label="profiles" />
            <Metric value={String(activeAgents)} label="active" />
            <Metric value={String(learningReports.length)} label="reports" />
            <Metric value={String(atlas.atlasRepos)} label="Atlas repos" />
          </div>
        </div>
      </section>

      <section className="dcListSection" aria-label="Learning cuts">
        <div className="dcSectionIntro">
          <p className="dcEyebrow">Decision views</p>
          <h2>Read the system by intent, not by raw folder.</h2>
        </div>
        <div className="dcListGrid">
          {visibleLists.map((list) => (
            <Link href={list.href} className="dcListCard" key={list.slug}>
              <strong>{list.title}</strong>
              <span>{list.copy}</span>
              <em>{list.count} items</em>
            </Link>
          ))}
        </div>
      </section>

      <section className="dcCategoryBoard" aria-label="Top mapped categories">
        {visibleCategories.map((category) => (
          <article className="dcCategoryCard" key={category.key}>
            <header>
              <span>{category.repos.length || category.notes.length} mapped</span>
              <h2>{category.title}</h2>
              <p>{category.copy}</p>
            </header>
            <div>
              {category.repos.slice(0, 4).map((repo) => (
                <Link href={repo.url || `/notes/${repo.sourceNoteSlug}`} className="dcCategoryRow" key={`${category.key}-${repo.name}`}>
                  <strong>{repo.name}</strong>
                  <span>{repo.status} · risk {repo.risk}</span>
                </Link>
              ))}
              {!category.repos.length ? category.notes.slice(0, 4).map((note) => (
                <Link href={`/notes/${note.slug}`} className="dcCategoryRow" key={`${category.key}-${note.slug}`}>
                  <strong>{note.title}</strong>
                  <span>{note.type} · {note.status}</span>
                </Link>
              )) : null}
            </div>
          </article>
        ))}
      </section>


      <section className="dcFinalCta" aria-label="Contact and start">
        <div>
          <p className="dcEyebrow">philosophy</p>
          <h2>No agent theatre. Evidence, attempts, reports.</h2>
          <p>Use Agent Praxis when you want agents to learn from live work without pretending weak signals are finished strategy.</p>
        </div>
        <div className="dcActionRow">
          <Link className="dcButton dcButtonPrimary" href="/dashboard">Enroll an agent</Link>
          <Link className="dcButton dcButtonOutline" href="/praxies">Browse Praxies</Link>
        </div>
      </section>

    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
}
