'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type AuthStatus = {
  ok?: boolean;
  hasAccounts: boolean;
  hasSetupToken: boolean;
  user?: { email: string; name: string } | null;
};

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next') || '/dashboard';
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [legacyToken, setLegacyToken] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch('/api/auth/status').then((response) => response.json()).then((payload: AuthStatus) => setStatus(payload)).catch(() => setStatus({ hasAccounts: true, hasSetupToken: false, user: null }));
  }, []);

  async function submitAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const firstAdmin = status?.hasAccounts === false;
      const response = await fetch(firstAdmin ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(firstAdmin ? { email, name, password, setupToken } : { email, password }),
      });
      const payload = await response.json() as { ok?: boolean; message?: string };
      if (!response.ok || !payload.ok) {
        setMessage(payload.message || 'Login failed.');
        return;
      }
      router.push(next);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function submitLegacy(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: legacyToken }) });
      const payload = await response.json() as { ok?: boolean; message?: string };
      if (!response.ok || !payload.ok) {
        setMessage(payload.message || 'Legacy token login failed.');
        return;
      }
      router.push(next);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!status) return <p className="mutedCopy">Checking account state…</p>;
  if (status.user) {
    return (
      <div className="loginForm">
        <div className="keyReveal"><span>signed in</span><code>{status.user.name} · {status.user.email}</code></div>
        <button type="button" onClick={() => router.push(next)}>Continue to ACP key builder</button>
      </div>
    );
  }

  const firstAdmin = status.hasAccounts === false;
  return (
    <div className="authStack">
      <form className="loginForm" onSubmit={submitAccount}>
        <div className="sectionHead"><h2>{firstAdmin ? 'Create first admin' : 'Login with account'}</h2><span>{firstAdmin ? 'one-time setup' : 'human access'}</span></div>
        <label><span>Email</span><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="you@example.com" autoFocus /></label>
        {firstAdmin ? <label><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Yoseph" /></label> : null}
        <label><span>Password</span><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="minimum 10 characters" /></label>
        {firstAdmin ? <label><span>Setup token</span><input value={setupToken} onChange={(event) => setSetupToken(event.target.value)} type="password" placeholder="AGENT_PRAXIS_TOKEN or HERMES_INGEST_TOKEN" /></label> : null}
        <button disabled={busy || !email || !password || (firstAdmin && !setupToken)}>{busy ? 'Working…' : firstAdmin ? 'Create admin and continue' : 'Login and continue'}</button>
        {message ? <p className="mutedCopy">{message}</p> : null}
      </form>

      <details className="legacyLogin panel">
        <summary>Legacy token fallback</summary>
        <form className="loginForm" onSubmit={submitLegacy}>
          <label><span>Praxis edit token</span><input value={legacyToken} onChange={(event) => setLegacyToken(event.target.value)} type="password" placeholder="AGENT_PRAXIS_TOKEN or HERMES_INGEST_TOKEN" /></label>
          <button disabled={busy || !legacyToken}>Unlock with legacy token</button>
        </form>
      </details>
    </div>
  );
}
