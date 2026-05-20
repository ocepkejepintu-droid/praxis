'use client';

import { useState } from 'react';
import type { AcpAdapter, AcpPermission, PublicAcpApiKey } from '@/lib/acp';

const permissions: AcpPermission[] = ['read_signals', 'read_reports', 'read_praxies', 'create_praxis', 'update_praxis_status', 'submit_learning_report', 'append_acp_event', 'run_experiment_marker', 'admin_settings'];
const adapterDefaults: Record<AcpAdapter, AcpPermission[]> = {
  hermes: ['read_signals', 'read_reports', 'read_praxies', 'create_praxis', 'submit_learning_report', 'append_acp_event'],
  openclaw: ['read_signals', 'read_reports', 'read_praxies', 'update_praxis_status', 'submit_learning_report', 'append_acp_event', 'run_experiment_marker'],
};

export function AcpKeyManager({ initialKeys, defaultOwner }: { initialKeys: PublicAcpApiKey[]; defaultOwner?: string }) {
  const [keys, setKeys] = useState(initialKeys);
  const [rawKey, setRawKey] = useState('');
  const [message, setMessage] = useState('');
  const [name, setName] = useState('Hermes reporter');
  const [owner, setOwner] = useState(defaultOwner || 'Yoseph');
  const [adapter, setAdapter] = useState<AcpAdapter>('hermes');
  const [selectedPermissions, setSelectedPermissions] = useState<AcpPermission[]>(adapterDefaults.hermes);

  function togglePermission(permission: AcpPermission) {
    setSelectedPermissions((current) => current.includes(permission) ? current.filter((item) => item !== permission) : [...current, permission]);
  }

  async function createKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setRawKey('');
    const response = await fetch('/api/acp/keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, owner, adapter, permissions: selectedPermissions }) });
    const payload = await response.json() as { ok?: boolean; key?: string; record?: PublicAcpApiKey; message?: string };
    if (!response.ok || !payload.ok || !payload.record || !payload.key) {
      setMessage(payload.message || 'Key creation failed.');
      return;
    }
    setKeys((current) => [payload.record!, ...current]);
    setRawKey(payload.key);
    setMessage('API key created. Copy it now; only hash is stored.');
  }

  async function revoke(id: string) {
    const response = await fetch(`/api/acp/keys/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const payload = await response.json() as { ok?: boolean; record?: PublicAcpApiKey; message?: string };
    if (!response.ok || !payload.ok || !payload.record) {
      setMessage(payload.message || 'Revoke failed.');
      return;
    }
    setKeys((current) => current.map((key) => key.id === id ? payload.record! : key));
    setMessage('API key revoked.');
  }

  return (
    <div className="acpConsole">
      <form className="acpKeyForm panel" onSubmit={createKey}>
        <div className="sectionHead"><h2>Create ACP API key</h2><span>shown once</span></div>
        <p className="mutedCopy">Create one scoped adapter key per agent. Copy raw key once, then store it in Hermes/OpenClaw as Bearer auth. Both adapters can connect, read Praxis context, and submit learning reports.</p>
        <label><span>Key name</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label><span>Owner</span><input value={owner} onChange={(event) => setOwner(event.target.value)} /></label>
        <label><span>Adapter</span><select value={adapter} onChange={(event) => {
          const next = event.target.value as AcpAdapter;
          setAdapter(next);
          setSelectedPermissions(adapterDefaults[next]);
          setName(next === 'hermes' ? 'Hermes reporter' : 'OpenClaw learner');
        }}><option value="hermes">Hermes</option><option value="openclaw">OpenClaw</option></select></label>
        <div className="permissionGrid" aria-label="ACP permission scopes">
          {permissions.map((permission) => <label key={permission}><input type="checkbox" checked={selectedPermissions.includes(permission)} onChange={() => togglePermission(permission)} /> <span>{formatPermission(permission)}</span></label>)}
        </div>
        <button>Create key</button>
        {rawKey ? <div className="keyReveal"><span>copy now</span><code>{rawKey}</code><pre>{`${adapter === 'openclaw' ? 'OPENCLAW' : 'HERMES'}_ACP_API_KEY=${rawKey}
GET /api/acp/connect
GET /api/acp/${adapter}/learning-context
POST /api/acp/${adapter}/learning-report`}</pre></div> : null}
        {message ? <p className="mutedCopy">{message}</p> : null}
      </form>
      <section className="panel acpKeyTable">
        <div className="sectionHead"><h2>Agent access keys</h2><span>{keys.length} keys</span></div>
        <div className="keyRows">
          {keys.map((key) => (
            <article className="keyRow" key={key.id}>
              <div><strong>{key.name}</strong><span>{key.owner} · {key.adapter} · {key.keyPreview}</span></div>
              <div><span>{key.status}</span><span>created {key.createdAt.slice(0, 10)}</span><span>last used {key.lastUsedAt?.slice(0, 10) || 'never'}</span>{key.createdBy ? <span>by {key.createdBy}</span> : null}</div>
              <p>{key.permissions.map(formatPermission).join(' · ')}</p>
              {key.status === 'active' ? <button onClick={() => void revoke(key.id)}>Revoke</button> : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function formatPermission(permission: string) {
  return permission.replace(/_/g, ' ');
}
