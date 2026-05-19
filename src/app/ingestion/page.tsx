import Link from 'next/link';
import { CommandConsole } from '@/components/CommandConsole';
import { IngestionTrigger } from '@/components/IngestionTrigger';
import { PipelineStageControls } from '@/components/PipelineStageControls';
import { getDashboardData } from '@/lib/markdown';
import { readIngestionRunHistory, readLatestIngestionRun } from '@/lib/ingestion-status';
import { getOperatingSlice } from '@/lib/os';

export const dynamic = 'force-dynamic';

const pipelineSteps = [
  'Capture raw post, author/context, original URL, resolved URLs, and evidence timestamp.',
  'Write an executive headline and a plain-English summary: what happened, who said it, and what changed.',
  'Categorize into agent-runtime, browser-agent, coding-agent, mcp-cli, model, commerce, content-agent, or scorio.',
  'Map source into one of four outcomes: report headline, repo lead, praxis path, or action. Reject pure engagement bait.',
  'Write detail path sections: Signal, Why it matters, Dependencies, Execution path, Success signal, Stop criteria.',
  'Preserve original post URLs and dependency URLs so every short card has a verification trail.',
];

const requiredFields = [
  'executive_headline',
  'plain_summary',
  'why_it_matters',
  'category',
  'confidence',
  'original_post_url',
  'source_urls',
  'dependency_urls',
  'execution_path',
  'recommended_action',
  'ignore_or_verify_decision',
];

export default function IngestionPage() {
  const os = getOperatingSlice(getDashboardData());
  const command = os.commands.find((item) => item.label === 'Kimi WebBridge ingestion');
  const latestRun = readLatestIngestionRun();
  const runHistory = readIngestionRunHistory();
  return (
    <div className="atlasPage">
      <section className="atlasSubHero"><p>source · hermes inflow</p><h1>Turn raw X into a report.</h1><span>Hermes should not dump long text. It must translate each post into a report unit: headline, summary, reason, source trail, dependency path, execution path, and action decision.</span></section>
      <section className="panel inflowContract">
        <div className="sectionHead"><h2>Hermes report contract</h2><span>what every new X card must contain</span></div>
        <ol className="inlineSteps">{pipelineSteps.map((step) => <li key={step}>{step}</li>)}</ol>
      </section>
      <section className="fieldContract" aria-label="Required Hermes fields">
        <div className="atlasSectionIntro">
          <span>schema</span>
          <h2>Fields Hermes must write</h2>
          <p>If these fields are missing, the UI becomes a dump again. Keep source and dependency URLs separate from prose.</p>
        </div>
        <div className="fieldGrid">
          {requiredFields.map((field) => <code key={field}>{field}</code>)}
        </div>
      </section>
      <IngestionTrigger />
      <PipelineStageControls runId={latestRun?.id} />
      {command ? <CommandConsole commands={[command]} /> : null}
      <section className="panel statusConsole">
        <div className="sectionHead"><h2>Latest ingestion run</h2><span>{latestRun ? latestRun.finishedAt : 'not run yet'}</span></div>
        {latestRun ? (
          <div className="runStatusGrid">
            <div><span>Status</span><strong className={`run-${latestRun.status}`}>{latestRun.status}</strong></div>
            <div><span>Stage</span><strong>{latestRun.stage || 'discover'}</strong></div>
            <div><span>Mode</span><strong>{latestRun.mode}</strong></div>
            <div><span>Cards</span><strong>{latestRun.cardsCreated}</strong></div>
            <div><span>Scrolls</span><strong>{latestRun.crawlStats?.scrollsCompleted ?? '—'}</strong></div>
            <div><span>Unique posts</span><strong>{latestRun.crawlStats?.uniquePosts ?? latestRun.crawlStats?.signalsExtracted ?? '—'}</strong></div>
            <div><span>Status IDs</span><strong>{latestRun.progress?.statusIds ?? '—'}</strong></div>
            <div><span>xSearch</span><strong>{latestRun.progress?.xSearchEnriched ?? 0}</strong></div>
            <div><span>Merged</span><strong>{latestRun.progress?.merged ?? '—'}</strong></div>
            <div><span>Agent ready</span><strong>{latestRun.agent_ready ? 'yes' : 'no'}</strong></div>
            <div><span>Rejected</span><strong>{latestRun.rejectedCount}</strong></div>
            <div><span>Kimi daemon</span><strong>{latestRun.health.running ? 'running' : 'down'}</strong></div>
            <div><span>Extension</span><strong>{latestRun.health.extension_connected ? 'connected' : 'not connected'}</strong></div>
          </div>
        ) : <p className="mutedCopy">Run <code>npm run ingest:x -- --dry-run</code> to create the first preview status.</p>}
        {latestRun ? <p className="mutedCopy">{latestRun.message}</p> : null}
        {latestRun ? <div className="featuredActions"><Link href={`/radar/runs/${latestRun.id}`}>Open run detail</Link><Link href="/radar/runs">Browse runs by date</Link></div> : null}
        {latestRun?.files.length ? (
          <div className="latestFiles">
            <strong>Latest files written</strong>
            <pre className="codeBlock">{latestRun.files.join('\n')}</pre>
          </div>
        ) : null}
        {latestRun?.verificationGaps.length ? <div className="gapList"><strong>Verification gaps</strong>{latestRun.verificationGaps.map((gap) => <span key={gap}>{gap}</span>)}</div> : null}
      </section>

      <section className="panel runHistoryPanel">
        <div className="sectionHead"><h2>Run history</h2><span>{runHistory.length ? `${runHistory.length} local runs` : 'empty'}</span></div>
        {runHistory.length ? (
          <div className="runHistoryList">
            {runHistory.map((run) => (
              <article className="runHistoryItem" key={run.id}>
                <div>
                  <strong><Link href={`/radar/runs/${run.id}`}>{run.id}</Link></strong>
                  <span>{run.startedAt} → {run.finishedAt}</span>
                </div>
                <div className="metaRow">
                  <span className={`pill run-${run.status}`}>{run.status}</span>
                  <span className="pill">{run.stage || 'discover'}</span>
                  <span className="pill">{run.mode}</span>
                  <span className="pill">{run.cardsCreated} cards</span>
                  {run.crawlStats ? <span className="pill">{run.crawlStats.scrollsCompleted ?? 0} scrolls</span> : null}
                  {run.crawlStats ? <span className="pill">{run.crawlStats.uniquePosts ?? run.crawlStats.signalsExtracted ?? 0} posts</span> : null}
                  <span className="pill">{run.verificationGaps.length} gaps</span>
                </div>
                <p className="mutedCopy">{run.message}</p>
              </article>
            ))}
          </div>
        ) : <p className="mutedCopy">Run history appears after <code>npm run ingest:x -- --dry-run</code> or a live attempt.</p>}
      </section>

      <section className="grid two">
        <div className="panel">
          <div className="sectionHead"><h2>Report pipeline</h2><span>daily or 3x/week</span></div>
          <ol className="stepList">{pipelineSteps.map((step) => <li key={step}>{step}</li>)}</ol>
        </div>
        <div className="panel">
          <div className="sectionHead"><h2>Output contract</h2><span>write these files</span></div>
          <pre className="codeBlock">{`Inbox/YYYY-MM-DD X Capture.md
Repos/<repo>.md
Use Cases/<use-case>.md
Scorio Ideas/<idea>.md
Experiments/<praxis>.md
Weekly Syntheses/YYYY-WW.md`}</pre>
        </div>
      </section>
    </div>
  );
}
