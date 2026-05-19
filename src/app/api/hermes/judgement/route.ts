import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { isHermesIngestAuthorized, missingHermesTokenMessage } from '@/lib/ingest-auth';
import { generateResearchLayer, normalizeResearchJudgementPayload, type EvidenceStrength, type ResearchLane, type ResearchOwner, type ResearchPriority, type VerificationStatus } from '@/lib/research-layer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ResearchJudgementFields = {
  targetLane?: ResearchLane;
  priority?: ResearchPriority;
  owner?: ResearchOwner;
  blockedReason?: string;
  verificationStatus?: VerificationStatus;
  evidenceStrength?: EvidenceStrength;
  claims?: string[];
};

type JudgementIdea = ResearchJudgementFields & {
  title: string;
  stage?: 'act_now' | 'worth_trying' | 'watch' | 'ignore';
  thesis: string;
  whyNow: string;
  nextMove: string;
  executionPath?: string[];
  sourceNotePath?: string;
  dependencyUrls?: string[];
  leverage?: number;
  effort?: number;
  sourceUrls?: string[];
};

type JudgementExperiment = ResearchJudgementFields & {
  title: string;
  stage?: 'worth_trying' | 'queued' | 'tried' | 'adopted' | 'killed';
  hypothesis: string;
  firstTest: string;
  successSignal: string;
  killCriteria?: string;
  executionPath?: string[];
  sourceNotePath?: string;
  dependencyUrls?: string[];
  owner?: 'Yoseph' | 'Hermes' | 'OMX';
  sourceUrls?: string[];
};

type JudgementAction = ResearchJudgementFields & {
  text: string;
  priority?: 'high' | 'medium' | 'low';
  category?: string;
  reason?: string;
  sourceUrls?: string[];
  sourceNotePath?: string;
  dependencyUrls?: string[];
};

type JudgementBody = {
  runId?: string;
  summary?: string;
  ideas?: JudgementIdea[];
  experiments?: JudgementExperiment[];
  actions?: JudgementAction[];
};

const ROOT = /* turbopackIgnore: true*/ process.cwd();

function slugifyFileName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'card';
}

function unauthorized() {
  return NextResponse.json({ ok: false, message: 'Unauthorized Hermes judgement request.' }, { status: 401 });
}


function boundedScore(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(5, Math.round(parsed))) : fallback;
}

function sourceYaml(urls: string[] = []) {
  const clean = urls.filter(Boolean).slice(0, 12);
  return clean.length ? clean.map((url) => `  - ${url}`).join('\n') : '  - pending';
}

