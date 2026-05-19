export type NoteType = 'repo' | 'use_case' | 'product' | 'model' | 'synthesis' | 'scorio_idea' | 'idea' | 'experiment' | 'action' | 'capture' | 'plan' | 'unknown';
export type Status = 'inbox' | 'verify' | 'test' | 'adopt' | 'watch' | 'ignore' | 'promoted' | 'unknown';
export type Risk = 'low' | 'medium' | 'high' | 'unknown';
export type Confidence = 'low' | 'medium' | 'high' | 'unknown';

export type RadarNote = {
  slug: string;
  fileName: string;
  path: string;
  title: string;
  type: NoteType;
  status: Status;
  category: string;
  strategicRelevance: number;
  actionability: number;
  risk: Risk;
  confidence: Confidence;
  sourceUrls: string[];
  tags: string[];
  created?: string;
  updated?: string;
  lastChecked?: string;
  ingestionRunId?: string;
  ingestedAt?: string;
  sourceChannel?: string;
  sourceStatusUrl?: string;
  statusId?: string;
  statusIdentityStatus?: string;
  stage?: string;
  owner?: string;
  source?: string;
  excerpt: string;
  content: string;
  html: string;
  headings: string[];
  repoMentions: RepoMention[];
  actionItems: ActionItem[];
};

export type RepoMention = {
  name: string;
  url?: string;
  sourceNoteSlug: string;
  sourceNoteTitle: string;
  stars?: string;
  risk: Risk;
  status: Status;
  category: string;
  nextAction?: string;
  relevance: number;
};

export type CanonicalActionSource = {
  noteSlug: string;
  noteTitle: string;
  notePath: string;
  noteType: NoteType;
};

export type CanonicalAction = {
  id: string;
  text: string;
  normalizedText: string;
  priority: 'high' | 'medium' | 'low';
  primaryCategory: string;
  categories: string[];
  sourceTypes: Array<'action' | 'idea' | 'experiment' | 'raw'>;
  sourceCount: number;
  sources: CanonicalActionSource[];
  boilerplate: boolean;
  score: number;
};

export type DashboardData = {
  notes: RadarNote[];
  repos: RepoMention[];
  actions: ActionItem[];
  stats: {
    notes: number;
    repos: number;
    actions: number;
    highRelevance: number;
    verify: number;
  };
};

export type ActionItem = {
  id: string;
  text: string;
  sourceNoteSlug: string;
  sourceNoteTitle: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
};
