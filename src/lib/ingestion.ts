import fs from 'node:fs';
import path from 'node:path';

export type KimiHealth = {
  running: boolean;
  extension_connected: boolean;
  extension_version?: string;
  version?: string;
  port?: number;
  error?: string;
  bin?: string;
  baseUrl?: string;
};

export type IngestionCardType = 'capture' | 'repo' | 'use_case' | 'scorio_idea' | 'experiment';
export type IngestionCardStatus = 'inbox' | 'verify' | 'test' | 'watch' | 'ignore';

export type IngestionCard = {
  type: IngestionCardType;
  status: IngestionCardStatus;
  category: string;
  risk: 'low' | 'medium' | 'high';
  title: string;
  body: string;
  sourceUrls: string[];
  strategicRelevance: number;
  actionability: number;
  confidence: 'low' | 'medium' | 'high';
  targetDir: string;
  ingestionRunId?: string;
  ingestedAt?: string;
  sourceChannel?: 'x_home' | 'x_search' | 'dry_run' | string;
  sourceStatusUrl?: string;
  statusId?: string;
  statusIdentityStatus?: 'ok' | 'missing_dom_status_url' | 'external_ad' | 'unresolved';
  homeFeedRank?: number;
  enrichmentStatus?: 'pending' | 'partial' | 'complete';
  replyFetchStatus?: 'pending' | 'ok' | 'failed';
  fileSlug?: string;
  external?: {
    source?: string;
    externalId?: string;
    sourceUrl?: string;
    canonicalUrl?: string;
    category?: string;
    author?: string;
    publishedAt?: string;
    urls?: string[];
    metrics?: Record<string, unknown>;
    ingestionMode?: 'external-cards';
  };
};

export type IngestionCrawlStats = {
  searchUrl?: string;
  maxScrolls?: number;
  scrollsCompleted?: number;
  signalsExtracted?: number;
  uniquePosts?: number;
  durationMs?: number;
};

export type IngestionRunStatus = {
  id: string;
  mode: 'dry-run' | 'live' | 'external-cards';
  status: 'running' | 'ok' | 'partial' | 'blocked' | 'failed';
  source?: 'home' | 'search' | string;
  stage?: 'discover' | 'prepare_enrichment' | 'fetch_replies' | 'x_search_enrich' | 'merge' | 'judge';
  startedAt: string;
  finishedAt: string;
  health: KimiHealth;
  cardsCreated: number;
  rejectedCount: number;
  verificationGaps: string[];
  files: string[];
  message: string;
  crawlStats?: IngestionCrawlStats;
  progress?: {
    roundsCompleted?: number;
    scrollsCompleted?: number;
    rawSignals?: number;
    cardsWritten?: number;
    statusIds?: number;
    replyFetched?: number;
    xSearchEnriched?: number;
    merged?: number;
    judged?: number;
    atlasCards?: number;
    atlasRepos?: number;
    atlasSummaries?: number;
  };
  sidecars?: {
    pending: number;
    xSearchOk: number;
    replyFetchOk: number;
    replyFetchFailed: number;
  };
  command?: {
    maxCards?: number;
    rounds?: number;
    scrollsPerRound?: number;
    pauseMs?: number;
    maxScrolls?: number;
    minDurationMinutes?: number;
    source?: string;
    query?: string;
    dedupe?: boolean;
    writeMarkdown?: boolean;
    judge?: boolean;
    sinceDays?: number;
    preserveLatest?: boolean;
  };
  paths?: {
    rawSignals?: string;
    statusIds?: string;
    enrichedDir?: string;
    replyFetchDir?: string;
    merged?: string;
    cards?: string[];
  };
  errors?: string[];
  agent_ready?: boolean;
  atlas?: {
    sourceUrl?: string;
    rssItems?: number;
    repos?: number;
    summaries?: number;
    llmsFullBytes?: number;
    latestAtlasRun?: string;
  };
};