function scalar(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function listYaml(values: string[] = []) {
  const clean = values.map((value) => value.trim()).filter(Boolean).slice(0, 12);
  return clean.length ? clean.map((value) => `  - ${JSON.stringify(value.replace(/\n/g, ' '))}`).join('\n') : '  - pending';
}

function researchFrontmatter(item: ResearchJudgementFields) {
  return `target_lane: ${scalar(item.targetLane, 'verify')}
priority: ${scalar(item.priority, 'medium')}
owner: ${scalar(item.owner, 'Hermes')}
verification_status: ${scalar(item.verificationStatus, 'needs_verification')}
evidence_strength: ${scalar(item.evidenceStrength, 'weak')}
blocked_reason: ${scalar(item.blockedReason, 'none')}
claims:
${listYaml(item.claims)}
`;
}

function writeMarkdown(dir: string, title: string, markdown: string) {
  fs.mkdirSync(path.join(ROOT, dir), { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const file = path.join(ROOT, dir, `${date} ${slugifyFileName(title)}.md`);
  fs.writeFileSync(file, markdown);
  return path.relative(ROOT, file);
}

function listMarkdown(items: string[] | undefined, fallback: string) {
  const clean = (items || []).map((item) => item.trim()).filter(Boolean).slice(0, 8);
  return clean.length ? clean.map((item) => `- ${item}`).join('\n') : `- ${fallback}`;
}

function ideaMarkdown(idea: JudgementIdea, runId?: string) {
  const stage = idea.stage || 'worth_trying';
  return `---\ntype: idea\nstage: ${stage}\nstatus: ${stage === 'act_now' ? 'test' : stage === 'ignore' ? 'ignore' : 'watch'}\ncategory: llm-judgement\nstrategic_relevance: ${boundedScore(idea.leverage, 3)}\nactionability: ${boundedScore(idea.effort ? 6 - idea.effort : undefined, 3)}\nrisk: medium\nconfidence: medium\nsource: Hermes LLM judgement\n${researchFrontmatter(idea)}source_urls:\n${sourceYaml(idea.sourceUrls)}\ndependency_urls:\n${sourceYaml(idea.dependencyUrls)}\nsource_note_path: ${idea.sourceNotePath || 'pending'}\nrun_id: ${runId || 'manual'}\n---\n\n# ${idea.title}\n\n## Thesis\n${idea.thesis}\n\n## Why now\n${idea.whyNow}\n\n## Next move\n${idea.nextMove}\n\n## Execution path\n${listMarkdown(idea.executionPath, idea.nextMove)}\n\n## Source note\n${idea.sourceNotePath || runId || 'manual'}\n\n## Dependency / tool URLs\n${listMarkdown(idea.dependencyUrls, 'No extra dependency URL found in source.')}\n\n## Next actions\n- ${idea.nextMove}\n`;
}

function experimentMarkdown(experiment: JudgementExperiment, runId?: string) {
  const killCriteria = experiment.killCriteria || 'Kill or park this if the first test cannot produce evidence within one day or if the signal depends on unverifiable claims.';
  return `---\ntype: experiment\nstage: ${experiment.stage || 'queued'}\nstatus: test\ncategory: llm-judgement\nrisk: low\nconfidence: medium\nsource: Hermes LLM judgement\n${researchFrontmatter(experiment)}source_urls:\n${sourceYaml(experiment.sourceUrls)}\ndependency_urls:\n${sourceYaml(experiment.dependencyUrls)}\nsource_note_path: ${experiment.sourceNotePath || 'pending'}\nrun_id: ${runId || 'manual'}\n---\n\n# ${experiment.title}\n\n## Hypothesis\n${experiment.hypothesis}\n\n## First test\n${experiment.firstTest}\n\n## Success signal\n${experiment.successSignal}\n\n## Kill criteria\n${killCriteria}\n\n## Execution path\n${listMarkdown(experiment.executionPath, experiment.firstTest)}\n\n## Source note\n${experiment.sourceNotePath || runId || 'manual'}\n\n## Dependency / tool URLs\n${listMarkdown(experiment.dependencyUrls, 'No extra dependency URL found in source.')}\n\n## Next actions\n- ${experiment.firstTest}\n`;
}

function actionMarkdown(actions: JudgementAction[], runId?: string, summary?: string) {
  const date = new Date().toISOString().slice(0, 10);
  const bullets = actions.map((action) => `- ${action.text}${action.reason ? ` — ${action.reason}` : ''}`).join('\n');
  const researchRows = actions.map((action) => `- ${action.text}
  - Lane: ${scalar(action.targetLane, 'verify')}
  - Priority: ${scalar(action.priority, 'medium')}
  - Owner: ${scalar(action.owner, 'Hermes')}
  - Verification: ${scalar(action.verificationStatus, 'needs_verification')}
  - Evidence: ${scalar(action.evidenceStrength, 'weak')}
  - Source note: ${action.sourceNotePath || 'pending'}
  - Source URLs: ${(action.sourceUrls || []).join(', ') || 'pending'}
  - Claims: ${(action.claims || []).join(' | ') || 'pending'}`).join('\n');
  return `---\ntype: action\nstatus: test\ncategory: llm-judgement\nrisk: low\nconfidence: medium\nsource: Hermes LLM judgement\nrun_id: ${runId || 'manual'}\nlast_checked: ${date}\n---\n\n# Hermes LLM Action Queue ${date}\n\n## Summary\n${summary || 'Hermes selected these actions from the latest ingestion run.'}\n\n## Next actions\n${bullets || '- Review the latest ingestion run and choose one concrete next action.'}\n\n## Research routing\n${actions.map((action) => `- ${action.text}: ${scalar(action.targetLane, 'verify')} / ${scalar(action.evidenceStrength, 'weak')} / ${scalar(action.verificationStatus, 'needs_verification')}`).join('\n') || '- pending'}\n\n## Evidence trace\n${researchRows || '- pending'}\n`;
}


export async function POST(request: Request) {
  if (!isHermesIngestAuthorized(request)) return unauthorized();
  let body: JudgementBody;
  try {
    body = await request.json() as JudgementBody;
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON body.' }, { status: 400 });
  }

  const files: string[] = [];
  const safeBody = normalizeResearchJudgementPayload(body) as JudgementBody;
  for (const idea of (safeBody.ideas || []).slice(0, 12)) {
    if (idea.title && idea.thesis && idea.whyNow && idea.nextMove) files.push(writeMarkdown('Ideas', idea.title, ideaMarkdown(idea, body.runId)));
  }
  for (const experiment of (safeBody.experiments || []).slice(0, 12)) {
    if (experiment.title && experiment.hypothesis && experiment.firstTest && experiment.successSignal) files.push(writeMarkdown('Experiments', experiment.title, experimentMarkdown(experiment, body.runId)));
  }
  if (safeBody.actions?.length) files.push(writeMarkdown('Actions', `Hermes LLM Action Queue ${new Date().toISOString().slice(0, 10)}`, actionMarkdown(safeBody.actions.slice(0, 20), body.runId, body.summary)));

  const research = generateResearchLayer(safeBody, { writtenFiles: files });

  return NextResponse.json({ ok: true, files, research, counts: { ideas: safeBody.ideas?.length || 0, experiments: safeBody.experiments?.length || 0, actions: safeBody.actions?.length || 0 } });
}
