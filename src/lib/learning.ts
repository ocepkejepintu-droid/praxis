import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { appendAcpEvent } from './agent';
import { listAcpApiKeys, type AcpAdapter } from './acp';
import { getDashboardData } from './markdown';
import { getOperatingSlice } from './os';
import { slugifyFileName } from './ingestion';

export type LearningReport = {
  id: string;
  agentId?: string;
  agentName: string;
  adapter: AcpAdapter;
  praxisSlug?: string;
  praxisTitle?: string;
  runId?: string;
  category?: string;
  status: 'learning' | 'tried' | 'adopted' | 'killed' | 'blocked';
  summary: string;
  learned: string;
  tried: string;
  worked: string;
  failed: string;
  nextAction: string;
  evidenceUrls: string[];
  createdAt: string;
  path: string;
};

export type AgentProfile = {
  id: string;
  name: string;
  owner: string;
  adapter: AcpAdapter;
  purpose: string;
  capabilityTags: string[];
  preferredCategories: string[];
  learningLevel: 'new' | 'active' | 'advanced';
  status: string;
  activePraxies: number;
  completedPraxies: number;
  failedPraxies: number;
  adoptedPatterns: string[];
  learningNotes: string[];
  latestReport?: LearningReport;
  reports: LearningReport[];
  progressTimeline: Array<{ date: string; label: string; status: string }>;
};

const LEARNING_DIR = path.join(process.cwd(), 'Learning Reports');

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function reportMarkdown(input: Omit<LearningReport, 'id' | 'createdAt' | 'path'>) {
  const createdAt = new Date().toISOString();
  const evidence = input.evidenceUrls.length ? input.evidenceUrls.map((url) => `  - "${url.replace(/"/g, '\\"')}"`).join('\n') : '  - pending';
  return `---\ntype: learning_report\nagent_name: "${input.agentName.replace(/"/g, '\\"')}"\nagent_id: "${input.agentId || 'unknown'}"\nadapter: ${input.adapter}\npraxis_slug: "${input.praxisSlug || 'unassigned'}"\npraxis_title: "${(input.praxisTitle || 'Unassigned praxis').replace(/"/g, '\\"')}"\nrun_id: "${input.runId || 'manual'}"\ncategory: "${input.category || 'agent-learning'}"\nstatus: ${input.status}\ncreated: "${createdAt}"\nevidence_urls:\n${evidence}\n---\n\n# ${input.agentName} learning report\n\n## Summary\n${input.summary}\n\n## What it learned\n${input.learned}\n\n## What it tried\n${input.tried}\n\n## What worked\n${input.worked}\n\n## What failed\n${input.failed}\n\n## Next action\n${input.nextAction}\n`;
}