export type XSignal = {
  id?: string;
  capturedAt?: string;
  text: string;
  author?: string;
  urls: string[];
};

export function getIngestionRunDir(root = /* turbopackIgnore: true*/ process.cwd()) {
  return path.join(root, '.omx', 'ingestion-runs');
}

export function getLatestRunPath(root = /* turbopackIgnore: true*/ process.cwd()) {
  return path.join(getIngestionRunDir(root), 'latest.json');
}

export const INGESTION_RUN_DIR = getIngestionRunDir();
export const LATEST_RUN_PATH = getLatestRunPath();

const TARGET_DIRS: Record<IngestionCardType, string> = {
  capture: 'Inbox',
  repo: 'Repos',
  use_case: 'Use Cases',
  scorio_idea: 'Scorio Ideas',
  experiment: 'Experiments',
};

export function readLatestIngestionRun(root = /* turbopackIgnore: true*/ process.cwd()): IngestionRunStatus | null {
  try {
    return JSON.parse(fs.readFileSync(getLatestRunPath(root), 'utf8')) as IngestionRunStatus;
  } catch {
    return null;
  }
}

export function ensureIngestionDirs(root = /* turbopackIgnore: true*/ process.cwd()) {
  for (const dir of Object.values(TARGET_DIRS)) fs.mkdirSync(path.join(root, dir), { recursive: true });
  fs.mkdirSync(getIngestionRunDir(root), { recursive: true });
}

export function slugifyFileName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'card';
}

function yamlEscape(value: string | number) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
}

function yamlString(key: string, value?: string | number) {
  if (value === undefined || value === null || value === '') return '';
  return `${key}: ${yamlEscape(value)}\n`;
}

function yamlQuotedString(key: string, value?: string | number) {
  if (value === undefined || value === null || value === '') return '';
  return `${key}: "${yamlEscape(value)}"\n`;
}

function yamlNullableString(key: string, value?: string | number | null) {
  if (value === undefined || value === null || value === '') return `${key}: null\n`;
  return yamlQuotedString(key, value);
}

function yamlList(key: string, values: string[]) {
  const clean = values.map((value) => value.trim()).filter(Boolean).slice(0, 20);
  if (!clean.length) return '';
  return `${key}:\n${clean.map((value) => `  - "${yamlEscape(value)}"`).join('\n')}\n`;
}

function yamlMetrics(metrics?: Record<string, unknown>) {
  if (!metrics || !Object.keys(metrics).length) return '';
  const lines = Object.entries(metrics)
    .filter(([key]) => /^[A-Za-z0-9_.-]+$/.test(key))
    .slice(0, 20)
    .map(([key, value]) => {
      if (typeof value === 'number' && Number.isFinite(value)) return `  ${key}: ${value}`;
      if (typeof value === 'boolean') return `  ${key}: ${value}`;
      return `  ${key}: "${yamlEscape(String(value)).slice(0, 240)}"`;
    });
  return lines.length ? `metrics:\n${lines.join('\n')}\n` : '';
}

