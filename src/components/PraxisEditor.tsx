'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const stages = ['worth_trying', 'queued', 'verifying', 'learning', 'tried', 'adopted', 'killed'];
const statuses = ['inbox', 'verify', 'test', 'learning', 'adopt', 'watch', 'ignore', 'promoted', 'blocked'];
const quickMoves = [
  { label: 'Verify source', stage: 'verifying', status: 'verify' },
  { label: 'Start learning', stage: 'learning', status: 'learning' },
  { label: 'Mark tried', stage: 'tried', status: 'test' },
  { label: 'Adopt', stage: 'adopted', status: 'adopt' },
  { label: 'Kill', stage: 'killed', status: 'ignore' },
];

type Props = {
  slug: string;
  initialMarkdown: string;
  initialStage?: string;
  initialStatus: string;
};

export function PraxisEditor({ slug, initialMarkdown, initialStage = 'queued', initialStatus }: Props) {
  const router = useRouter();
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [stage, setStage] = useState(initialStage);
  const [status, setStatus] = useState(initialStatus);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(nextStage = stage, nextStatus = status, nextMarkdown = markdown) {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/praxies/${encodeURIComponent(slug)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: nextStage, status: nextStatus, markdown: nextMarkdown }),
      });
      const payload = await response.json() as { ok?: boolean; message?: string };
      if (!response.ok || !payload.ok) {
        setMessage(payload.message || 'Save failed.');
        return;
      }
      setStage(nextStage);
      setStatus(nextStatus);
      setMarkdown(nextMarkdown);
      setMessage('Praxis saved and audit event appended.');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel praxisEditorPanel">
      <div className="sectionHead"><h2>Praxis editor</h2><span>status + markdown</span></div>
      <p className="mutedCopy">Move Praxis through verify → learning → tried/adopted/killed. Each save writes markdown metadata and ACP audit event.</p>
      <div className="praxisQuickMoves">
        {quickMoves.map((move) => <button type="button" disabled={busy} key={move.label} onClick={() => void save(move.stage, move.status)}>{move.label}</button>)}
      </div>
      <div className="praxisControls">
        <label><span>Stage</span><select value={stage} onChange={(event) => setStage(event.target.value)}>{stages.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
        <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
      </div>
      <textarea value={markdown} onChange={(event) => setMarkdown(event.target.value)} spellCheck={false} />
      <div className="featuredActions"><button className="primaryTrigger" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save praxis'}</button></div>
      {message ? <p className="mutedCopy">{message}</p> : null}
    </section>
  );
}
