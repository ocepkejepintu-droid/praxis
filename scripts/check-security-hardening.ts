#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }
const originalCwd = process.cwd();
const repoRoot = originalCwd;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-radar-security-'));
process.chdir(tmp);

try {
  const stamp = Date.now();
  const accounts = await import(`../src/lib/accounts.ts?security=${stamp}`);
  const acp = await import(`../src/lib/acp.ts?security=${stamp}`);
  const ingestAuth = await import(`../src/lib/ingest-auth.ts?security=${stamp}`);

  const userA = accounts.createUserAccount({ email: 'alpha@example.com', name: 'Alpha', password: 'correct horse alpha', role: 'editor' });
  const userB = accounts.createUserAccount({ email: 'beta@example.com', name: 'Beta', password: 'correct horse beta', role: 'editor' });
  const keyA = acp.createAcpApiKey({ name: 'Alpha Hermes', owner: userA.email, ownerUserId: userA.id, adapter: 'hermes' });
  const keyB = acp.createAcpApiKey({ name: 'Beta Hermes', owner: userB.email, ownerUserId: userB.id, adapter: 'hermes' });
  const env = process.env as Record<string, string | undefined>;
  const oldEnv = env.NODE_ENV;
  const oldToken = env.HERMES_INGEST_TOKEN;
  env.NODE_ENV = 'production';
  delete env.HERMES_INGEST_TOKEN;
  assert(!ingestAuth.isHermesIngestAuthorized(new Request('http://local.test')), 'production ingest without token must be denied');
  env.HERMES_INGEST_TOKEN = 'secret-token';
  assert(ingestAuth.isHermesIngestAuthorized(new Request('http://local.test', { headers: { authorization: 'Bearer secret-token' } })), 'correct production token should pass');
  assert(!ingestAuth.isHermesIngestAuthorized(new Request('http://local.test', { headers: { authorization: 'Bearer wrong-token' } })), 'wrong production token should fail');
  if (oldEnv === undefined) delete env.NODE_ENV; else env.NODE_ENV = oldEnv;
  if (oldToken === undefined) delete env.HERMES_INGEST_TOKEN; else env.HERMES_INGEST_TOKEN = oldToken;

  const scopeText = fs.readFileSync(path.join(repoRoot, 'src/lib/access-scope.ts'), 'utf8');
  for (const needle of ['visibleAcpKeysForAuth', 'ownerUserId === auth.user.id', 'key.id === auth.key.id', 'visibleLearningReportsForAuth']) assert(scopeText.includes(needle), `access scope missing ${needle}`);

  const mcpRoute = fs.readFileSync(path.join(repoRoot, 'src/app/api/mcp/route.ts'), 'utf8');
  assert(mcpRoute.includes("{ name: 'list_agent_profiles', auth: true") && mcpRoute.includes("{ name: 'list_learning_reports', auth: true"), 'MCP sensitive agent/report tools must require auth');
  assert(mcpRoute.includes('Missing read_reports permission') && mcpRoute.includes('visibleAgentProfilesForAuth') && mcpRoute.includes('visibleLearningReportsForAuth'), 'MCP route must scope private agent/report reads');
  assert(mcpRoute.includes('ACP agents and learning reports require read_reports permission'), 'MCP manifest must explain private report resources');
  assert(mcpRoute.includes('({ name, auth, description, inputSchema }) => ({ name, auth, description'), 'MCP tools/list must expose auth requirements');

  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  assert(pkg.overrides?.postcss === '8.5.14', 'package override should pin patched postcss');
  console.log(JSON.stringify({ ok: true, tmp, keyOwners: [keyA.record.ownerUserId, keyB.record.ownerUserId] }, null, 2));
} finally {
  process.chdir(originalCwd);
  fs.rmSync(tmp, { recursive: true, force: true });
}
