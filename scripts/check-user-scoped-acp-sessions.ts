#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }
const originalCwd = process.cwd();
const repoRoot = originalCwd;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-radar-user-scope-'));
process.chdir(tmp);
process.env.AGENT_PRAXIS_TOKEN = 'setup-token-regression';

try {
  const stamp = Date.now();
  const accounts = await import(`../src/lib/accounts.ts?user_scope=${stamp}`);
  const acp = await import(`../src/lib/acp.ts?user_scope=${stamp}`);
  const sessions = await import(`../src/lib/user-sessions.ts?user_scope=${stamp}`);

  const userA = accounts.createUserAccount({ email: 'alpha@example.com', name: 'Alpha', password: 'correct horse alpha', role: 'editor' });
  const userB = accounts.createUserAccount({ email: 'beta@example.com', name: 'Beta', password: 'correct horse beta', role: 'editor' });
  const keyA = acp.createAcpApiKey({ name: 'Alpha Hermes', owner: userA.email, ownerUserId: userA.id, adapter: 'hermes' });
  const keyB = acp.createAcpApiKey({ name: 'Beta OpenClaw', owner: userB.email, ownerUserId: userB.id, adapter: 'openclaw' });
  assert(keyA.record.ownerUserId === userA.id, 'key A should keep owner user id');
  assert(keyB.record.ownerUserId === userB.id, 'key B should keep owner user id');
  assert(acp.verifyAcpApiKey(keyA.key)?.ownerUserId === userA.id, 'verified key should preserve user owner id');

  const sessionA = sessions.createUserSessionRecord({ ownerUserId: userA.id, owner: userA.email, title: 'Alpha Session', adapter: 'hermes', summary: 'Alpha summary', notes: 'Alpha notes' });
  const sessionB = sessions.createUserSessionRecord({ ownerUserId: userB.id, owner: userB.email, title: 'Beta Session', adapter: 'openclaw', summary: 'Beta summary', notes: 'Beta notes' });
  assert(sessions.listUserSessions(userA.id).length === 1 && sessions.listUserSessions(userA.id)[0].id === sessionA.id, 'user A should see only own session');
  assert(sessions.listUserSessions(userB.id).length === 1 && sessions.listUserSessions(userB.id)[0].id === sessionB.id, 'user B should see only own session');
  assert(!sessions.updateUserSessionRecord(userA.id, sessionB.id, { status: 'archived' }), 'user A must not update user B session');
  const archived = sessions.updateUserSessionRecord(userA.id, sessionA.id, { status: 'archived' });
  assert(archived?.status === 'archived', 'user A should update own session');

  const keysRoute = fs.readFileSync(path.join(repoRoot, 'src/app/api/acp/keys/route.ts'), 'utf8');
  for (const needle of ['ownerUserId', 'auth.kind === \'user\'', 'filter((key) => key.ownerUserId === auth.user.id', 'limitPermissions']) assert(keysRoute.includes(needle), `keys route missing ${needle}`);
  const revokeRoute = fs.readFileSync(path.join(repoRoot, 'src/app/api/acp/keys/[id]/route.ts'), 'utf8');
  assert(revokeRoute.includes('existing.ownerUserId === auth.user.id') && revokeRoute.includes('canRevoke'), 'revoke route must enforce owner checks');
  const sessionRoute = fs.readFileSync(path.join(repoRoot, 'src/app/api/acp/sessions/route.ts'), 'utf8');
  assert(sessionRoute.includes('listUserSessions') && sessionRoute.includes('createUserSessionRecord') && sessionRoute.includes('ownerId(auth)'), 'session route missing owner-scoped operations');
  const manager = fs.readFileSync(path.join(repoRoot, 'src/components/UserSessionManager.tsx'), 'utf8');
  assert(manager.includes('/api/acp/sessions') && manager.includes('Your saved sessions'), 'dashboard session manager missing');

  console.log(JSON.stringify({ ok: true, tmp, keyOwners: [keyA.record.ownerUserId, keyB.record.ownerUserId], sessions: [sessionA.id, sessionB.id] }, null, 2));
} finally {
  process.chdir(originalCwd);
  fs.rmSync(tmp, { recursive: true, force: true });
}
