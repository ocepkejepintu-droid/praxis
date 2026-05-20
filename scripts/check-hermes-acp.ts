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
  const openClawCreated = acp.createAcpApiKey({ name: 'OpenClaw learner', owner: 'yoseph@example.com', adapter: 'openclaw' });
  assert(created.key.startsWith('apx_hermes_'), 'Hermes key must use hermes prefix');
  assert(openClawCreated.key.startsWith('apx_openclaw_'), 'OpenClaw key must use openclaw prefix');
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
    'src/app/api/acp/openclaw/learning-context/route.ts',
    'src/app/api/acp/openclaw/learning-report/route.ts',
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
    'src/components/AdapterConnectPanel.tsx',
  ];
  for (const file of files) assert(fs.existsSync(path.join(repoRoot, file)), `${file} missing`);

  const hermesHelper = fs.readFileSync(path.join(repoRoot, 'src/lib/hermes-acp.ts'), 'utf8');
  for (const needle of ['getHermesAcpConnection', 'getHermesLearningContext', 'getAdapterAcpConnection', 'getAdapterLearningContext', 'acpAdapterEndpoints', 'adapterPath', '/api/acp/${adapterPath}/learning-context', '/api/acp/${adapterPath}/learning-report', 'learningReportTemplate', '/api/acp/praxis-learning/status', '/api/acp/praxis-learning/run', '/api/acp/praxis-learning/reports', '/api/acp/school/courses', '/api/acp/school/progress', '/api/acp/school/progress-log']) {
    assert(hermesHelper.includes(needle), `Hermes ACP helper missing ${needle}`);
  }

  const connectRoute = fs.readFileSync(path.join(repoRoot, 'src/app/api/acp/connect/route.ts'), 'utf8');
  assert(connectRoute.includes('getRequestAuth') && connectRoute.includes('getAdapterAcpConnection') && connectRoute.includes('openclaw'), 'connect route must authenticate and return adapter-specific connection');

  const contextRoute = fs.readFileSync(path.join(repoRoot, 'src/app/api/acp/hermes/learning-context/route.ts'), 'utf8');
  for (const needle of ['read_signals', 'read_reports', 'read_praxies', 'getHermesLearningContext', 'Hermes ACP key required']) assert(contextRoute.includes(needle), `Hermes context route missing ${needle}`);

  const openClawContextRoute = fs.readFileSync(path.join(repoRoot, 'src/app/api/acp/openclaw/learning-context/route.ts'), 'utf8');
  for (const needle of ['read_signals', 'read_reports', 'read_praxies', 'getAdapterLearningContext', 'OpenClaw ACP key required']) assert(openClawContextRoute.includes(needle), `OpenClaw context route missing ${needle}`);

  const reportRoute = fs.readFileSync(path.join(repoRoot, 'src/app/api/acp/hermes/learning-report/route.ts'), 'utf8');
  for (const needle of ['submit_learning_report', 'submitLearningReport', "adapter: 'hermes'", 'auth.key.id', 'auth.key.name']) assert(reportRoute.includes(needle), `Hermes report route missing ${needle}`);

  const openClawReportRoute = fs.readFileSync(path.join(repoRoot, 'src/app/api/acp/openclaw/learning-report/route.ts'), 'utf8');
  for (const needle of ['submit_learning_report', 'submitLearningReport', "adapter: 'openclaw'", 'auth.key.id', 'auth.key.name']) assert(openClawReportRoute.includes(needle), `OpenClaw report route missing ${needle}`);

  const mcpRoute = fs.readFileSync(path.join(repoRoot, 'src/app/api/mcp/route.ts'), 'utf8');
  for (const needle of ['/api/acp/connect', '/api/acp/hermes/learning-context', '/api/acp/hermes/learning-report', '/api/acp/openclaw/learning-context', '/api/acp/openclaw/learning-report']) assert(mcpRoute.includes(needle), `MCP manifest missing ${needle}`);

  const praxisLearning = fs.readFileSync(path.join(repoRoot, 'src/lib/praxis-learning.ts'), 'utf8');
  for (const needle of ['PraxisLearnerAgent', 'mock-hermes', 'mock-openclaw', 'No learning was hallucinated', 'praxis-learning-reports.json']) assert(praxisLearning.includes(needle), `Praxis learning loop missing ${needle}`);

  const schoolAdapter = fs.readFileSync(path.join(repoRoot, 'src/lib/school-progress.ts'), 'utf8');
  for (const needle of ['SchoolProgressAdapter', 'mock-school', 'SCHOOL_ACP_API_KEY', 'appendProgressLog', 'research-vault']) assert(schoolAdapter.includes(needle), `School ACP adapter missing ${needle}`);

  const manager = fs.readFileSync(path.join(repoRoot, 'src/components/AcpKeyManager.tsx'), 'utf8');
  assert(manager.includes('adapterDefaults') && manager.includes('OPENCLAW') && manager.includes('HERMES') && manager.includes('submit_learning_report') && manager.includes('/api/acp/${adapter}/learning-context'), 'ACP key manager should expose adapter defaults and copy instructions');

  const adapterPanel = fs.readFileSync(path.join(repoRoot, 'src/components/AdapterConnectPanel.tsx'), 'utf8');
  for (const needle of ['Hermes and OpenClaw can read Praxis through ACP', 'Read Praxis context', 'OpenClaw', 'Authorization: Bearer', 'acpAdapterEndpoints']) assert(adapterPanel.includes(needle), `Adapter connect panel missing ${needle}`);

  const dashboard = fs.readFileSync(path.join(repoRoot, 'src/app/dashboard/page.tsx'), 'utf8');
  assert(dashboard.includes('<AdapterConnectPanel keys={keys} />'), 'dashboard must render explicit adapter connection panel');
  assert(dashboard.indexOf('<AdapterConnectPanel keys={keys} />') < dashboard.indexOf('<section className="dcAdapterFlow"'), 'empty dashboard should show adapter connection before explanatory flow cards');
  assert(dashboard.includes('Connect Hermes or OpenClaw.'), 'dashboard hero should name Hermes/OpenClaw adapter connection');

  const styles = fs.readFileSync(path.join(repoRoot, 'src/app/globals.css'), 'utf8');
  for (const needle of ['Dashboard adapter readability pass', '.dcDashboardPage.dcDashboardPage .dcPageHero h1', '.dcDashboardPage.dcDashboardPage .dcAdapterConnectPanel .dcSectionIntro h2']) {
    assert(styles.includes(needle), `dashboard adapter typography missing ${needle}`);
  }

  console.log(JSON.stringify({ ok: true, tmp, keyPreview: created.record.keyPreview, permissions: created.record.permissions }, null, 2));
} finally {
  process.chdir(originalCwd);
  fs.rmSync(tmp, { recursive: true, force: true });
}
