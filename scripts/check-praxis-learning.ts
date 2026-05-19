#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }

const originalCwd = process.cwd();
const repoRoot = originalCwd;
const reportPath = path.join(repoRoot, 'research-vault', 'ops', 'praxis-learning-reports.json');
const backup = fs.existsSync(reportPath) ? fs.readFileSync(reportPath, 'utf8') : null;

try {
  delete process.env.HERMES_LEARNER_COMMAND;
  delete process.env.OPENCLAW_LEARNER_COMMAND;
  const mod = await import(`../src/lib/praxis-learning.ts?check=${Date.now()}`);
  const status = mod.praxisLearningStatus();
  assert(status.availableAgents.some((agent: { agent: string; available: boolean }) => agent.agent === 'mock-hermes' && agent.available), 'mock-hermes should be available');
  assert(status.availableAgents.some((agent: { agent: string; available: boolean }) => agent.agent === 'mock-openclaw' && agent.available), 'mock-openclaw should be available');
  const hermesReal = status.availableAgents.find((agent: { agent: string }) => agent.agent === 'hermes');
  const openclawReal = status.availableAgents.find((agent: { agent: string }) => agent.agent === 'openclaw');
  assert(hermesReal && hermesReal.available === false && String(hermesReal.blockedReason).includes('HERMES_LEARNER_COMMAND'), 'real hermes should block with exact missing config');
  assert(openclawReal && openclawReal.available === false && String(openclawReal.blockedReason).includes('OPENCLAW_LEARNER_COMMAND'), 'real openclaw should block with exact missing config');
  assert(status.candidates.length > 0, 'status should return Praxis candidates');
  const praxisId = status.candidates[0].id;

  const hermes = await mod.runPraxisLearningTask({ praxisId, agent: 'mock-hermes', objective: 'Learn from this Praxis safely.', safeMode: true });
  assert(hermes.status === 'completed', 'mock-hermes should complete in local safe mode');
  assert(hermes.agent === 'mock-hermes', 'mock-hermes report agent mismatch');
  assert(hermes.learned.length >= 4, 'mock-hermes report needs learned bullets');
  assert(hermes.learned.some((item: string) => item.includes('execution path')), 'mock-hermes should read executionSteps');
  assert(hermes.sourceUrls.length >= 1, 'mock-hermes report needs sourceUrls');
  assert(!hermes.learned.join(' ').includes('did not execute a real runtime'), 'mock-hermes should not use real-runtime blocked wording');

  const openclaw = await mod.runPraxisLearningTask({ praxisId, agent: 'mock-openclaw', objective: 'Compare first test and blockers.', safeMode: true });
  assert(openclaw.status === 'completed', 'mock-openclaw should complete in local safe mode');
  assert(openclaw.agent === 'mock-openclaw', 'mock-openclaw report agent mismatch');
  assert(openclaw.learned.length >= 4, 'mock-openclaw report needs learned bullets');
  assert(openclaw.learned.some((item: string) => item.includes('execution path')), 'mock-openclaw should read executionSteps');
  assert(openclaw.sourceUrls.length >= 1, 'mock-openclaw report needs sourceUrls');

  const realHermes = await mod.runPraxisLearningTask({ praxisId, agent: 'hermes', safeMode: true });
  assert(realHermes.status === 'blocked', 'real hermes should be blocked without runtime config');
  assert(realHermes.learned.some((item: string) => item.includes('No learning was hallucinated')), 'real hermes blocked report must state no hallucinated learning');
  assert(realHermes.artifacts.includes('runtime:not-executed'), 'real hermes should not claim execution artifact');

  const realOpenClaw = await mod.runPraxisLearningTask({ praxisId, agent: 'openclaw', safeMode: true });
  assert(realOpenClaw.status === 'blocked', 'real openclaw should be blocked without runtime config');
  assert(realOpenClaw.learned.some((item: string) => item.includes('No learning was hallucinated')), 'real openclaw blocked report must state no hallucinated learning');

  assert(fs.existsSync(reportPath), 'praxis learning report persistence file missing');
  const persisted = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as Array<{ id: string; sourceUrls?: string[] }>;
  for (const report of [hermes, openclaw, realHermes, realOpenClaw]) {
    const found = persisted.find((item) => item.id === report.id);
    assert(found, `persisted report missing ${report.id}`);
    assert(Array.isArray(found?.sourceUrls), `persisted report ${report.id} needs sourceUrls array`);
  }
  const listed = mod.listPraxisLearningReports(10);
  assert(listed.some((item: { id: string }) => item.id === openclaw.id), 'reports endpoint source should return persisted reports');


  const routeFiles = [
    'src/app/api/acp/praxis-learning/status/route.ts',
    'src/app/api/acp/praxis-learning/run/route.ts',
    'src/app/api/acp/praxis-learning/reports/route.ts',
  ];
  for (const file of routeFiles) assert(fs.existsSync(path.join(repoRoot, file)), `${file} missing`);
  const runRoute = fs.readFileSync(path.join(repoRoot, 'src/app/api/acp/praxis-learning/run/route.ts'), 'utf8');
  assert(runRoute.includes('runPraxisLearningTask') && runRoute.includes('mock-hermes') && runRoute.includes('mock-openclaw'), 'run route should expose mock learning agents');
  const panel = fs.readFileSync(path.join(repoRoot, 'src/components/PraxisLearningPanel.tsx'), 'utf8');
  assert(panel.includes('Praxis learning loop') && panel.includes('learned') && panel.includes('mock Hermes'), 'UI panel should show recent learning reports and action path');
  const hermesAcp = fs.readFileSync(path.join(repoRoot, 'src/lib/hermes-acp.ts'), 'utf8');
  for (const needle of ['/api/acp/praxis-learning/status', '/api/acp/praxis-learning/run', '/api/acp/praxis-learning/reports']) assert(hermesAcp.includes(needle), `Hermes ACP context missing ${needle}`);

  console.log(JSON.stringify({ ok: true, praxisId, reports: [hermes.id, openclaw.id, realHermes.id, realOpenClaw.id], reportPath: path.relative(repoRoot, reportPath) }, null, 2));
} finally {
  if (backup === null) fs.rmSync(reportPath, { force: true });
  else fs.writeFileSync(reportPath, backup);
  process.chdir(originalCwd);
  fs.rmSync(path.join(os.tmpdir(), 'agent-radar-unused'), { recursive: true, force: true });
}
