#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }

const stamp = Date.now();
const alpha = `qa-alpha-${stamp}`;
const beta = `qa-beta-${stamp}`;
const tenantRoot = path.join(process.cwd(), 'research-vault', 'tenants');
const radarTenantRoot = path.join(process.cwd(), '.radar', 'tenants');

try {
  delete process.env.HERMES_LEARNER_COMMAND;
  delete process.env.OPENCLAW_LEARNER_COMMAND;
  delete process.env.HERMES_LEARNER_ALLOW_EXTERNAL_COMMAND;
  delete process.env.OPENCLAW_LEARNER_ALLOW_EXTERNAL_COMMAND;

  const saas = await import(`../src/lib/praxis-learning-saas.ts?saas=${stamp}`);
  const learning = await import(`../src/lib/praxis-learning.ts?saas=${stamp}`);

  const alphaDashboard0 = saas.tenantPraxisLearningDashboard(alpha, 'alpha@example.com');
  assert(alphaDashboard0.plan.priceUsdMonthly === 100, 'Praxis Pro plan should be $100/mo');
  assert(alphaDashboard0.usage.jobsCreated === 0, 'new alpha tenant should start with zero jobs');
  assert(alphaDashboard0.paths.reports.includes(`research-vault/tenants/${alpha}/ops/`), 'alpha reports must be tenant-scoped');
  assert(alphaDashboard0.runtimeRunner.kind === 'mock', 'default runtime runner must be mock only');
  assert(alphaDashboard0.settings.runtimeProviders.every((provider: { runtimeAvailable: boolean; secretExposed: boolean }) => provider.runtimeAvailable === false && provider.secretExposed === false), 'real providers must be blocked and not expose secrets');

  const overPraxis = saas.validatePlanRequest(alpha, { agents: ['mock-hermes'], limit: alphaDashboard0.plan.maxPraxisPerRun + 1, xSearchCallsRequested: 0 });
  assert(!overPraxis.ok && overPraxis.violations.some((item: { field: string }) => item.field === 'maxPraxisPerRun'), 'over-limit Praxis request should be rejected');
  const overXSearch = saas.validatePlanRequest(alpha, { agents: ['mock-hermes'], limit: 1, xSearchCallsRequested: 1 });
  assert(!overXSearch.ok && overXSearch.violations.some((item: { field: string }) => item.field === 'xSearchCallsPerDay'), 'x_search should be budget-gated/disabled');

  const request = saas.createPraxisLearningJobInput({ agents: ['mock-hermes', 'mock-openclaw', 'hermes', 'openclaw'], limit: 2, minScore: 5, promoteDrafts: true });
  const result = await saas.createAndRunPraxisLearningJob(alpha, 'alpha@example.com', request);
  assert(result.ok, 'alpha job should be accepted');
  assert(result.job.state === 'completed', 'alpha job should complete through file-backed runner');
  assert(result.job.usage.selectedPraxis >= 2, 'job usage should count selected Praxis');
  assert(result.job.usage.reportsGenerated >= 8, 'job usage should count generated reports');
  assert(result.job.usage.xSearchCalls === 0, 'job must not use x_search by default');
  assert(result.job.aggregate?.counts.completed === 4, 'two mock agents across two Praxis should complete four reports');
  assert(result.job.aggregate?.counts.blocked === 4, 'real Hermes/OpenClaw should block four reports');
  assert(Object.values(result.job.aggregate?.realRuntimeBlockers || {}).every((value) => String(value).includes('not configured') || String(value).includes('not implemented/approved')), 'real blockers should be explicit');

  const alphaReports = learning.listPraxisLearningReports(50, learning.praxisLearningPaths.reports ? saas.tenantStorage(alpha) : saas.tenantStorage(alpha));
  const betaReports = learning.listPraxisLearningReports(50, saas.tenantStorage(beta));
  assert(alphaReports.length >= 8, 'alpha should see own job reports');
  assert(betaReports.length === 0, 'beta must not read alpha reports');
  assert(alphaReports.every((report: { sourceUrls: string[] }) => report.sourceUrls.length > 0), 'tenant reports must retain sourceUrls');
  assert(alphaReports.filter((report: { agent: string }) => report.agent === 'hermes' || report.agent === 'openclaw').every((report: { status: string }) => report.status === 'blocked'), 'real tenant reports must be blocked by default');

  const alphaJobs = saas.listTenantJobs(alpha);
  const betaJobs = saas.listTenantJobs(beta);
  assert(alphaJobs.length === 1 && alphaJobs[0].id === result.job.id, 'alpha should see own job');
  assert(betaJobs.length === 0, 'beta should not see alpha job');
  assert(saas.getTenantJob(beta, result.job.id) === null, 'beta cannot fetch alpha job by id');

  const alphaMorning = learning.getLatestPraxisLearningMorningReport(saas.tenantStorage(alpha));
  const betaMorning = learning.getLatestPraxisLearningMorningReport(saas.tenantStorage(beta));
  assert(alphaMorning?.id === result.job.aggregateId, 'alpha morning report should be tenant-scoped');
  assert(betaMorning === null, 'beta should not see alpha morning report');
  assert((result.job.aggregate?.promotedSkillDrafts.length || 0) > 0, 'tenant job should create tenant skill drafts');
  for (const draft of result.job.aggregate?.promotedSkillDrafts || []) {
    assert(!path.isAbsolute(draft.path), 'skill draft path should be relative');
    assert(!draft.path.split(path.sep).includes('..'), 'skill draft path should not traverse');
    assert(draft.path.includes(`research-vault/tenants/${alpha}/ops/skill-drafts/`), 'skill draft should live under tenant directory');
    assert(fs.existsSync(path.join(process.cwd(), draft.path)), `skill draft missing: ${draft.path}`);
  }

  await saas.createAndRunPraxisLearningJob(alpha, 'alpha@example.com', saas.createPraxisLearningJobInput({ agents: ['mock-hermes'], limit: 1, minScore: 5 }));
  await saas.createAndRunPraxisLearningJob(alpha, 'alpha@example.com', saas.createPraxisLearningJobInput({ agents: ['mock-hermes'], limit: 1, minScore: 5 }));
  const fourthGuard = saas.createQueuedPraxisLearningJob(alpha, 'alpha@example.com', saas.createPraxisLearningJobInput({ agents: ['mock-hermes'], limit: 1, minScore: 5 }));
  assert(!fourthGuard.ok && fourthGuard.guard.violations.some((item: { field: string }) => item.field === 'nightlyRunsPerDay'), 'fourth daily job should exceed plan limit');

  process.env.HERMES_LEARNER_COMMAND = 'echo should-not-run';
  process.env.HERMES_LEARNER_ALLOW_EXTERNAL_COMMAND = '1';
  const configuredStatus = learning.praxisLearningStatus(saas.tenantStorage(alpha)).availableAgents.find((agent: { agent: string }) => agent.agent === 'hermes');
  assert(configuredStatus?.available === false && configuredStatus.runtimeAvailable === false, 'configured real Hermes must remain blocked without approved runner');
  assert(configuredStatus?.blockedReason?.includes('not implemented/approved'), 'configured real Hermes blocker should mention runner not implemented/approved');

  const statusRoute = fs.readFileSync(path.join(process.cwd(), 'src/app/api/acp/praxis-learning/status/route.ts'), 'utf8');
  const jobsRoute = fs.readFileSync(path.join(process.cwd(), 'src/app/api/acp/praxis-learning/jobs/route.ts'), 'utf8');
  const reportsRoute = fs.readFileSync(path.join(process.cwd(), 'src/app/api/acp/praxis-learning/reports/route.ts'), 'utf8');
  const panel = fs.readFileSync(path.join(process.cwd(), 'src/components/PraxisLearningPanel.tsx'), 'utf8');
  assert(statusRoute.includes('tenantPraxisLearningDashboard'), 'status route should return tenant dashboard when authenticated');
  assert(jobsRoute.includes('PLAN_LIMIT_EXCEEDED') && jobsRoute.includes('createAndRunPraxisLearningJob'), 'jobs route should enforce plan and run jobs');
  assert(reportsRoute.includes('tenantStorage'), 'reports route should use tenant storage');
  assert(panel.includes('monthly alpha plan') && panel.includes('Latest job') && panel.toLowerCase().includes('tenant-safe'), 'UI should show plan, latest job, and tenant-safe state');

  console.log(JSON.stringify({
    ok: true,
    tenantIsolation: { alphaReports: alphaReports.length, betaReports: betaReports.length, betaJobLookup: null },
    job: { id: result.job.id, state: result.job.state, usage: result.job.usage },
    plan: alphaDashboard0.plan,
    artifacts: result.job.artifacts,
  }, null, 2));
} finally {
  fs.rmSync(path.join(tenantRoot, alpha), { recursive: true, force: true });
  fs.rmSync(path.join(tenantRoot, beta), { recursive: true, force: true });
  fs.rmSync(path.join(radarTenantRoot, alpha), { recursive: true, force: true });
  fs.rmSync(path.join(radarTenantRoot, beta), { recursive: true, force: true });
}
