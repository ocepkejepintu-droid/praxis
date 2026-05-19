import fs from 'node:fs';
import path from 'node:path';
import { getXReport } from './atlas';
import { getDashboardData, getNoteBySlug } from './markdown';
import { getOperatingSlice } from './os';
import { slugifyFileName } from './ingestion';

export type AcpEventType = 'x_ingested' | 'signals_ranked' | 'praxis_proposed' | 'praxis_selected' | 'praxis_created' | 'praxis_status_updated' | 'praxis_result' | 'praxis_killed' | 'praxis_adopted';

export type AcpEvent = {
  id: string;
  createdAt: string;
  from: string;
  to: string;
  type: AcpEventType;
  payload: unknown;
  sourceSlugs: string[];
  sourceUrls: string[];
};

const ACP_LOG = path.join(process.cwd(), '.radar', 'acp-log.jsonl');

export function compactNote(note: ReturnType<typeof getDashboardData>['notes'][number]) {
  return {
    slug: note.slug,
    title: note.title,
    type: note.type,
    status: note.status,
    stage: note.stage,
    category: note.category,
    score: (note.strategicRelevance * 3) + (note.actionability * 3) + (note.sourceUrls.length ? 2 : -2),
    strategicRelevance: note.strategicRelevance,
    actionability: note.actionability,
    confidence: note.confidence,
    risk: note.risk,
    sourceUrls: note.sourceUrls,
    detailUrl: `/notes/${note.slug}`,
    sourcePath: note.path,
    excerpt: note.excerpt,
  };
}

export function getAgentReport() {
  const data = getDashboardData();
  return { report: getXReport(data), generatedAt: new Date().toISOString() };
}

export function searchSignals(params: { q?: string; category?: string; runId?: string; limit?: number }) {
  const q = (params.q || '').toLowerCase();
  return getDashboardData().notes
    .filter((note) => note.type !== 'plan')
    .filter((note) => !params.category || note.category === params.category)
    .filter((note) => !params.runId || note.ingestionRunId === params.runId)
    .filter((note) => !q || `${note.title} ${note.excerpt} ${note.content}`.toLowerCase().includes(q))
    .map(compactNote)
    .sort((a, b) => b.score - a.score)
    .slice(0, params.limit || 25);
}

export function rankPraxisCandidates(params: { focus?: string; limit?: number }) {
  const focus = (params.focus || '').toLowerCase();
  const os = getOperatingSlice(getDashboardData());
  return os.experiments
    .filter((praxis) => !focus || `${praxis.title} ${praxis.hypothesis} ${praxis.firstTest}`.toLowerCase().includes(focus))
    .map((praxis) => ({
      ...praxis,
      kind: 'praxis',
      score: praxis.sourceUrls.length * 2 + praxis.executionSteps.length + (praxis.stage === 'queued' ? 3 : 0) + (praxis.stage === 'worth_trying' ? 2 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, params.limit || 12);
}

export function getAgentNote(slug: string) {
  const note = getNoteBySlug(slug);
  return note ? { ...compactNote(note), markdown: note.content, html: note.html, headings: note.headings, actionItems: note.actionItems, repoMentions: note.repoMentions } : null;
}

export function appendAcpEvent(input: Omit<Partial<AcpEvent>, 'id' | 'createdAt'> & { type: AcpEventType }) {
  fs.mkdirSync(path.dirname(ACP_LOG), { recursive: true });
  const event: AcpEvent = {
    id: `acp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    from: input.from || 'unknown',
    to: input.to || 'radar',
    type: input.type,
    payload: input.payload || {},
    sourceSlugs: input.sourceSlugs || [],
    sourceUrls: input.sourceUrls || [],
  };
  fs.appendFileSync(ACP_LOG, `${JSON.stringify(event)}\n`);
  return event;
}

export function readAcpEvents(limit = 50) {
  try {
    return fs.readFileSync(ACP_LOG, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as AcpEvent).slice(-limit).reverse();
  } catch {
    return [];
  }
}

export function createPraxisNote(input: { title: string; hypothesis: string; firstTest: string; successSignal?: string; killCriteria?: string; sourceUrls?: string[]; owner?: string }) {
  const date = new Date().toISOString().slice(0, 10);
  const title = input.title.trim();
  const fileName = `${date} ${slugifyFileName(title)}.md`;
  const rel = path.join('Experiments', fileName);
  const full = path.join(process.cwd(), rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  const sourceUrls = (input.sourceUrls || []).filter(Boolean).map((url) => `  - "${url.replace(/"/g, '\\"')}"`).join('\n') || '  - pending';
  const markdown = `---\ntype: experiment\nstage: queued\nstatus: test\ncategory: agent-praxis\nrisk: low\nconfidence: medium\nowner: ${input.owner || 'agent'}\nsource_urls:\n${sourceUrls}\ncreated: ${new Date().toISOString()}\n---\n\n# ${title}\n\n## Hypothesis\n${input.hypothesis}\n\n## First test\n${input.firstTest}\n\n## Success signal\n${input.successSignal || 'Evidence that the praxis is worth keeping.'}\n\n## Kill criteria\n${input.killCriteria || 'Stop if the first test cannot produce evidence quickly.'}\n\n## Next actions\n- ${input.firstTest}\n`;
  fs.writeFileSync(full, markdown);
  appendAcpEvent({ type: 'praxis_created', from: input.owner || 'agent', to: 'radar', payload: { title, path: rel }, sourceUrls: input.sourceUrls || [] });
  return { path: rel, title };
}