export function cardToMarkdown(card: IngestionCard, date: string) {
  const urls = card.sourceUrls.length ? card.sourceUrls.map((url) => `  - ${url}`).join('\n') : '  - pending';
  const external = card.external;
  const externalFields = external ? [
    yamlString('source', external.source),
    yamlQuotedString('externalId', external.externalId),
    yamlQuotedString('sourceUrl', external.sourceUrl),
    yamlQuotedString('canonicalUrl', external.canonicalUrl),
    yamlQuotedString('author', external.author),
    yamlQuotedString('publishedAt', external.publishedAt),
    yamlString('ingestionMode', external.ingestionMode || 'external-cards'),
    yamlList('urls', external.urls || []),
    yamlMetrics(external.metrics),
  ].join('') : '';
  const identityStatus = card.statusIdentityStatus || (card.sourceStatusUrl && card.statusId ? 'ok' : 'missing_dom_status_url');
  const runFields = [
    yamlString('ingestion_run_id', card.ingestionRunId),
    yamlString('run_id', card.ingestionRunId),
    yamlString('ingested_at', card.ingestedAt),
    yamlString('source_channel', card.sourceChannel),
    yamlNullableString('source_status_url', card.sourceStatusUrl),
    yamlNullableString('status_id', card.statusId),
    yamlString('status_identity_status', identityStatus),
    yamlString('home_feed_rank', card.homeFeedRank),
    yamlString('enrichment_status', card.enrichmentStatus),
    yamlString('reply_fetch_status', card.replyFetchStatus),
  ].join('');
  return `---\ntype: ${card.type}\nstatus: ${card.status}\n${yamlQuotedString('category', card.category)}risk: ${card.risk}\nstrategic_relevance: ${card.strategicRelevance}\nactionability: ${card.actionability}\nconfidence: ${card.confidence}\n${runFields}${externalFields}source_urls:\n${urls}\nlast_checked: ${date}\n---\n\n# ${card.title}\n\n${card.body.trim()}\n`;
}

export function validateCard(card: IngestionCard) {
  const gaps: string[] = [];
  if (!card.title.trim()) gaps.push('missing title');
  if (!card.sourceUrls.length) gaps.push(`${card.title}: missing source URL`);
  if (card.type === 'experiment') {
    for (const heading of ['## Hypothesis', '## First test', '## Success signal', '## Kill criteria']) {
      if (!card.body.includes(heading)) gaps.push(`${card.title}: missing ${heading.replace('## ', '')}`);
    }
  }
  return gaps;
}

export function writeCards(cards: IngestionCard[], options: { root?: string; dryRun?: boolean; runId: string; date: string; ingestedAt?: string; sourceChannel?: string }) {
  const root = options.root || /* turbopackIgnore: true*/ process.cwd();
  const base = options.dryRun ? path.join(getIngestionRunDir(root), options.runId, 'preview') : root;
  const files: string[] = [];
  for (const card of cards) {
    const hydratedCard: IngestionCard = {
      ...card,
      ingestionRunId: card.ingestionRunId || options.runId,
      ingestedAt: card.ingestedAt || options.ingestedAt || new Date().toISOString(),
      sourceChannel: card.sourceChannel || options.sourceChannel || (options.dryRun ? 'dry_run' : undefined),
      statusIdentityStatus: card.statusIdentityStatus || (card.sourceStatusUrl && card.statusId ? 'ok' : 'missing_dom_status_url'),
      enrichmentStatus: card.enrichmentStatus || 'pending',
      replyFetchStatus: card.replyFetchStatus || 'pending',
    };
    const targetDir = path.join(base, card.targetDir || TARGET_DIRS[card.type]);
    fs.mkdirSync(targetDir, { recursive: true });
    const fileName = `${options.date} ${slugifyFileName(card.fileSlug || card.title)}.md`;
    const fullPath = path.join(targetDir, fileName);
    fs.writeFileSync(fullPath, cardToMarkdown(hydratedCard, options.date));
    files.push(path.relative(root, fullPath));
  }
  return files;
}

export function writeRunStatus(status: IngestionRunStatus, root = /* turbopackIgnore: true*/ process.cwd(), options: { updateLatest?: boolean } = {}) {
  const runDir = getIngestionRunDir(root);
  fs.mkdirSync(runDir, { recursive: true });
  const runPath = path.join(runDir, `${status.id}.json`);
  fs.writeFileSync(runPath, JSON.stringify(status, null, 2));
  if (options.updateLatest !== false) fs.writeFileSync(getLatestRunPath(root), JSON.stringify(status, null, 2));
  return runPath;
}

