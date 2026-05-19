#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }

const repoRoot = process.cwd();
const reportsPath = path.join(repoRoot, 'research-vault', 'ops', 'praxis-learning-reports.json');
const aggregateJsonPath = path.join(repoRoot, 'research-vault', 'ops', 'praxis-learning-overnight-report.json');
const aggregateMdPath = path.join(repoRoot, 'research-vault', 'ops', 'praxis-learning-overnight-report.md');
const morningJsonPath = path.join(repoRoot, 'research-vault', 'ops', 'praxis-learning-morning-report.json');
const morningMdPath = path.join(repoRoot, 'research-vault', 'ops', 'praxis-learning-morning-report.md');
const skillDraftDir = path.join(repoRoot, 'research-vault', 'ops', 'skill-drafts');
const backupFiles = [reportsPath, aggregateJsonPath, aggregateMdPath, morningJsonPath, morningMdPath];
const backups = new Map<string, string | null>();
for (const file of backupFiles) backups.set(file, fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null);
const skillDraftBackup = fs.existsSync(skillDraftDir) ? fs.mkdtempSync(path.join(process.cwd(), '.tmp-skill-drafts-')) : null;
if (skillDraftBackup) fs.cpSync(skillDraftDir, skillDraftBackup, { recursive: true });

try {
  delete process.env.HERMES_LEARNER_COMMAND;
  delete process.env.OPENCLAW_LEARNER_COMMAND;
  delete process.env.HERMES_LEARNER_ALLOW_EXTERNAL_COMMAND;
  delete process.env.OPENCLAW_LEARNER_ALLOW_EXTERNAL_COMMAND;

  const mod = await import(`../src/lib/praxis-learning.ts?check-loop=${Date.now()}`);
  const candidates = mod.rankPraxisLearningCandidates(10, { minScore: 5, includeRecent: true });
  assert(candidates.length >= 10, 'needs at least 10 quality-gated Praxis candidates when recent items included');
  for (const candidate of candidates) {
    assert(candidate.score >= 5, `candidate ${candidate.id} needs score >=5`);
    assert(candidate.sourceUrls.length >= 1, `candidate ${candidate.id} needs sourceUrls`);
    assert(candidate.reasons.length >= 2, `candidate ${candidate.id} needs reason strings`);
  }

  const aggregate = await mod.runPraxisLearningBatch({
    agents: ['mock-hermes', 'mock-openclaw', 'hermes', 'openclaw'],
    limit: 10,
    minScore: 5,
    safeMode: true,
    includeRecent: true,
    includeRealAgents: true,
    objective: 'Focused test: learn source-backed Praxis entries without external side effects.',
    reportKind: 'morning',
    promoteDrafts: true,
    writeAggregate: true,
  });

  assert(aggregate.reportKind === 'morning', 'aggregate should be morning report');
  assert(aggregate.selectedPraxisCount >= 10, 'aggregate should select at least 10 high-score Praxis items when available');
  assert(aggregate.praxisLearnedCount >= 10, 'aggregate should learn at least 10 Praxis items');
  assert(aggregate.reportsCreated >= 40, 'aggregate should create reports for two mock and two real slots across 10 Praxis');
  assert(aggregate.counts.completed >= 20, 'aggregate needs completed mock reports');
  assert(aggregate.counts.blocked >= 20, 'aggregate needs blocked real reports');
  assert(aggregate.realRuntimeBlockers.hermes?.includes('HERMES_LEARNER_COMMAND'), 'real hermes should block with exact missing command');
  assert(aggregate.realRuntimeBlockers.openclaw?.includes('OPENCLAW_LEARNER_COMMAND'), 'real openclaw should block with exact missing command');
  assert(aggregate.topLearnedPatterns.length >= 3, 'aggregate needs top learned patterns');
  assert(aggregate.bestNextActions.length >= 3, 'aggregate needs next actions');
  assert(aggregate.sourceUrls.length >= 10, 'aggregate needs source URLs');
  assert(aggregate.promotedSkillDrafts.length >= 3, 'aggregate should create at least 3 skill drafts');
  assert(fs.existsSync(morningJsonPath), 'morning JSON missing');
  assert(fs.existsSync(morningMdPath), 'morning markdown missing');
  assert(fs.existsSync(aggregateJsonPath), 'compat overnight JSON missing');
  assert(fs.existsSync(aggregateMdPath), 'compat overnight markdown missing');

  for (const draft of aggregate.promotedSkillDrafts.slice(0, 3)) {
    const content = fs.readFileSync(path.join(repoRoot, draft.path), 'utf8');
    assert(content.includes('## Trigger') && content.includes('## Verification') && content.includes('## Source URLs'), `${draft.path} missing skill draft sections`);
  }

  const persisted = JSON.parse(fs.readFileSync(reportsPath, 'utf8')) as Array<{ id: string; agent: string; status: string; sourceUrls?: string[]; learned?: string[] }>;
  const created = persisted.filter((report) => aggregate.reportIds.includes(report.id));
  assert(created.filter((report) => report.agent === 'mock-hermes' && report.status === 'completed').length >= 10, 'mock-hermes needs >=10 completed reports');
  assert(created.filter((report) => report.agent === 'mock-openclaw' && report.status === 'completed').length >= 10, 'mock-openclaw needs >=10 completed reports');
  assert(created.every((report) => Array.isArray(report.sourceUrls) && report.sourceUrls.length >= 1), 'all batch reports need sourceUrls');
  assert(created.filter((report) => report.agent === 'hermes' || report.agent === 'openclaw').every((report) => report.status === 'blocked' && report.learned?.join(' ').includes('No learning was hallucinated')), 'real reports must block without hallucinated execution');

  const latestMorning = mod.getLatestPraxisLearningMorningReport();
  assert(latestMorning?.id === aggregate.id, 'latest morning report should read back from disk');
  const status = mod.praxisLearningStatus();
  assert(status.latestMorningReport?.id === aggregate.id, 'status should expose latest morning report summary');

  console.log(JSON.stringify({
    ok: true,
    candidates: candidates.length,
    aggregateId: aggregate.id,
    selectedPraxisCount: aggregate.selectedPraxisCount,
    praxisLearnedCount: aggregate.praxisLearnedCount,
    reportsCreated: aggregate.reportsCreated,
    skillDrafts: aggregate.promotedSkillDrafts.length,
    artifacts: aggregate.artifactsChanged,
  }, null, 2));
} finally {
  for (const [file, content] of backups) {
    if (content === null) fs.rmSync(file, { force: true });
    else fs.writeFileSync(file, content);
  }
  if (skillDraftBackup) {
    fs.rmSync(skillDraftDir, { recursive: true, force: true });
    fs.cpSync(skillDraftBackup, skillDraftDir, { recursive: true });
    fs.rmSync(skillDraftBackup, { recursive: true, force: true });
  } else {
    fs.rmSync(skillDraftDir, { recursive: true, force: true });
  }
}
