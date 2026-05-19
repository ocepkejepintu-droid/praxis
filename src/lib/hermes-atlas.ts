import fs from 'node:fs';
import path from 'node:path';
import { readIngestionRunHistory, readLatestHermesAtlasRun } from './ingestion-status.ts';
import { getDashboardData } from './markdown.ts';

export type HermesAtlasCard = {
  externalId?: string;
  title: string;
  body?: string;
  author?: string;
  category?: string;
  sourceUrl?: string;
  canonicalUrl?: string;
  urls: string[];
  metrics?: Record<string, unknown>;
  publishedAt?: string;
  runId?: string;
  file?: string;
};

export type HermesAtlasMatch = {
  card: HermesAtlasCard;
  reason: 'canonical_url' | 'atlas_project_url' | 'repo_name';
  score: number;
  sourceUrls: string[];
  dependencyUrls: string[];
  claims: string[];
};

function cleanRepoName(value: string) {
  return value.toLowerCase().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/i, '').replace(/[^a-z0-9/_-]+/g, '').replace(/^\/|\/$/g, '');
}

function repoFromGithubUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (!/github\.com$/i.test(parsed.hostname)) return '';
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return '';
    return cleanRepoName(`${parts[0]}/${parts[1]}`);
  } catch {
    return '';
  }
}

function atlasKeyFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (!/hermesatlas\.com$/i.test(parsed.hostname)) return '';
    const match = parsed.pathname.match(/^\/projects\/([^/]+)\/([^/]+)/);
    if (!match) return '';
    return cleanRepoName(`${decodeURIComponent(match[1])}/${decodeURIComponent(match[2])}`);
  } catch {
    return '';
  }
}

function arr(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function readJson<T>(file: string): T | null {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) as T; } catch { return null; }
}

function normalizedCardsForRun(runId: string): HermesAtlasCard[] {
  const runDir = path.join(process.cwd(), '.omx', 'ingestion-runs', runId);
  const cards = readJson<Array<Record<string, unknown>>>(path.join(runDir, 'normalized-cards.json')) || [];
  return cards.map((card) => ({
    externalId: typeof card.externalId === 'string' ? card.externalId : undefined,
    title: String(card.title || card.externalId || 'Hermes Atlas project'),
    body: typeof card.body === 'string' ? card.body : undefined,
    author: typeof card.author === 'string' ? card.author : undefined,
    category: typeof card.category === 'string' ? card.category : undefined,
    sourceUrl: typeof card.sourceUrl === 'string' ? card.sourceUrl : undefined,
    canonicalUrl: typeof card.canonicalUrl === 'string' ? card.canonicalUrl : undefined,
    urls: arr(card.urls),
    metrics: card.metrics && typeof card.metrics === 'object' && !Array.isArray(card.metrics) ? card.metrics as Record<string, unknown> : undefined,
    publishedAt: typeof card.publishedAt === 'string' ? card.publishedAt : undefined,
    runId,
  }));
}


export function readLatestHermesAtlasCards(limit = 500): HermesAtlasCard[] {
  const latest = readLatestHermesAtlasRun();
  if (!latest?.id) return [];
  return normalizedCardsForRun(latest.id).slice(0, limit);
}

export function readHermesAtlasCards(limit = 500): HermesAtlasCard[] {
  const runs = readIngestionRunHistory(200).filter((run) => run.source === 'hermes-atlas');
  const latest = readLatestHermesAtlasRun();
  const ordered = [latest, ...runs].filter((run): run is NonNullable<typeof run> => Boolean(run));
  const seenRuns = new Set<string>();
  const cards: HermesAtlasCard[] = [];
  for (const run of ordered) {
    if (seenRuns.has(run.id)) continue;
    seenRuns.add(run.id);
    cards.push(...normalizedCardsForRun(run.id));
    if (cards.length >= limit) break;
  }
  return cards.slice(0, limit);
}

function cardRepoKeys(card: HermesAtlasCard) {
  const keys = new Set<string>();
  if (card.externalId) keys.add(cleanRepoName(card.externalId));
  for (const url of [card.canonicalUrl, card.sourceUrl, ...card.urls].filter(Boolean) as string[]) {
    const repo = repoFromGithubUrl(url) || atlasKeyFromUrl(url);
    if (repo) keys.add(repo);
  }
  return keys;
}

