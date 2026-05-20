import { getAgentReport, rankPraxisCandidates } from './agent';
import { getHermesAtlasPraxisMap } from './hermes-atlas';
import { getAgentProfile, listLearningReports } from './learning';
import { getOperatorDispatch, getResearchHealth, readHandoffQueue } from './operator';
import type { AcpAdapter, PublicAcpApiKey } from './acp';

export function acpAdapterEndpoints(adapter: AcpAdapter, baseUrl = '') {
  const base = baseUrl.replace(/\/$/, '');
  const adapterPath = adapter === 'openclaw' ? 'openclaw' : 'hermes';
  return {
    connect: `${base}/api/acp/connect`,
    learningContext: `${base}/api/acp/${adapterPath}/learning-context`,
    learningReport: `${base}/api/acp/${adapterPath}/learning-report`,
    genericLearningReports: `${base}/api/acp/learning-reports`,
    userSessions: `${base}/api/acp/sessions`,
    praxisLearningStatus: `${base}/api/acp/praxis-learning/status`,
    praxisLearningRun: `${base}/api/acp/praxis-learning/run`,
    praxisLearningJobs: `${base}/api/acp/praxis-learning/jobs`,
    praxisLearningReports: `${base}/api/acp/praxis-learning/reports`,
    praxisLearningMorningReport: `${base}/api/acp/praxis-learning/morning-report`,
    schoolStatus: `${base}/api/acp/school/status`,
    schoolConnect: `${base}/api/acp/school/connect`,
    schoolCourses: `${base}/api/acp/school/courses`,
    schoolProgress: `${base}/api/acp/school/progress`,
    schoolProgressLog: `${base}/api/acp/school/progress-log`,
    mcpManifest: `${base}/api/mcp`,
    praxisCandidates: `${base}/api/agent/praxies/candidates`,
  };
}

export function hermesAcpEndpoints(baseUrl = '') {
  return acpAdapterEndpoints('hermes', baseUrl);
}

export function hermesLearningReportTemplate(key?: PublicAcpApiKey) {
  return {
    agentName: key?.name || 'Hermes',
    status: 'learning',
    summary: 'Short report of what Hermes learned from Praxi signals.',
    learned: 'What pattern, workflow, tool, or execution path became clearer.',
    tried: 'What Hermes inspected or compared.',
    worked: 'What evidence was useful.',
    failed: 'What stayed weak, missing, or noisy.',
    nextAction: 'Smallest next Praxis step for Hermes/OpenClaw/human review.',
    evidenceUrls: ['https://example.com/source'],
  };
}

export function getHermesAcpConnection(key: PublicAcpApiKey, baseUrl = '') {
  return getAdapterAcpConnection(key, baseUrl);
}

export function getAdapterAcpConnection(key: PublicAcpApiKey, baseUrl = '') {
  return {
    adapter: key.adapter,
    keyId: key.id,
    keyName: key.name,
    owner: key.owner,
    status: key.status,
    permissions: key.permissions,
    profile: getAgentProfile(key.id),
    endpoints: acpAdapterEndpoints(key.adapter, baseUrl),
    nextSteps: [
      'GET /api/acp/connect with Authorization: Bearer <ACP_KEY>.',
      `GET /api/acp/${key.adapter}/learning-context to read Praxis material.`,
      `POST /api/acp/${key.adapter}/learning-report to report what ${key.adapter === 'openclaw' ? 'OpenClaw' : 'Hermes'} learned.`,
      'POST /api/acp/praxis-learning/run to run a safe mock Hermes/OpenClaw Praxis learning loop.',
      'POST /api/acp/praxis-learning/jobs to create a tenant-scoped durable learning job with plan limits and usage counters.',
      'GET /api/acp/praxis-learning/jobs to read only this tenant’s jobs.',
      'GET /api/acp/praxis-learning/reports to read what agents learned.',
      'GET /api/acp/praxis-learning/morning-report to read the latest overnight/morning learning summary.',
      'GET /api/acp/school/courses and /api/acp/school/progress to read LMS progress.',
      'POST /api/acp/school/progress-log to append local school progress events.',
    ],
  };
}

export function getHermesLearningContext(key: PublicAcpApiKey, baseUrl = '') {
  return getAdapterLearningContext(key, baseUrl);
}

export function getAdapterLearningContext(key: PublicAcpApiKey, baseUrl = '') {
  return {
    connection: getAdapterAcpConnection(key, baseUrl),
    reportBrief: getAgentReport(),
    praxisCandidates: rankPraxisCandidates({ limit: 15 }),
    operator: {
      dispatch: getOperatorDispatch(),
      health: getResearchHealth(),
      queues: {
        buildroom: readHandoffQueue('buildroom'),
        verify: readHandoffQueue('verify'),
        content: readHandoffQueue('content'),
        watch: readHandoffQueue('watch'),
      },
    },
    hermesAtlas: getHermesAtlasPraxisMap(),
    recentLearningReports: listLearningReports(12),
    learningReportTemplate: hermesLearningReportTemplate(key),
    contract: {
      sourceOfTruth: 'markdown + ACP event log',
      auth: 'Authorization: Bearer <ACP_KEY>',
      adapter: key.adapter,
      schoolAdapter: 'Use SCHOOL_ACP_PROVIDER=mock-school for local QA, or SCHOOL_ACP_BASE_URL plus SCHOOL_ACP_API_KEY/SCHOOL_ACP_OAUTH_TOKEN for real LMS.',
      rule: 'Do not fake evidence. Weak signals stay verify/watch until source proof improves.',
    },
  };
}
