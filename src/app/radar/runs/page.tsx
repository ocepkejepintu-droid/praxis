import Link from 'next/link';
import { groupRunsByDate, readIngestionRunHistory, readLatestIngestionRun, readLatestHermesAtlasRun } from '@/lib/ingestion-status';
import { getHermesAtlasStatus } from '@/lib/hermes-atlas';

export const dynamic = 'force-dynamic';

export default function RadarRunsPage() {
  const latestRun = readLatestIngestionRun();
  const runs = readIngestionRunHistory(80);
  const latestAtlasRun = readLatestHermesAtlasRun();
  const atlas = getHermesAtlasStatus();
  const grouped = groupRunsByDate(runs);
  return (
    <div className="atlasPage">
      <section className="atlasSubHero">
        <p>run spine · ingestion memory</p>
        <h1>Know which X run created what.</h1>
        <span>Every staged ingestion should be traceable by date, run ID, source cards, enrichment state, merged judgement, and promoted praxis path.</span>
      </section>

      {latestRun ? (
        <section className="panel statusConsole runFocusPanel">
          <div className="sectionHead"><h2>Latest run</h2><span>{latestRun.stage || 'discover'} · {latestRun.finishedAt}</span></div>
          <div className="runStatusGrid">
            <div><span>Status</span><strong className={`run-${latestRun.status}`}>{latestRun.status}</strong></div>
            <div><span>Stage</span><strong>{latestRun.stage || 'discover'}</strong></div>
            <div><span>Cards</span><strong>{latestRun.progress?.cardsWritten ?? latestRun.cardsCreated}</strong></div>
            <div><span>Status IDs</span><strong>{latestRun.progress?.statusIds ?? '—'}</strong></div>
            <div><span>Replies</span><strong>{latestRun.progress?.replyFetched ?? '—'}</strong></div>
            <div><span>xSearch</span><strong>{latestRun.progress?.xSearchEnriched ?? 0}</strong></div>
            <div><span>Merged</span><strong>{latestRun.progress?.merged ?? '—'}</strong></div>
            <div><span>Judged</span><strong>{latestRun.progress?.judged ?? '—'}</strong></div>
            <div><span>Agent ready</span><strong>{latestRun.agent_ready ? 'yes' : 'no'}</strong></div>
          </div>
          <p className="mutedCopy">{latestRun.message}</p>
          <div className="featuredActions"><Link href={`/radar/runs/${latestRun.id}`}>Open latest run</Link><Link href="/ingestion">Ingestion console</Link></div>
        </section>
      ) : null}

      <section className="panel statusConsole runFocusPanel">
        <div className="sectionHead"><h2>Hermes Atlas source</h2><span>{latestAtlasRun?.finishedAt || 'not ingested'}</span></div>
        <div className="runStatusGrid">
          <div><span>Atlas cards</span><strong>{atlas.atlasCards}</strong></div>
          <div><span>Repos</span><strong>{atlas.atlasRepos}</strong></div>
          <div><span>Summaries</span><strong>{atlas.atlasSummaries}</strong></div>
          <div><span>Applied</span><strong>{atlas.atlasApplied ? 'yes' : 'no'}</strong></div>
        </div>
        <p className="mutedCopy">Run <code>npm run ingest:atlas -- --max-cards 30 --since-days 30</code>. It preserves latest X run and writes latest Hermes Atlas status separately.</p>
        {latestAtlasRun ? <div className="featuredActions"><Link href={`/radar/runs/${latestAtlasRun.id}`}>Open latest Atlas run</Link></div> : null}
      </section>

      <section className="panel runHistoryPanel">
        <div className="sectionHead"><h2>Runs by date</h2><span>{runs.length} local runs</span></div>
        <div className="runDateStack">
          {grouped.map((group) => (
            <article className="runDateGroup" key={group.date}>
              <header><strong>{group.date}</strong><span>{group.runs.length} runs</span></header>
              <div className="runHistoryList">
                {group.runs.map((run) => (
                  <Link className="runHistoryItem runHistoryLink" href={`/radar/runs/${run.id}`} key={run.id}>
                    <div>
                      <strong>{run.id}</strong>
                      <span>{run.startedAt} → {run.finishedAt}</span>
                    </div>
                    <div className="metaRow">
                      <span className={`pill run-${run.status}`}>{run.status}</span>
                      <span className="pill">{run.stage || 'discover'}</span>
                      <span className="pill">{run.source || run.mode}</span>
                      <span className="pill">{run.progress?.cardsWritten ?? run.cardsCreated} cards</span>
                      <span className="pill">{run.progress?.statusIds ?? 0} ids</span>
                      <span className="pill">{run.progress?.xSearchEnriched ?? 0} xSearch</span>
                      <span className="pill">{run.progress?.merged ?? 0} merged</span>
                      <span className="pill">agent {run.agent_ready ? 'ready' : 'pending'}</span>
                    </div>
                    <p className="mutedCopy">{run.message}</p>
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