export function findHermesAtlasMatches(input: { text?: string; urls?: string[] }, max = 3): HermesAtlasMatch[] {
  const text = input.text || '';
  const urls = input.urls || [];
  const textNorm = text.toLowerCase();
  const urlKeys = new Set(urls.map((url) => repoFromGithubUrl(url) || atlasKeyFromUrl(url)).filter(Boolean));
  const urlSet = new Set(urls.map((url) => url.toLowerCase().replace(/\?.*$/, '').replace(/\/$/, '')));
  const matches: HermesAtlasMatch[] = [];
  for (const card of readHermesAtlasCards()) {
    const cardUrls = [card.sourceUrl, card.canonicalUrl, ...card.urls].filter(Boolean) as string[];
    const cardUrlSet = new Set(cardUrls.map((url) => url.toLowerCase().replace(/\?.*$/, '').replace(/\/$/, '')));
    const repoKeys = cardRepoKeys(card);
    let reason: HermesAtlasMatch['reason'] | '' = '';
    let score = 0;
    if ([...cardUrlSet].some((url) => urlSet.has(url))) { reason = card.sourceUrl && urlSet.has(card.sourceUrl.toLowerCase().replace(/\?.*$/, '').replace(/\/$/, '')) ? 'atlas_project_url' : 'canonical_url'; score = 100; }
    if (!reason && [...repoKeys].some((key) => urlKeys.has(key))) { reason = 'canonical_url'; score = 92; }
    if (!reason) {
      const repoHit = [...repoKeys].find((key) => key.length >= 5 && new RegExp(`(^|[^a-z0-9_-])${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9_-]|$)`, 'i').test(textNorm));
      if (repoHit) { reason = 'repo_name'; score = 84; }
    }
    if (!reason || score < 80) continue;
    const stars = card.metrics?.stars;
    const official = card.metrics?.official;
    const audit = card.metrics?.audit;
    matches.push({
      card,
      reason,
      score,
      sourceUrls: cardUrls,
      dependencyUrls: cardUrls.filter((url) => /github\.com/i.test(url)),
      claims: [
        `Hermes Atlas lists ${card.externalId || card.title} as ${card.category || 'a project'}${typeof stars === 'number' ? ` with ${stars} stars` : ''}.`,
        card.body ? `Hermes Atlas summary: ${card.body.replace(/\s+/g, ' ').slice(0, 260)}` : '',
        `Hermes Atlas metadata: official=${Boolean(official)}, audit=${audit || 'unknown'}, match=${reason}.`,
      ].filter(Boolean),
    });
  }
  return matches.sort((a, b) => b.score - a.score).slice(0, max);
}

export function getHermesAtlasStatus() {
  const latest = readLatestHermesAtlasRun();
  const cards = readLatestHermesAtlasCards(1000);
  const dashboard = getDashboardData();
  const atlasNotes = dashboard.notes.filter((note) => note.source === 'hermes-atlas' || note.sourceChannel === 'hermes-atlas' || note.sourceUrls.some((url) => /hermesatlas\.com/i.test(url)));
  const repos = new Set(cards.map((card) => card.externalId || card.canonicalUrl || card.sourceUrl || card.title).filter(Boolean));
  const summaries = cards.filter((card) => Boolean(card.body)).length;
  return {
    latestAtlasRun: latest?.id || null,
    latestAtlasRunAt: latest?.finishedAt || latest?.startedAt || null,
    atlasCards: cards.length,
    atlasRepos: repos.size,
    atlasSummaries: summaries,
    atlasApplied: Boolean(latest && cards.length),
    source: 'hermes-atlas',
  };
}

function slugKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90) || 'atlas-praxis';
}

function metricNumber(card: HermesAtlasCard, key: string) {
  const value = card.metrics?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function metricBoolean(card: HermesAtlasCard, key: string) {
  return card.metrics?.[key] === true;
}

function metricString(card: HermesAtlasCard, key: string) {
  const value = card.metrics?.[key];
  return typeof value === 'string' ? value : '';
}

function sourceMapPath(runId?: string) {
  return runId ? `.omx/ingestion-runs/${runId}/normalized-cards.json` : '.omx/ingestion-runs/latest-hermes-atlas.json';
}

function praxisStageFor(card: HermesAtlasCard) {
  const stars = metricNumber(card, 'stars');
  const audit = metricString(card, 'audit');
  if (metricBoolean(card, 'official') || stars >= 100) return 'worth_trying' as const;
  if (audit === 'pass' || stars >= 10) return 'verifying' as const;
  return 'verifying' as const;
}

function praxisRiskFor(card: HermesAtlasCard) {
  const text = `${card.title} ${card.body || ''} ${card.urls.join(' ')}`;
  if (/token|credential|wallet|private key|browser control|computer control|install script/i.test(text)) return 'medium';
  return 'low';
}

function primaryUrlFor(card: HermesAtlasCard) {
  return card.canonicalUrl || card.urls.find((url) => /github\.com/i.test(url)) || card.sourceUrl || card.urls[0] || '';
}

function compactSentences(text: string, maxSentences = 2, maxLength = 360) {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, maxSentences).join(' ');
  const chosen = sentences || cleaned;
  return chosen.length > maxLength ? `${chosen.slice(0, maxLength - 1).trim()}…` : chosen;
}

function praxisHypothesisFor(card: HermesAtlasCard, subcategory: string) {
  const overview = compactSentences(card.body || '');
  if (overview.length >= 40) return overview;
  return `${card.title} is a ${subcategory.toLowerCase()} Hermes Atlas project. Verify primary docs/repo before using it as Praxis.`;
}

