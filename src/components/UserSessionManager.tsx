'use client';

import { useState } from 'react';
import type { UserSavedSession } from '@/lib/user-sessions';
import type { AcpAdapter } from '@/lib/acp';

export function UserSessionManager({ initialSessions }: { initialSessions: UserSavedSession[] }) {
  const [sessions, setSessions] = useState(initialSessions);
  const [title, setTitle] = useState('Hermes learning session');
  const [adapter, setAdapter] = useState<AcpAdapter>('hermes');
  const [summary, setSummary] = useState('Save current Praxis learning context.');
  const [notes, setNotes] = useState('What should this agent remember for this session?');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function createSession(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/acp/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, adapter, summary, notes }) });
      const payload = await response.json() as { ok?: boolean; session?: UserSavedSession; message?: string };
      if (!response.ok || !payload.ok || !payload.session) {
        setMessage(payload.message || 'Session save failed.');
        return;
      }
      setSessions((current) => [payload.session!, ...current]);
      setMessage('Session saved to your account.');
    } finally {
      setBusy(false);
    }
  }

  async function archive(id: string) {
    const response = await fetch(`/api/acp/sessions/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'archived' }) });
    const payload = await response.json() as { ok?: boolean; session?: UserSavedSession; message?: string };
    if (!response.ok || !payload.ok || !payload.session) {
      setMessage(payload.message || 'Archive failed.');
      return;
    }
    setSessions((current) => current.map((session) => session.id === id ? payload.session! : session));
  }

  return (
    <section className="acpConsole" id="user-sessions">
      <form className="acpKeyForm panel" onSubmit={createSession}>
        <div className="sectionHead"><h2>Save user session</h2><span>per account</span></div>
        <p className="mutedCopy">Each user can save their own Praxis learning sessions. Hermes/OpenClaw keys created by that user can also append session events.</p>
        <label><span>Session title</span><input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label><span>Adapter</span><select value={adapter} onChange={(event) => setAdapter(event.target.value as AcpAdapter)}><option value="hermes">Hermes</option><option value="openclaw">OpenClaw</option></select></label>
        <label><span>Summary</span><input value={summary} onChange={(event) => setSummary(event.target.value)} /></label>
        <label><span>Notes</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} /></label>
        <button disabled={busy || !title.trim()}>{busy ? 'Saving…' : 'Save session'}</button>
        {message ? <p className="mutedCopy">{message}</p> : null}
      </form>
      <section className="panel acpKeyTable">
        <div className="sectionHead"><h2>Your saved sessions</h2><span>{sessions.length} sessions</span></div>
        <div className="keyRows">
          {sessions.map((session) => (
            <article className="keyRow" key={session.id}>
              <div><strong>{session.title}</strong><span>{session.owner} · {session.adapter} · {session.status}</span></div>
              <div><span>created {session.createdAt.slice(0, 10)}</span><span>updated {session.updatedAt.slice(0, 10)}</span></div>
              <p>{session.summary}</p>
              <p>{session.notes}</p>
              {session.status !== 'archived' ? <button type="button" onClick={() => void archive(session.id)}>Archive</button> : null}
            </article>
          ))}
          {!sessions.length ? <p className="dcEmpty">No saved sessions for this user yet.</p> : null}
        </div>
      </section>
    </section>
  );
}
