#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { hermesRuntimeContract, hermesRuntimeStatus, createHermesReadOnlyScanRequest, blockedHermesReadOnlyScan } from '../packages/runtime/contracts/hermes-contract.ts';
import { omxRuntimeContract, openClawRuntimeStatus } from '../packages/runtime/contracts/omx-contract.ts';
import { runtimeSafetyContract } from '../packages/runtime/contracts/types.ts';
import { runtimeRunnerStatus } from '../src/lib/praxis-learning-saas.ts';
import { praxisLearningStatus } from '../src/lib/praxis-learning.ts';

function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }

const original = { ...process.env };
try {
  delete process.env.HERMES_RUNTIME_MODE;
  delete process.env.HERMES_READONLY_WORKSPACE_DIR;
  delete process.env.HERMES_LEARNER_COMMAND;
  delete process.env.HERMES_LEARNER_ALLOW_EXTERNAL_COMMAND;
  delete process.env.OPENCLAW_LEARNER_COMMAND;
  delete process.env.OPENCLAW_LEARNER_ALLOW_EXTERNAL_COMMAND;

  assert(runtimeSafetyContract.commandExecutionAllowed === false, 'Week 1 contract must forbid command execution');
  assert(runtimeSafetyContract.realExecutionEnabled === false, 'real execution must be disabled in safety contract');
  assert(hermesRuntimeContract.readOnlyScope.join(',') === 'workflows,logs,state', 'Hermes read-only scope should be workflows/logs/state only');
  assert(omxRuntimeContract.implementation === 'stub', 'OMX/OpenClaw contract should be stub only for Week 1');

  const defaultHermes = hermesRuntimeStatus();
  assert(defaultHermes.status === 'blocked', 'Hermes should be blocked without read-only config');
  assert(defaultHermes.readOnlyAvailable === false, 'Hermes read-only should not be available without config');
  assert(defaultHermes.realExecutionEnabled === false, 'Hermes real execution must be disabled by default');
  assert(defaultHermes.requiredConfig.includes('HERMES_RUNTIME_MODE=read-only'), 'Hermes status should require read-only mode');

  process.env.HERMES_RUNTIME_MODE = 'read-only';
  process.env.HERMES_READONLY_WORKSPACE_DIR = 'storage/tenants/test/workspaces/hermes';
  const readOnlyHermes = hermesRuntimeStatus();
  assert(readOnlyHermes.status === 'available', 'Hermes read-only should be available when read-only config exists');
  assert(readOnlyHermes.label === 'Runtime Status: Read-Only • Real execution disabled', 'Hermes read-only label should match UI contract');
  assert(readOnlyHermes.realExecutionEnabled === false, 'Hermes read-only must not enable real execution');

  const tenant = { tenantId: 'test-tenant', workspaceDir: 'storage/tenants/test/workspaces/hermes' };
  const scanRequest = createHermesReadOnlyScanRequest(tenant);
  assert(scanRequest.mode === 'read-only' && scanRequest.provider === 'hermes', 'Hermes scan request should be read-only provider contract');
  assert(scanRequest.includeWorkflows === true && scanRequest.includeLogs === true && scanRequest.includeState === true, 'Hermes scan request should include read-only data classes');
  const blockedScan = blockedHermesReadOnlyScan(scanRequest, [{ code: 'TEST_BLOCK', message: 'test blocker' }]);
  assert(blockedScan.workflows.length === 0 && blockedScan.logs.length === 0 && blockedScan.stateFiles.length === 0, 'Blocked scan should not fabricate data');
  assert(blockedScan.auditEvents[0]?.action === 'read_only_scan', 'Blocked scan should emit read-only audit event');

  const saasStatuses = runtimeRunnerStatus();
  const hermesSaas = saasStatuses.find((item) => item.agent === 'hermes');
  if (!hermesSaas) throw new Error('SaaS runtime status should include Hermes');
  assert(hermesSaas.runtimeLabel === 'Runtime Status: Read-Only • Real execution disabled', 'SaaS runtime status should expose read-only label');
  assert(hermesSaas.realExecutionEnabled === false && hermesSaas.enabled === false, 'SaaS runtime must not enable real Hermes execution');
  const learningHermes = praxisLearningStatus().availableAgents.find((agent) => agent.agent === 'hermes');
  if (!learningHermes) throw new Error('Praxis learning status should include Hermes');
  assert(learningHermes.mode === 'read-only', 'Praxis learning should surface Hermes read-only mode');
  assert(learningHermes.available === false, 'Read-only Hermes must not be selectable as execution-capable');
  assert(learningHermes.blockedReason?.includes('Real execution disabled'), 'Read-only Hermes should explain real execution disabled');

  const openClaw = openClawRuntimeStatus();
  assert(openClaw.status === 'not-implemented', 'OpenClaw/OMX should remain stubbed');
  assert(openClaw.realExecutionEnabled === false, 'OpenClaw/OMX real execution must be disabled');

  const contractFiles = [
    'packages/runtime/contracts/types.ts',
    'packages/runtime/contracts/hermes-contract.ts',
    'packages/runtime/contracts/omx-contract.ts',
  ];
  for (const file of contractFiles) {
    const text = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    assert(!/node:child_process|child_process|exec\s*\(|spawn\s*\(/.test(text), `${file} must not add command execution`);
    assert(!/eval\s*\(/.test(text), `${file} must not eval`);
  }

  console.log(JSON.stringify({
    ok: true,
    hermesDefault: defaultHermes.label,
    hermesReadOnly: readOnlyHermes.label,
    openClaw: openClaw.label,
    commandExecutionAllowed: runtimeSafetyContract.commandExecutionAllowed,
  }, null, 2));
} finally {
  process.env = original;
}
