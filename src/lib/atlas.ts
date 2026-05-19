import { getCanonicalActions } from './actions';
import type { CanonicalAction, DashboardData, RadarNote, RepoMention } from './types';

export type AtlasList = {
  slug: string;
  title: string;
  copy: string;
  href: string;
  count: number;
};

export type AtlasCategory = {
  key: string;
  title: string;
  copy: string;
  repos: RepoMention[];
  notes: RadarNote[];
  actions: CanonicalAction[];
};

export type XReportHeadline = {
  id: string;
  title: string;
  category: string;
  summary: string;
  why: string;
  sourceHref: string;
  detailHref: string;
  originalCount: number;
  confidence: string;
};

export type XReportTheme = {
  key: string;
  title: string;
  count: number;
  sourceCount: number;
  whatChanged: string;
  href: string;
};

export type XReportBrief = {
  latestDate: string;
  sourceMappedCount: number;
  rawCaptureCount: number;
  signalCount: number;
  noiseCount: number;
  topThemes: XReportTheme[];
  headlines: XReportHeadline[];
  recommendedMoves: CanonicalAction[];
  reportSections: Array<{ title: string; body: string }>;
};

const categoryCopy: Record<string, string> = {
  'agent-runtime': 'Runtime, sandbox, orchestration, and execution backends worth testing.',
  'browser-agent': 'Browser, phone, GUI, and web automation signals that can become workflows.',
  'coding-agent': 'Developer agent tools, repos, and implementation leads.',
  'content-agent': 'Content, voice, video, and publishing agents with practical adoption paths.',
  'mcp-cli': 'MCP, CLI, API, and connector surfaces for agent integration.',
  model: 'Models, evals, inference, and LLM infrastructure signals.',
  scorio: 'Scorio, Hermes, OMX, and local operating-system ideas.',
  commerce: 'Commerce, wallet, payment, and buyer-agent opportunities.',
};

const REPORT_SOURCE_LIMIT = 5;

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function section(content: string, heading: string) {
  const pattern = new RegExp(`^## ${heading}\\s*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'im');
  return content.match(pattern)?.[1]?.trim() || '';
}

function cleanReportText(value: string, maxLength = 220) {
  const cleaned = value
    .replace(/^[-*]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .replace(/\b\d+\s+\d+\s+[\d.]+K\b/gi, '')
    .replace(/\b[\d.]+K\s+[\d.]+M\b/gi, '')
    .replace(/\s([,.])/g, '$1')
    .trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 1).replace(/\s+\S*$/, '')}…`;
}

function signalSummary(note: RadarNote) {
  const signal = section(note.content, 'Signal');
  return cleanReportText(signal || note.excerpt || note.title, 230);
}

function signalWhy(note: RadarNote) {
  const why = section(note.content, 'Why it matters');
  const cleanedWhy = cleanReportText(why, 180);
  const summary = signalSummary(note);
  if (cleanedWhy && cleanedWhy !== summary && !summary.startsWith(cleanedWhy)) return cleanedWhy;
  return `${readableCategory(note.category)} signal to verify before it becomes a build decision.`;
}

function latestDate(notes: RadarNote[]) {
  const dates = notes
    .map((note) => note.lastChecked || note.updated || note.created || '')
    .filter(Boolean)
    .map((value) => {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? value.slice(0, 10) : parsed.toISOString().slice(0, 10);
    })
    .sort();
  return dates.at(-1) || 'not checked';
}

function noteScore(note: RadarNote) {
  const confidenceBoost = note.confidence === 'high' ? 3 : note.confidence === 'medium' ? 2 : 0;
  const sourceBoost = Math.min(3, uniqueValues(note.sourceUrls).length);
  const typeBoost = note.type === 'idea' || note.type === 'experiment' ? 2 : 0;
  return (note.strategicRelevance * 5) + (note.actionability * 4) + confidenceBoost + sourceBoost + typeBoost;
}

function isAdLike(note: RadarNote) {
  const text = `${note.title} ${note.excerpt} ${note.content} ${note.sourceUrls.join(' ')}`;
  return /\b(ad|sponsored|promoted|promo|diskon|sale|utm_campaign|paid_social|twclid|destinationPageType)\b/i.test(text)
    || /@bliblidotcom|perisclaw|acetrader|huawei|venice|scylladb/i.test(text);
}

function isGenericCaptureDump(note: RadarNote) {
  return /24h\s+AI Agent Intel|X Feed\s*→\s*Durable Knowledge|Captured:\s*\d{4}-\d{2}-\d{2}|source:\s*logged-in X/i.test(`${note.title}
${note.content}`);
}

function isAgentRelevant(note: RadarNote) {
  const text = `${note.title} ${note.excerpt} ${note.content} ${note.sourceUrls.join(' ')}`;
  return /agent|mcp|codex|openclaw|hermes|omx|browser|automation|workflow|repo|github|llm|model|runtime|tool|api|sdk|praxis|learning|eval/i.test(text);
}

function isFrontPageSignal(note: RadarNote) {
  if (note.type === 'plan' || isAdLike(note) || isGenericCaptureDump(note)) return false;
  if (note.status === 'ignore') return false;
  if (!note.sourceUrls.length) return false;
  if (!isAgentRelevant(note)) return false;
  if (note.confidence === 'low' && note.actionability < 4 && note.strategicRelevance < 4) return false;
  return true;
}

function isNoise(note: RadarNote) {
  return note.status === 'ignore'
    || isAdLike(note)
    || note.confidence === 'low' && note.actionability <= 3 && note.strategicRelevance <= 3
    || !note.sourceUrls.length && note.actionability <= 2;
}

export function readableCategory(value: string) {
  if (value === 'llm-judgement') return 'Research Judgement';
  return value
    .split('-')
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : part)
    .join(' & ');
}

