'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

type ApiResponse = {
  ok: boolean;
  mode?: string;
  exitCode?: number | null;
  timedOut?: boolean;
  status?: string;
  message?: string;
  run?: {
    status?: string;
    cardsCreated?: number;
    message?: string;
    files?: string[];
    verificationGaps?: string[];
    crawlStats?: {
      scrollsCompleted?: number;
      signalsExtracted?: number;
      uniquePosts?: number;
      durationMs?: number;
    };
  };
  stderr?: string;
};

export function IngestionTrigger() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);

  async function trigger(mode: 'live' | 'dry-run') {
    setIsRunning(true);
    setResult(null);
    try {
      const response = await fetch('/api/ingest/x', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, maxScrolls: 18, maxCards: 40, source: 'home' }),
      });
      const payload = await response.json() as ApiResponse;
      setResult(payload);
      startTransition(() => router.refresh());
    } catch (error) {
      setResult({ ok: false, message: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsRunning(false);
    }
  }

  const busy = isRunning || isPending;
  const run = result?.run;
  const resultClass = result ? (result.ok ? `run-${run?.status || 'ok'}` : 'run-failed') : '';

  return (
    <section className="panel triggerPanel">
      <div className="sectionHead">
        <div>
          <p className="eyebrow">Local trigger</p>
          <h2>Run ingestion from this page</h2>
        </div>
        <span>{busy ? 'running…' : 'ready'}</span>
      </div>
      <p className="mutedCopy">This button only runs the pinned local X ingestion script. It cannot execute arbitrary terminal commands.</p>
      <div className="triggerActions">
        <button className="primaryTrigger" disabled={busy} onClick={() => void trigger('live')}>{busy ? 'Running…' : 'Run live X ingestion'}</button>
        <button disabled={busy} onClick={() => void trigger('dry-run')}>Dry-run preview</button>
      </div>
      {result ? (
        <div className={`triggerResult ${resultClass}`}>
          <strong>{result.ok ? `Done: ${run?.status || 'ok'}` : 'Failed'}</strong>
          <span>{run?.message || result.message || result.stderr || 'No message returned.'}</span>
          {typeof run?.cardsCreated === 'number' ? <em>{run.cardsCreated} cards written</em> : null}
          {run?.crawlStats ? <em>{run.crawlStats.scrollsCompleted ?? 0} scrolls · {run.crawlStats.uniquePosts ?? run.crawlStats.signalsExtracted ?? 0} unique posts · {Math.round((run.crawlStats.durationMs ?? 0) / 1000)}s</em> : null}
          {run?.files?.length ? (
            <div className="triggerFiles">
              <strong>Written files</strong>
              {run.files.map((file) => <code key={file}>{file}</code>)}
            </div>
          ) : null}
          {run?.verificationGaps?.length ? (
            <div className="triggerFiles warning">
              <strong>Gaps</strong>
              {run.verificationGaps.map((gap) => <code key={gap}>{gap}</code>)}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