function uniqueUrls(urls: string[]) {
  const seen = new Set<string>();
  return urls
    .map((url) => url.trim())
    .filter((url) => /^https?:\/\//i.test(url))
    .filter((url) => {
      const normalized = url.replace(/\?.*$/, '').replace(/\/$/, '');
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .slice(0, 8);
}

function summarizeText(text: string, max = 180) {
  return text.replace(/\s+/g, ' ').trim().slice(0, max).replace(/\s+\S*$/, '');
}

function isFeatureUpdate(signal: XSignal) {
  const joined = `${signal.text} ${signal.urls.join(' ')}`;
  return /\b(new|now supports|launch(?:ed|ing)?|released?|update[sd]?|version|v\d+(?:\.\d+)+|changelog|preview|beta|roll(?:ed|ing) out|ships?|dropped|available)\b/i.test(joined);
}

function classifySignal(signal: XSignal): Pick<IngestionCard, 'type' | 'status' | 'category' | 'risk' | 'targetDir' | 'strategicRelevance' | 'actionability'> {
  const joined = `${signal.text} ${signal.urls.join(' ')}`;
  const hasGithub = /github\.com/i.test(joined);
  const scorio = /scorio|tournament|padel|sports|bracket|score/i.test(joined);
  const mcpCli = /mcp|cli|sdk|api/i.test(joined);
  const browser = /browser|chrome|webbridge|computer use|agent.*browser/i.test(joined);
  const runtime = /sandbox|runtime|vm|worker|container/i.test(joined);
  const risky = /token|wallet|crypto|private key|credential|free unlimited|install script/i.test(joined);
  if (scorio) return { type: 'scorio_idea', status: 'test', category: 'scorio', risk: 'low', targetDir: TARGET_DIRS.scorio_idea, strategicRelevance: 5, actionability: 5 };
  if (hasGithub) return { type: 'repo', status: 'verify', category: mcpCli ? 'mcp-cli' : 'coding-agent', risk: risky ? 'high' : 'medium', targetDir: TARGET_DIRS.repo, strategicRelevance: 4, actionability: 4 };
  if (isFeatureUpdate(signal)) return { type: 'capture', status: 'watch', category: 'new-feature-update', risk: risky ? 'high' : 'medium', targetDir: TARGET_DIRS.capture, strategicRelevance: 4, actionability: 3 };
  if (browser) return { type: 'use_case', status: 'test', category: 'browser-agent', risk: 'medium', targetDir: TARGET_DIRS.use_case, strategicRelevance: 4, actionability: 4 };
  if (runtime) return { type: 'use_case', status: 'verify', category: 'agent-runtime', risk: 'medium', targetDir: TARGET_DIRS.use_case, strategicRelevance: 3, actionability: 3 };
  return { type: 'capture', status: 'inbox', category: mcpCli ? 'mcp-cli' : 'coding-agent', risk: risky ? 'high' : 'medium', targetDir: TARGET_DIRS.capture, strategicRelevance: 3, actionability: 3 };
}

function titleFromSignal(signal: XSignal, index: number) {
  const github = signal.urls.find((url) => /github\.com\/[^/]+\/[^/?#]+/i.test(url));
  if (github) {
    const match = github.match(/github\.com\/([^/?#]+\/[^/?#]+)/i);
    if (match) return `Repo lead: ${match[1].replace(/\.git$/i, '')}`;
  }
  const cleaned = summarizeText(signal.text, 82).replace(/^(@\w+\s*)+/, '').trim();
  return cleaned ? `X signal: ${cleaned}` : `X signal ${index + 1}`;
}

function xStatusFromSignal(signal: XSignal) {
  const joined = [signal.id, ...signal.urls].filter(Boolean).join(' ');
  const match = joined.match(/https?:\/\/(?:x|twitter)\.com\/([^\/\s]+)\/status\/(\d+)/i);
  if (!match) {
    const isExternalAd = /\b(ad|sponsored|promoted)\b/i.test(`${signal.author || ''} ${signal.text}`);
    return { statusIdentityStatus: isExternalAd ? 'external_ad' as const : 'missing_dom_status_url' as const };
  }
  return {
    statusId: match[2],
    sourceStatusUrl: `https://x.com/${match[1]}/status/${match[2]}`,
    statusIdentityStatus: 'ok' as const,
  };
}

export function createCardsFromXSignals(signals: XSignal[], searchUrl: string, maxCards = 40): IngestionCard[] {
  const cards: IngestionCard[] = [];
  const seenBodies = new Set<string>();
  for (const [index, signal] of signals.entries()) {
    const text = signal.text.replace(/\s+/g, ' ').trim();
    if (text.length < 40) continue;
    const fingerprint = text.toLowerCase().slice(0, 160);
    if (seenBodies.has(fingerprint)) continue;
    seenBodies.add(fingerprint);
    const urls = uniqueUrls(signal.urls.length ? signal.urls : [searchUrl]);
    const classification = classifySignal({ ...signal, urls });
    const source = signal.author ? `X author/context: ${signal.author}` : 'X search result';
    const featureUpdateSection = isFeatureUpdate({ ...signal, urls })
      ? `\n\n## New feature / update / new version\n${summarizeText(text, 320)}`
      : '';
    cards.push({
      ...classification,
      ...xStatusFromSignal(signal),
      title: titleFromSignal({ ...signal, urls }, index),
      confidence: urls.some((url) => !/x\.com|twitter\.com|t\.co/i.test(url)) ? 'medium' : 'low',
      sourceUrls: urls,
      homeFeedRank: index + 1,
      body: `${source}\n\n## Signal\n${text}${featureUpdateSection}\n\n## Why it matters\n${summarizeText(text, 260)}\n\n## Next actions\n- Resolve primary source links and verify claims before adopting.\n- Promote to an experiment only if the first test is under one day.`,
    });
    if (cards.length >= maxCards) break;
  }
  if (cards.length) return cards;
  return [{
    type: 'capture',
    status: 'inbox',
    category: 'coding-agent',
    risk: 'medium',
    title: 'Live X crawl: no clean cards extracted',
    sourceUrls: [searchUrl],
    strategicRelevance: 2,
    actionability: 1,
    confidence: 'low',
    targetDir: TARGET_DIRS.capture,
    body: 'Kimi WebBridge reached X, but the visible page did not expose enough clean post/link text to promote cards.\n\n## Next actions\n- Confirm X is logged in.\n- Re-run the crawl after search results load.\n- If this repeats, adjust selectors in scripts/ingest-x.ts.',
  }];
}

export function createDryRunCards(): IngestionCard[] {
  return [
    {
      type: 'capture',
      status: 'inbox',
      category: 'coding-agent',
      risk: 'medium',
      title: 'X shortlist: agent tooling links',
      sourceUrls: ['https://x.com/search?q=ai%20agent%20mcp%20github'],
      strategicRelevance: 4,
      actionability: 3,
      confidence: 'low',
      targetDir: TARGET_DIRS.capture,
      body: `Dry-run preview card. Replace with Kimi WebBridge snapshot text when extension is connected.\n\n## Next actions\n- Resolve source links from the live crawl.\n- Promote only cards with primary source URLs.`,
    },
    {
      type: 'experiment',
      status: 'test',
      category: 'scorio',
      risk: 'low',
      title: 'Kimi WebBridge X ingestion quality test',
      sourceUrls: ['https://x.com/search?q=ai%20agent%20browser%20automation'],
      strategicRelevance: 5,
      actionability: 5,
      confidence: 'medium',
      targetDir: TARGET_DIRS.experiment,
      body: `## Hypothesis\nIf X capture writes structured cards instead of one long note, Agent Radar produces more usable experiments with less review time.\n\n## First test\nRun one 24h Kimi WebBridge crawl and keep only ten cards.\n\n## Success signal\nAt least three cards become concrete actions or experiments and no card lacks a source URL.\n\n## Kill criteria\nStop if the crawl repeatedly returns duplicates, engagement bait, or unresolved links.\n\n## Next actions\n- Run the live crawl after reconnecting the Kimi WebBridge extension.\n- Compare the output with the current long markdown capture.`,
    },
  ];
}