function parseReport(file: string): LearningReport | null {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = matter(raw);
    const rel = path.relative(process.cwd(), file);
    const section = (heading: string) => {
      const match = parsed.content.match(new RegExp(`^## ${heading}\\s*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'im'));
      return match?.[1]?.trim() || '';
    };
    const id = rel.replace(/\.md$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return {
      id,
      agentId: String(parsed.data.agent_id || '') || undefined,
      agentName: String(parsed.data.agent_name || 'Unknown agent'),
      adapter: parsed.data.adapter === 'openclaw' ? 'openclaw' : 'hermes',
      praxisSlug: String(parsed.data.praxis_slug || '') || undefined,
      praxisTitle: String(parsed.data.praxis_title || '') || undefined,
      runId: String(parsed.data.run_id || '') || undefined,
      category: String(parsed.data.category || '') || undefined,
      status: ['learning', 'tried', 'adopted', 'killed', 'blocked'].includes(String(parsed.data.status)) ? String(parsed.data.status) as LearningReport['status'] : 'learning',
      summary: section('Summary'),
      learned: section('What it learned'),
      tried: section('What it tried'),
      worked: section('What worked'),
      failed: section('What failed'),
      nextAction: section('Next action'),
      evidenceUrls: asStringArray(parsed.data.evidence_urls),
      createdAt: parsed.data.created ? String(parsed.data.created) : fs.statSync(file).mtime.toISOString(),
      path: rel,
    };
  } catch {
    return null;
  }
}

export function listLearningReports(limit = 100): LearningReport[] {
  if (!fs.existsSync(LEARNING_DIR)) return [];
  return fs.readdirSync(LEARNING_DIR)
    .filter((file) => file.endsWith('.md'))
    .map((file) => parseReport(path.join(LEARNING_DIR, file)))
    .filter((report): report is LearningReport => Boolean(report))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function submitLearningReport(input: Partial<Omit<LearningReport, 'id' | 'createdAt' | 'path'>>) {
  const agentName = (input.agentName || 'Agent').trim().slice(0, 80);
  const adapter = input.adapter === 'openclaw' ? 'openclaw' : 'hermes';
  const reportInput = {
    agentId: input.agentId,
    agentName,
    adapter,
    praxisSlug: input.praxisSlug,
    praxisTitle: input.praxisTitle,
    runId: input.runId,
    category: input.category,
    status: input.status || 'learning',
    summary: input.summary || 'Learning report submitted.',
    learned: input.learned || 'Pending learning detail.',
    tried: input.tried || 'Pending experiment detail.',
    worked: input.worked || 'Pending positive signal.',
    failed: input.failed || 'Pending failure signal.',
    nextAction: input.nextAction || 'Choose the next smallest Praxis step.',
    evidenceUrls: input.evidenceUrls || [],
  } satisfies Omit<LearningReport, 'id' | 'createdAt' | 'path'>;
  fs.mkdirSync(LEARNING_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, 'Z');
  const fileName = `${stamp} ${slugifyFileName(`${agentName} ${reportInput.praxisTitle || reportInput.praxisSlug || 'learning-report'}`)}.md`;
  const fullPath = path.join(LEARNING_DIR, fileName);
  fs.writeFileSync(fullPath, reportMarkdown(reportInput));
  const report = parseReport(fullPath);
  appendAcpEvent({
    type: 'praxis_result',
    from: agentName,
    to: 'radar',
    payload: { reportPath: report?.path, praxisSlug: reportInput.praxisSlug, status: reportInput.status, learned: reportInput.learned, nextAction: reportInput.nextAction },
    sourceSlugs: reportInput.praxisSlug ? [reportInput.praxisSlug] : [],
    sourceUrls: reportInput.evidenceUrls,
  });
  return report;
}

export function getAgentProfiles(): AgentProfile[] {
  const keys = listAcpApiKeys();
  const reports = listLearningReports(200);
  const praxies = getOperatingSlice(getDashboardData()).experiments;
  return keys.map((key) => {
    const ownedReports = reports.filter((report) => report.agentId === key.id || report.agentName.toLowerCase() === key.name.toLowerCase() || report.agentName.toLowerCase() === key.owner.toLowerCase());
    const active = new Set(ownedReports.filter((report) => report.status === 'learning' || report.status === 'tried').map((report) => report.praxisSlug).filter(Boolean));
    const completed = ownedReports.filter((report) => report.status === 'adopted' || report.status === 'killed').length;
    const failed = ownedReports.filter((report) => report.status === 'killed' || report.status === 'blocked').length;
    const categories = Array.from(new Set(ownedReports.map((report) => report.category).filter(Boolean) as string[]));
    return {
      id: key.id,
      name: key.name,
      owner: key.owner,
      adapter: key.adapter,
      purpose: key.adapter === 'hermes' ? 'Summarize community signals into report-grade Praxis candidates.' : 'Learn through Praxis cards and report experiment progress.',
      capabilityTags: key.permissions,
      preferredCategories: categories.length ? categories : ['agent-learning', 'coding-agent', 'mcp-cli'],
      learningLevel: ownedReports.length > 6 ? 'advanced' : ownedReports.length ? 'active' : 'new',
      status: key.status,
      activePraxies: active.size || praxies.filter((praxis) => praxis.stage === 'queued').slice(0, 3).length,
      completedPraxies: completed,
      failedPraxies: failed,
      adoptedPatterns: ownedReports.filter((report) => report.status === 'adopted').map((report) => report.learned).slice(0, 3),
      learningNotes: ownedReports.map((report) => report.summary).slice(0, 5),
      latestReport: ownedReports[0],
      reports: ownedReports,
      progressTimeline: ownedReports.map((report) => ({ date: report.createdAt, label: report.praxisTitle || report.praxisSlug || 'Learning report', status: report.status })).slice(0, 8),
    };
  });
}

export function getAgentProfile(id: string) {
  return getAgentProfiles().find((profile) => profile.id === id || profile.name.toLowerCase() === id.toLowerCase()) || null;
}
