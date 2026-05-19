'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

const stages = [
  { key: 'enrich', label: 'Prepare enrichment' },
  { key: 'replies', label: 'Fetch first replies' },
  { key: 'judge', label: 'Merge + judge' },
  { key: 'x-search', label: 'Prepare x_search worklist' },
  { key: 'hermes-atlas', label: 'Ingest Hermes Atlas' },
] as const;

export function PipelineStageControls({ runId }: { runId?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [running, setRunning] = useState<string | null>(null);
  const [message, setMessage] = useState<string>('');

  async function runStage(stage: string) {
    if (!runId) return;
    setRunning(stage);
    setMessage('');
    try {
      const response = await fetch(`/api/hermes/ingest/${encodeURIComponent(runId)}/${stage}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stage === 'replies' ? { limit: 10 } : stage === 'x-search' ? { action: 'list', limit: 10 } : stage === 'hermes-atlas' ? { limit: 30, sinceDays: 30 } : {}),
      });
      const payload = await response.json() as { ok?: boolean; stdout?: string; stderr?: string; message?: string };
      setMessage(payload.ok ? (payload.stdout || 'Stage complete.') : (payload.message || payload.stderr || 'Stage failed.'));
      startTransition(() => router.refresh());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setRunning(null);
    }
  }

  const busy = Boolean(running) || isPending;
  return (
    <section className="panel triggerPanel">
      <div className="sectionHead"><div><p className="eyebrow">Staged pipeline</p><h2>Resume latest run</h2></div><span>{runId || 'no run'}</span></div>
      <p className="mutedCopy">Stages are idempotent over disk artifacts. Browser can die; markdown and sidecars stay usable.</p>
      <div className="triggerActions">
        {stages.map((stage) => <button key={stage.key} disabled={!runId || busy} onClick={() => void runStage(stage.key)}>{running === stage.key ? 'Running…' : stage.label}</button>)}
      </div>
      {message ? <pre className="codeBlock">{message}</pre> : null}
    </section>
  );
}