export function formatCompactNumber(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`;
  return String(value);
}

export function getAtlasCategories(data: DashboardData): AtlasCategory[] {
  const actions = getCanonicalActions(data).filter((action) => !action.boilerplate);
  const cleanNotes = data.notes.filter((note) => !isAdLike(note) && !isGenericCaptureDump(note));
  const cleanRepos = data.repos.filter((repo) => !/ad|promo|blibli|perisclaw|acetrader|huawei|venice|scylladb/i.test(`${repo.name} ${repo.url || ''} ${repo.sourceNoteTitle}`));
  const keys = Array.from(new Set([
    ...cleanRepos.map((repo) => repo.category),
    ...cleanNotes.map((note) => note.category),
    ...actions.map((action) => action.primaryCategory),
  ])).filter(Boolean).sort();

  return keys.map((key) => ({
    key,
    title: readableCategory(key),
    copy: categoryCopy[key] || 'Mapped signals from notes, repos, and execution tasks.',
    repos: cleanRepos.filter((repo) => repo.category === key).slice(0, 8),
    notes: cleanNotes.filter((note) => note.category === key).slice(0, 4),
    actions: actions.filter((action) => action.categories.includes(key) || action.primaryCategory === key).slice(0, 4),
  })).sort((a, b) => (b.repos.length + b.notes.length + b.actions.length) - (a.repos.length + a.notes.length + a.actions.length));
}

export function getAtlasLists(data: DashboardData): AtlasList[] {
  const actions = getCanonicalActions(data).filter((action) => !action.boilerplate);
  return [
    {
      slug: 'act-now',
      title: 'What moved',
      copy: 'Fresh X signals that changed the operating picture enough to read first.',
      href: '/ideas?stage=act_now',
      count: data.notes.filter((note) => note.stage === 'act_now' || note.actionability >= 5).length,
    },
    {
      slug: 'repo-verification',
      title: 'What to verify',
      copy: 'Claims, repos, and tools that need source checks before entering the work queue.',
      href: '/repos?status=verify',
      count: data.repos.filter((repo) => repo.status === 'verify').length,
    },
    {
      slug: 'execution-paths',
      title: 'What to try',
      copy: 'Source-linked praxis paths: why, first test, dependency, success signal, stop criteria.',
      href: '/praxies',
      count: data.notes.filter((note) => note.type === 'experiment' || note.type === 'idea').length,
    },
    {
      slug: 'source-map',
      title: 'Original sources',
      copy: 'Notes with URLs preserved so every short summary can trace back to its raw post or repo.',
      href: '/ideas',
      count: data.notes.filter((note) => note.sourceUrls.length).length,
    },
    {
      slug: 'clean-queue',
      title: 'Clean action queue',
      copy: 'Canonical tasks deduped from raw X notes, with recurring ingestion boilerplate collapsed.',
      href: '/actions',
      count: actions.length,
    },
    {
      slug: 'hermes-inflow',
      title: 'Hermes inflow contract',
      copy: 'Required shape for new X captures: headline, summary, category, source trail, report action.',
      href: '/ingestion',
      count: data.notes.filter((note) => note.sourceUrls.length || note.repoMentions.length).length,
    },
  ];
}

export function getXReport(data: DashboardData): XReportBrief {
  const cleanActions = getCanonicalActions(data).filter((action) => !action.boilerplate);
  const signalNotes = data.notes.filter((note) => note.type !== 'plan');
  const frontPageSignals = signalNotes.filter(isFrontPageSignal);
  const sourceMapped = frontPageSignals.filter((note) => note.sourceUrls.length);
  const categories = getAtlasCategories(data);
  const topThemes = categories.map((category) => {
    const themeNotes = frontPageSignals.filter((note) => note.category === category.key).sort((a, b) => noteScore(b) - noteScore(a));
    const topNote = themeNotes[0];
    return {
      key: category.key,
      title: category.title,
      count: themeNotes.length,
      sourceCount: uniqueValues(themeNotes.flatMap((note) => note.sourceUrls)).length,
      whatChanged: topNote ? signalSummary(topNote) : category.copy,
      href: topNote ? `/notes/${topNote.slug}` : '/ideas',
    };
  }).filter((theme) => theme.count > 0).sort((a, b) => b.count - a.count).slice(0, 5);
  const headlines = sourceMapped
    .filter((note) => note.strategicRelevance >= 3 || note.actionability >= 4)
    .sort((a, b) => noteScore(b) - noteScore(a))
    .slice(0, REPORT_SOURCE_LIMIT)
    .map((note) => {
      const sources = uniqueValues(note.sourceUrls);
      return {
        id: note.slug,
        title: note.title.replace(/^X signal:\s*/i, ''),
        category: readableCategory(note.category),
        summary: signalSummary(note),
        why: signalWhy(note),
        sourceHref: sources.find((url) => /\/status\//.test(url)) || sources[0] || `/notes/${note.slug}`,
        detailHref: `/notes/${note.slug}`,
        originalCount: sources.length,
        confidence: note.confidence,
      };
    });
  const recommendedMoves = cleanActions
    .filter((action) => !/^resolve primary source links|^promote to an experiment only/i.test(action.text))
    .slice(0, 4);
  const leadTheme = topThemes[0]?.title || 'AI-agent tooling';
  const leadMove = recommendedMoves[0]?.text || 'Pick one high-confidence signal and write a one-day test from its source trail.';

  return {
    latestDate: latestDate(signalNotes),
    sourceMappedCount: sourceMapped.length,
    rawCaptureCount: signalNotes.filter((note) => note.type === 'capture').length,
    signalCount: signalNotes.length,
    noiseCount: signalNotes.filter(isNoise).length,
    topThemes,
    headlines,
    recommendedMoves,
    reportSections: [
      {
        title: 'What happened',
        body: `${sourceMapped.length} source-mapped field notes are clustered into ${topThemes.length} report themes. ${leadTheme} is the strongest current cluster.`,
      },
      {
        title: 'Why it matters',
        body: 'Raw X posts are being translated into decision cards: summary, reason, source trail, dependency path, and next move.',
      },
      {
        title: 'What to do next',
        body: leadMove,
      },
      {
        title: 'What to ignore / verify',
        body: `${signalNotes.filter(isNoise).length} low-confidence or low-actionability captures should stay out of execution until original sources or dependency URLs are resolved.`,
      },
    ],
  };
}

export function getFeaturedNote(data: DashboardData) {
  return data.notes.find((note) => note.stage === 'act_now')
    || data.notes.find((note) => note.strategicRelevance >= 5)
    || data.notes[0];
}

export function getFeaturedRepo(data: DashboardData) {
  return data.repos.find((repo) => repo.status === 'verify') || data.repos[0];
}
