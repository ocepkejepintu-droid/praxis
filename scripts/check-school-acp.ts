#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }

const originalCwd = process.cwd();
const repoRoot = originalCwd;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-radar-school-acp-'));
process.chdir(tmp);

try {
  const env = process.env as Record<string, string | undefined>;
  const oldProvider = env.SCHOOL_ACP_PROVIDER;
  const oldBaseUrl = env.SCHOOL_ACP_BASE_URL;
  const oldApiKey = env.SCHOOL_ACP_API_KEY;
  const oldOauth = env.SCHOOL_ACP_OAUTH_TOKEN;

  env.SCHOOL_ACP_PROVIDER = 'mock-school';
  delete env.SCHOOL_ACP_BASE_URL;
  delete env.SCHOOL_ACP_API_KEY;
  delete env.SCHOOL_ACP_OAUTH_TOKEN;

  const stamp = Date.now();
  const acp = await import(`../src/lib/acp.ts?school_acp=${stamp}`);
  const school = await import(`../src/lib/school-progress.ts?school_acp=${stamp}`);
  const created = acp.createAcpApiKey({ name: 'Hermes school learner', owner: 'yoseph@example.com', adapter: 'hermes' });
  assert(acp.verifyAcpApiKey(created.key)?.id === created.record.id, 'Hermes ACP key should verify before school calls');

  const status = await school.getSchoolStatus();
  assert(status.connected === true, `mock status should connect: ${JSON.stringify(status)}`);
  assert(status.provider === 'mock-school', 'mock provider mismatch');
  assert(status.accountLabel?.includes('Mock Learner'), 'mock account label missing');

  const courses = await school.listSchoolCourses();
  assert(courses.length >= 2, 'mock courses should return at least 2 courses');
  assert(courses.some((course: { id?: string }) => course.id === 'praxis-101'), 'praxis-101 fixture missing');

  const progress = await school.listSchoolProgress();
  assert(progress.length >= 2, 'mock progress should return records');
  assert(progress.every((record: { courseId?: string }) => typeof record.courseId === 'string' && record.courseId), 'progress records need courseId');

  const log = await school.logSchoolProgress({ courseId: 'praxis-101', action: 'lesson_completed', summary: 'Hermes completed the mock lesson.', metadata: { percent: 70 }, source: 'test' });
  assert(log.id && log.provider === 'mock-school' && log.courseId === 'praxis-101', 'progress log shape invalid');
  const logPath = path.join(tmp, 'research-vault', 'ops', 'school-progress-log.json');
  assert(fs.existsSync(logPath), 'progress log persistence file missing');
  const logs = school.listSchoolProgressLogs(5);
  assert(logs[0]?.id === log.id, 'latest persisted log should be returned first');

  delete env.SCHOOL_ACP_PROVIDER;
  const unconfigured = await school.getSchoolStatus();
  assert(unconfigured.connected === false, 'unconfigured real adapter should not connect');
  assert(String(unconfigured.error).includes('SCHOOL_ACP_BASE_URL'), 'unconfigured error should be actionable');

  const routeFiles = [
    'src/app/api/acp/school/status/route.ts',
    'src/app/api/acp/school/connect/route.ts',
    'src/app/api/acp/school/courses/route.ts',
    'src/app/api/acp/school/progress/route.ts',
    'src/app/api/acp/school/progress-log/route.ts',
  ];
  for (const file of routeFiles) assert(fs.existsSync(path.join(repoRoot, file)), `${file} missing`);
  const courseRoute = fs.readFileSync(path.join(repoRoot, 'src/app/api/acp/school/courses/route.ts'), 'utf8');
  const progressRoute = fs.readFileSync(path.join(repoRoot, 'src/app/api/acp/school/progress/route.ts'), 'utf8');
  const logRoute = fs.readFileSync(path.join(repoRoot, 'src/app/api/acp/school/progress-log/route.ts'), 'utf8');
  assert(courseRoute.includes('requireSchoolAuth') && courseRoute.includes('listSchoolCourses'), 'courses route should auth and call adapter');
  assert(progressRoute.includes('requireSchoolAuth') && progressRoute.includes('listSchoolProgress'), 'progress route should auth and call adapter');
  assert(logRoute.includes("'submit_learning_report'") && logRoute.includes('logSchoolProgress'), 'progress-log route should require write permission and persist logs');

  const dashboard = fs.readFileSync(path.join(repoRoot, 'src/app/dashboard/page.tsx'), 'utf8');
  assert(dashboard.includes('SchoolProgressPanel'), 'dashboard should render school progress panel');
  const hermesHelper = fs.readFileSync(path.join(repoRoot, 'src/lib/hermes-acp.ts'), 'utf8');
  for (const needle of ['/api/acp/school/status', '/api/acp/school/courses', '/api/acp/school/progress', '/api/acp/school/progress-log']) assert(hermesHelper.includes(needle), `Hermes ACP helper missing ${needle}`);
  const envExample = fs.readFileSync(path.join(repoRoot, '.env.example'), 'utf8');
  for (const needle of ['SCHOOL_ACP_PROVIDER', 'SCHOOL_ACP_BASE_URL', 'SCHOOL_ACP_API_KEY', 'SCHOOL_ACP_OAUTH_TOKEN']) assert(envExample.includes(needle), `.env.example missing ${needle}`);

  if (oldProvider === undefined) delete env.SCHOOL_ACP_PROVIDER; else env.SCHOOL_ACP_PROVIDER = oldProvider;
  if (oldBaseUrl === undefined) delete env.SCHOOL_ACP_BASE_URL; else env.SCHOOL_ACP_BASE_URL = oldBaseUrl;
  if (oldApiKey === undefined) delete env.SCHOOL_ACP_API_KEY; else env.SCHOOL_ACP_API_KEY = oldApiKey;
  if (oldOauth === undefined) delete env.SCHOOL_ACP_OAUTH_TOKEN; else env.SCHOOL_ACP_OAUTH_TOKEN = oldOauth;

  console.log(JSON.stringify({ ok: true, tmp, status: status.connected, courses: courses.length, progress: progress.length, logPath: path.relative(tmp, logPath) }, null, 2));
} finally {
  process.chdir(originalCwd);
  fs.rmSync(tmp, { recursive: true, force: true });
}