export type HermesAtlasPraxis = {
  id: string;
  title: string;
  category: 'Hermes Atlas';
  subcategory: string;
  stage: 'worth_trying' | 'verifying';
  status: 'verify' | 'watch';
  owner: 'Hermes';
  overview: string;
  hypothesis: string;
  firstTest: string;
  successSignal: string;
  killCriteria: string;
  executionSteps: string[];
  sourceUrls: string[];
  dependencyUrls: string[];
  sourcePath: string;
  atlasUrl?: string;
  githubUrl?: string;
  externalId?: string;
  author?: string;
  stars: number;
  official: boolean;
  audit: string;
  evidenceStrength: 'medium';
  verificationStatus: 'partially_verified';
};

export type HermesAtlasPraxisMap = {
  source: 'Hermes Atlas';
  runId: string | null;
  sourceMapPath: string;
  totalRepos: number;
  totalSubcategories: number;
  generatedFrom: 'latest-hermes-atlas-normalized-cards';
  praxies: HermesAtlasPraxis[];
  subcategories: Array<{ name: string; count: number; praxies: HermesAtlasPraxis[] }>;
};

export function atlasCardToPraxis(card: HermesAtlasCard): HermesAtlasPraxis {
  const sourceUrls = Array.from(new Set([card.sourceUrl, card.canonicalUrl, ...card.urls].filter((url): url is string => Boolean(url))));
  const dependencyUrls = sourceUrls.filter((url) => /github\.com/i.test(url));
  const externalId = card.externalId || card.title;
  const stars = metricNumber(card, 'stars');
  const official = metricBoolean(card, 'official');
  const audit = metricString(card, 'audit') || 'unknown';
  const primaryUrl = primaryUrlFor(card);
  const subcategory = card.category || 'Uncategorized';
  const overview = praxisHypothesisFor(card, subcategory);
  return {
    id: `hermes-atlas-${slugKey(externalId)}`,
    title: card.title,
    category: 'Hermes Atlas',
    subcategory,
    stage: praxisStageFor(card),
    status: 'verify',
    owner: 'Hermes',
    overview,
    hypothesis: overview,
    firstTest: primaryUrl ? `Open ${primaryUrl}, verify install/docs, and run the smallest safe smoke test.` : 'Find primary repo/docs, then run the smallest safe smoke test.',
    successSignal: 'Agent produces one reproducible command/path plus a learning report with Atlas and primary repo evidence.',
    killCriteria: 'Kill if source repo is unavailable, docs are missing, install path fails, or evidence stays social-only.',
    executionSteps: [
      'Open Hermes Atlas project page.',
      'Open canonical GitHub or primary dependency URL.',
      'Verify README, install path, license/risk, and current maintenance signal.',
      'Run the smallest safe local smoke test if permitted.',
      'Write learning report: tried, learned, failed, next action, source URLs.',
    ],
    sourceUrls,
    dependencyUrls,
    sourcePath: sourceMapPath(card.runId),
    atlasUrl: card.sourceUrl,
    githubUrl: card.canonicalUrl || dependencyUrls[0],
    externalId,
    author: card.author,
    stars,
    official,
    audit,
    evidenceStrength: 'medium',
    verificationStatus: 'partially_verified',
  };
}

export function getHermesAtlasPraxies(limit = 500): HermesAtlasPraxis[] {
  return readLatestHermesAtlasCards(limit)
    .filter((card) => card.canonicalUrl || card.sourceUrl || card.urls.length)
    .map(atlasCardToPraxis)
    .sort((a, b) => a.subcategory.localeCompare(b.subcategory) || b.stars - a.stars || a.title.localeCompare(b.title));
}

export function getHermesAtlasPraxisMap(limit = 500): HermesAtlasPraxisMap {
  const latest = readLatestHermesAtlasRun();
  const praxies = getHermesAtlasPraxies(limit);
  const groups = new Map<string, HermesAtlasPraxis[]>();
  for (const praxis of praxies) {
    const existing = groups.get(praxis.subcategory) || [];
    existing.push(praxis);
    groups.set(praxis.subcategory, existing);
  }
  const subcategories = Array.from(groups.entries())
    .map(([name, items]) => ({ name, count: items.length, praxies: items.sort((a, b) => b.stars - a.stars || a.title.localeCompare(b.title)) }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return {
    source: 'Hermes Atlas',
    runId: latest?.id || null,
    sourceMapPath: sourceMapPath(latest?.id),
    totalRepos: praxies.length,
    totalSubcategories: subcategories.length,
    generatedFrom: 'latest-hermes-atlas-normalized-cards',
    praxies,
    subcategories,
  };
}

export function writeHermesAtlasPraxisMapArtifact(root = process.cwd()) {
  const map = getHermesAtlasPraxisMap();
  const rel = path.join('research-vault', 'ops', 'hermes-atlas-praxis-map.json');
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(map, null, 2)}\n`);
  return { path: rel, map };
}
