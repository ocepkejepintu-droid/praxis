import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDashboardData } from '@/lib/markdown';
import { readIngestionRun, readIngestionRunHistory } from '@/lib/ingestion-status';

export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return readIngestionRunHistory(80).map((run) => ({ runId: run.id }));
}

export default async function RadarRunDetailPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const run = readIngestionRun(runId);
  if (!run) notFound();
  const data = getDashboardData();
  const runFiles = new Set(run.files || []);
  const notes = data.notes.filter((note) => note.ingestionRunId === run.id || runFiles.has(note.path));
  const merged = readJsonSafe(path.join(process.cwd(), run.paths?.merged || `.omx/ingestion-runs/${run.id}/merged.json`));
  const buckets = merged && typeof merged === 'object' && 'buckets' in merged ? merged.buckets as Record<string, number> : {};
  return (
    <div className="atlasPage">
      <section className="atlasSubHero">
        <Link href="/radar/runs">← runs</Link>
        <p>{run.source || run.mode} · {run.stage || 'discover'} · {run.status}</p>
        <h1>{run.id}</h1>
        <span>{run.message}</span>
      </section>

      <section className="panel statusConsole">
        <div className="sectionHead"><h2>Run manifest</h2><span>{run.startedAt} → {run.finishedAt}</span></div>
        <div className="runStatusGrid">
          <div><span>Status</span><strong className={`run-${run.status}`}>{run.status}</strong></div>
          <div><span>Stage</span><strong>{run.stage || 'discover'}</strong></div>
          <div><span>Cards</span><strong>{run.progress?.cardsWritten ?? run.cardsCreated}</strong></div>
          <div><span>Raw signals</span><strong>{run.progress?.rawSignals ?? run.crawlStats?.signalsExtracted ?? '—'}</strong></div>
          <div><span>Status IDs</span><strong>{run.progress?.statusIds ?? '—'}</strong></div>
          <div><span>Reply fetched</span><strong>{run.progress?.replyFetched ?? '—'}</strong></div>
          <div><span>xSearch</span><strong>{run.progress?.xSearchEnriched ?? 0}</strong></div>
          <div><span>Merged</span><strong>{run.progress?.merged ?? '—'}</strong></div>
          <div><span>Judged</span><strong>{run.progress?.judged ?? '—'}</strong></div>
          <div><span>Agent ready</span><strong>{run.agent_ready ? 'yes' : 'no'}</strong></div>
        </div>
      </section>

      {run.sidecars ? (
        <section className="actionSummaryGrid runBucketGrid" aria-label="Sidecar status">
          <article className="actionMetric"><span>pending xSearch</span><strong>{run.sidecars.pending}</strong><p>sidecars awaiting search enrichment</p></article>
          <article className="actionMetric"><span>xSearch ok</span><strong>{run.sidecars.xSearchOk}</strong><p>sidecars with search result</p></article>
          <article className="actionMetric"><span>reply ok</span><strong>{run.sidecars.replyFetchOk}</strong><p>reply fetch complete</p></article>
          <article className="actionMetric"><span>reply failed</span><strong>{run.sidecars.replyFetchFailed}</strong><p>reply fetch errors</p></article>
        </section>
      ) : null}

      {Object.keys(buckets).length ? (
        <section className="actionSummaryGrid runBucketGrid" aria-label="Judgement buckets">
          {Object.entries(buckets).map(([bucket, count]) => (
            <article className="actionMetric" key={bucket}><span>{bucket}</span><strong>{count}</strong><p>merged judgement bucket</p></article>
          ))}
        </section>
      ) : null}

      <section className="panel runHistoryPanel">
        <div className="sectionHead"><h2>Cards from this run</h2><span>{notes.length || run.files.length} files</span></div>
        <div className="runCardGrid">
          {notes.length ? notes.map((note) => (
            <Link href={`/notes/${note.slug}`} className="runCard" key={note.slug}>
              <span>{note.type} · {note.category}</span>
              <strong>{note.title}</strong>
              <p>{note.excerpt || note.path}</p>
              <em>{note.statusIdentityStatus || 'identity unknown'} · {note.sourceStatusUrl || note.sourceUrls[0] || note.path}</em>
            </Link>
          )) : run.files.map((file) => (
            <article className="runCard" key={file}><span>file</span><strong>{file}</strong><p>No parsed note found for this path.</p></article>
          ))}
        </div>
      </section>

      <section className="panel runHistoryPanel">
        <div className="sectionHead"><h2>Run paths</h2><span>disk owns the run</span></div>
        <pre className="codeBlock">{JSON.stringify(run.paths || {}, null, 2)}</pre>
      </section>
    </div>
  );
}

function readJsonSafe(filePath: string) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  } catch {
    return null;
  }
}
