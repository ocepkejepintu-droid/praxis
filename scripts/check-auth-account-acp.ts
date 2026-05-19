#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }
const originalCwd = process.cwd();
const repoRoot = originalCwd;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-radar-auth-acp-'));
process.chdir(tmp);
process.env.AGENT_PRAXIS_TOKEN = 'setup-token-regression';

try {
  const accounts = await import(`../src/lib/accounts.ts?auth=${Date.now()}`);
  const acp = await import(`../src/lib/acp.ts?auth=${Date.now()}`);
  assert(!accounts.hasUserAccounts(), 'temp cwd should start with no accounts');
  const user = accounts.createUserAccount({ email: 'founder@example.com', name: 'Founder', password: 'correct horse battery', role: 'admin' });
  const session = accounts.createUserSession(user.id);
  assert(accounts.verifyUserSession(session)?.email === 'founder@example.com', 'session should verify');
  const created = acp.createAcpApiKey({ name: 'Hermes reporter', owner: user.email, adapter: 'hermes', permissions: ['read_signals', 'admin_settings'], createdBy: `${user.name} <${user.email}>` });
  assert(created.key.startsWith('apx_hermes_'), 'raw key missing or wrong prefix');
  assert(created.record.owner === 'founder@example.com', 'owner should be logged-in user email');
  assert(created.record.createdBy === 'Founder <founder@example.com>', 'createdBy should record human actor');
  assert(!('keyHash' in created.record), 'public key record must not expose keyHash');
  const verified = acp.verifyAcpApiKey(created.key);
  assert(verified?.id === created.record.id, 'raw ACP key should verify');
  assert(acp.canAcpKey(verified, 'admin_settings'), 'created key should have admin_settings permission');
  const routeText = fs.readFileSync(path.join(repoRoot, 'src/app/api/acp/keys/route.ts'), 'utf8');
  assert(routeText.includes('getRequestAuth') && routeText.includes('requestOwnerLabel') && routeText.includes('createdBy'), 'ACP key route must derive owner/actor from auth');
  console.log(JSON.stringify({ ok: true, tmp, user: user.email, keyPreview: created.record.keyPreview }, null, 2));
} finally {
  process.chdir(originalCwd);
  fs.rmSync(tmp, { recursive: true, force: true });
}
