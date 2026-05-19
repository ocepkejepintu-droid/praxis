import { getCanonicalActions } from './actions.ts';
import { getHermesAtlasPraxies } from './hermes-atlas.ts';
import type { CanonicalAction, DashboardData, RepoMention } from './types';

export type IdeaStage = 'act_now' | 'worth_trying' | 'watch' | 'ignore';
export type ExperimentStage = 'worth_trying' | 'queued' | 'verifying' | 'learning' | 'tried' | 'adopted' | 'killed';

export type IdeaCard = {
  id: string;
  title: string;
  stage: IdeaStage;
  thesis: string;
  whyNow: string;
  nextMove: string;
  leverage: number;
  effort: number;
  source: string;
  sourceNoteHref: string;
  sourcePath: string;
  sourceUrls: string[];
  executionSteps: string[];
};

export type ExperimentCard = {
  id: string;
  title: string;
  stage: ExperimentStage;
  status: string;
  hypothesis: string;
  firstTest: string;
  successSignal: string;
  owner: 'Yoseph' | 'Hermes' | 'OMX';
  source: string;
  sourceNoteHref: string;
  sourcePath: string;
  sourceUrls: string[];
  executionSteps: string[];
  killCriteria: string;
};

export type CommandPrompt = {
  label: string;
  command: string;
  useWhen: string;
};

export type OperatingSlice = {
  ideas: IdeaCard[];
  experiments: ExperimentCard[];
  commands: CommandPrompt[];
  topActions: CanonicalAction[];
  riskyRepos: RepoMention[];
};

function section(content: string, heading: string) {
  const pattern = new RegExp(`^## ${heading}\\s*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'im');
  return content.match(pattern)?.[1]?.trim() || '';
}

function ideaStage(value?: string): IdeaStage {
  return value === 'act_now' || value === 'worth_trying' || value === 'watch' || value === 'ignore' ? value : 'worth_trying';
}

function experimentStage(value?: string): ExperimentStage {
  return value === 'worth_trying' || value === 'queued' || value === 'verifying' || value === 'learning' || value === 'tried' || value === 'adopted' || value === 'killed' ? value : 'queued';
}

function cleanListItems(value: string) {
  return value
    .split('\n')
    .map((line) => line.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '').trim())
    .filter(Boolean)
    .slice(0, 4);
}

function dynamicIdeas(data: DashboardData): IdeaCard[] {
  return data.notes
    .filter((note) => note.type === 'idea')
    .map((note) => ({
      id: note.slug,
      title: note.title,
      stage: ideaStage(note.stage),
      thesis: section(note.content, 'Thesis') || note.excerpt,
      whyNow: section(note.content, 'Why now') || 'Hermes judged this from the latest ingestion run.',
      nextMove: section(note.content, 'Next move') || note.actionItems[0]?.text || 'Define the smallest next test.',
      leverage: note.strategicRelevance,
      effort: Math.max(1, Math.min(5, 6 - note.actionability)),
      source: note.source || note.fileName,
      sourceNoteHref: `/notes/${note.slug}`,
      sourcePath: note.path,
      sourceUrls: note.sourceUrls.slice(0, 4),
      executionSteps: cleanListItems(section(note.content, 'Next actions')).length
        ? cleanListItems(section(note.content, 'Next actions'))
        : [section(note.content, 'Next move') || note.actionItems[0]?.text || 'Define the smallest next test.'],
    }));
}

function dynamicExperiments(data: DashboardData): ExperimentCard[] {
  return data.notes
    .filter((note) => note.type === 'experiment')
    .map((note) => ({
      id: note.slug,
      title: note.title,
      stage: experimentStage(note.stage),
      status: note.status,
      hypothesis: section(note.content, 'Hypothesis') || note.excerpt,
      firstTest: section(note.content, 'First test') || note.actionItems[0]?.text || 'Run the smallest evidence-producing test.',
      successSignal: section(note.content, 'Success signal') || 'Clear evidence that the idea is worth keeping.',
      owner: note.owner === 'Yoseph' || note.owner === 'OMX' || note.owner === 'Hermes' ? note.owner : 'Hermes',
      source: note.source || note.fileName,
      sourceNoteHref: `/notes/${note.slug}`,
      sourcePath: note.path,
      sourceUrls: note.sourceUrls.slice(0, 4),
      executionSteps: cleanListItems(section(note.content, 'Next actions')).length
        ? cleanListItems(section(note.content, 'Next actions'))
        : [section(note.content, 'First test') || note.actionItems[0]?.text || 'Run the smallest evidence-producing test.'],
      killCriteria: section(note.content, 'Kill criteria') || 'Stop if the first test cannot produce evidence quickly.',
    }));
}

export function getOperatingSlice(data: DashboardData): OperatingSlice {
  const llmIdeas = dynamicIdeas(data);
  const llmExperiments = dynamicExperiments(data);
  const topActions = getCanonicalActions(data).filter((action) => !action.boilerplate).slice(0, 8);
  const riskyRepos = data.repos.filter((repo) => repo.risk === 'high').slice(0, 6);
  const atlasExperiments: ExperimentCard[] = getHermesAtlasPraxies().map((praxis) => ({
    id: praxis.id,
    title: praxis.title,
    stage: praxis.stage,
    status: praxis.status,
    hypothesis: praxis.hypothesis,
    firstTest: praxis.firstTest,
    successSignal: praxis.successSignal,
    owner: praxis.owner,
    source: `Hermes Atlas · ${praxis.subcategory}`,
    sourceNoteHref: praxis.atlasUrl || praxis.githubUrl || '/praxies',
    sourcePath: praxis.sourcePath,
    sourceUrls: praxis.sourceUrls.slice(0, 6),
    executionSteps: praxis.executionSteps,
    killCriteria: praxis.killCriteria,
  }));

  return {
    topActions,
    riskyRepos,
    commands: [
      {
        label: 'Kimi WebBridge ingestion',
        command: 'Use Kimi WebBridge to crawl logged-in X home feed, resolve original URLs, classify each signal, and make Hermes write report cards with: executive headline, plain-English summary, why it matters, category, confidence, original post URL, source URLs, dependency URLs, execution path, recommended action, ignore-or-verify decision, success signal, and stop criteria.',
        useWhen: 'Use when turning long raw posts into a source-linked report instead of dumping crawl text.',
      },
    ],
    ideas: llmIdeas,
    experiments: [...llmExperiments, ...atlasExperiments],
  };
}
