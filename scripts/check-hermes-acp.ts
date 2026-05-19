#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }

const originalCwd = process.cwd();
const repoRoot = originalCwd;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-radar-hermes-acp-'));
process.chdir(tmp);

try {
  const acp = await import(`../src/lib/acp.ts?hermes_acp=${Date.now()}`);
  const created = acp.createAcpApiKey({ name: 'Hermes reporter', owner: 'yoseph@example.com', adapter: 'hermes' });
  assert(created.key.startsWith('apx_hermes_'), 'Hermes key must use hermes prefix');
  assert(!('keyHash' in created.record), 'public ACP record must not expose hash');
  for (const permission of ['read_signals', 'read_reports', 'read_praxies', 'create_praxis', 'submit_learning_report', 'append_acp_event']) {
    assert(created.record.permissions.includes(permission), `Hermes default missing ${permission}`);
  }
  const verified = acp.verifyAcpApiKey(created.key);
  assert(verified?.id === created.record.id, 'Hermes raw key should verify');
  assert(acp.canAcpKey(verified, 'submit_learning_report'), 'Hermes key should be able to submit learning reports');

  const files = [
    'src/lib/hermes-acp.ts',
    'src/app/api/acp/connect/route.ts',
    'src/app/api/acp/hermes/learning-context/route.ts',
    'src/app/api/acp/hermes/learning-report/route.ts',
    'src/lib/school-progress.ts',
    'src/lib/praxis-learning.ts',
    'src/app/api/acp/praxis-learning/status/route.ts',
    'src/app/api/acp/praxis-learning/run/route.ts',
    'src/app/api/acp/praxis-learning/reports/route.ts',
    'src/app/api/acp/school/status/route.ts',
    'src/app/api/acp/school/courses/route.ts',
    'src/app/api/acp/school/progress/route.ts',
    'src/app/api/acp/school/progress-log/route.ts',
    'src/app/api/mcp/route.ts',
    'src/components/AcpKeyManager.tsx',
  ];
  for (const file of files) assert(fs.existsSync(path.join(repoRoot, file)), `${file} missing`);

  const hermesHelper = fs.readFileSync(path.join(repoRoot, 'src/lib/hermes-acp.ts'), 'utf8');
  for (const needle of ['getHermesAcpConnection', 'getHermesLearningContext', '/api/acp/hermes/learning-context', '/api/acp/hermes/learning-report', 'learningReportTemplate', '/api/acp/praxis-learning/status', '/api/acp/praxis-learning/run', '/api/acp/praxis-learning/reports', '/api/acp/school/courses', '/api/acp/school/progress', '/api/acp/school/progress-log']) {
    assert(hermesHelper.includes(needle), `Hermes ACP helper missing ${needle}`);
  }

  const connectRoute = fs.readFileSync(path.join(repoRoot, 'src/app/api/acp/connect/route.ts'), 'utf8');
  assert(connectRoute.includes('getRequestAuth') && connectRoute.includes('getHermesAcpConnection'), 'connect route must authenticate and return Hermes connection');

  const contextRoute = fs.readFileSync(path.join(repoRoot, 'src/app/api/acp/hermes/learning-context/route.ts'), 'utf8');
  for (const needle of ['read_signals', 'read_reports', 'read_praxies', 'getHermesLearningContext', 'Hermes ACP key required']) assert(contextRoute.includes(needle), `Hermes context route missing ${needle}`);

  const reportRoute = fs.readFileSync(path.join(repoRoot, 'src/app/api/acp/hermes/learning-report/route.ts'), 'utf8');
  for (const needle of ['submit_learning_report', 'submitLearningReport', "adapter: 'hermes'", 'auth.key.id', 'auth.key.name']) assert(reportRoute.includes(needle), `Hermes report route missing ${needle}`);

  const mcpRoute = fs.readFileSync(path.join(repoRoot, 'src/app/api/mcp/route.ts'), 'utf8');
  for (const needle of ['/api/acp/connect', '/api/acp/hermes/learning-context', '/api/acp/hermes/learning-report']) assert(mcpRoute.includes(needle), `MCP manifest missing ${needle}`);

  const praxisLearning = fs.readFileSync(path.join(repoRoot, 'src/lib/praxis-learning.ts'), 'utf8');
  for (const needle of ['PraxisLearnerAgent', 'mock-hermes', 'mock-openclaw', 'No learning was hallucinated', 'praxis-learning-reports.json']) assert(praxisLearning.includes(needle), `Praxis learning loop missing ${needle}`);

  const schoolAdapter = fs.readFileSync(path.join(repoRoot, 'src/lib/school-progress.ts'), 'utf8');
  for (const needle of ['SchoolProgressAdapter', 'mock-school', 'SCHOOL_ACP_API_KEY', 'appendProgressLog', 'research-vault']) assert(schoolAdapter.includes(needle), `School ACP adapter missing ${needle}`);

  const manager = fs.readFileSync(path.join(repoRoot, 'src/components/AcpKeyManager.tsx'), 'utf8');
  assert(manager.includes('adapterDefaults') && manager.includes('HERMES_ACP_API_KEY') && manager.includes('submit_learning_report'), 'ACP key manager should expose Hermes defaults and copy instructions');

  console.log(JSON.stringify({ ok: true, tmp, keyPreview: created.record.keyPreview, permissions: created.record.permissions }, null, 2));
} finally {
  process.chdir(originalCwd);
  fs.rmSync(tmp, { recursive: true, force: true });
}
