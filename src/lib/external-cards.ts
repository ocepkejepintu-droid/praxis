import fs from 'node:fs';
import path from 'node:path';
import {
  ensureIngestionDirs,
  getIngestionRunDir,
  slugifyFileName,
  validateCard,
  writeCards,
  writeRunStatus,
  type IngestionCard,
  type IngestionRunStatus,
} from './ingestion.ts';

export type ExternalCardInput = {
  externalId?: unknown;
  title?: unknown;
  body?: unknown;
  summary?: unknown;
  description?: unknown;
  author?: unknown;
  category?: unknown;
  sourceUrl?: unknown;
  canonicalUrl?: unknown;
  urls?: unknown;
  metrics?: unknown;
  publishedAt?: unknown;
  tags?: unknown;
  raw?: unknown;
};

export type ExternalCardsPayload = {
  mode?: unknown;
  source?: unknown;
  sourceUrl?: unknown;
  cards?: unknown;
  options?: {
    dedupe?: unknown;
    writeMarkdown?: unknown;
    judge?: unknown;
    preserveLatest?: unknown;
    sinceDays?: unknown;
  };
  meta?: unknown;
};

type NormalizedExternalCard = {
  externalId?: string;
  title: string;
  body: string;
  author?: string;
  category: string;
  sourceUrl: string;
  canonicalUrl?: string;
  urls: string[];
  metrics?: Record<string, unknown>;
  publishedAt?: string;
  tags: string[];
  raw?: unknown;
  fingerprint: string;
};

export function hasExternalCards(body: unknown): body is ExternalCardsPayload {
  return Boolean(body && typeof body === 'object' && Array.isArray((body as { cards?: unknown }).cards));
}

function cleanString(value: unknown, max = 2000) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function cleanUrl(value: unknown) {
  const raw = cleanString(value, 1000);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    url.hash = '';
    return url.href;
  } catch {
    return '';
  }
}

function cleanStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .map(cleanUrl)
    .filter(Boolean)
    .filter((url) => {
      const key = url.replace(/\?.*$/, '').replace(/\/$/, '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20);
}

function cleanTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((tag) => cleanString(tag, 60)).filter(Boolean).slice(0, 12);
}

function cleanMetrics(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const metrics: Record<string, unknown> = {};
  for (const [key, metric] of Object.entries(value as Record<string, unknown>).slice(0, 20)) {
    if (!/^[A-Za-z0-9_.-]+$/.test(key)) continue;
    if (typeof metric === 'number' && Number.isFinite(metric)) metrics[key] = metric;
    else if (typeof metric === 'boolean') metrics[key] = metric;
    else if (typeof metric === 'string') metrics[key] = cleanString(metric, 240);
  }
  return Object.keys(metrics).length ? metrics : undefined;
}

function normalizeUrlKey(url: string) {
  return url.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\?.*$/, '').replace(/\/$/, '');
}

function textFingerprint(title: string, body: string) {
  return `${title} ${body}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 220);
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function normalizeOne(card: ExternalCardInput, source: string): { card?: NormalizedExternalCard; error?: string } {
  const title = cleanString(card.title, 240);
  const body = cleanString(card.body, 6000) || cleanString(card.summary, 6000) || cleanString(card.description, 6000);
  const sourceUrl = cleanUrl(card.sourceUrl);
  const canonicalUrl = cleanUrl(card.canonicalUrl);
  if (!title) return { error: 'missing title' };
  if (!body) return { error: `${title}: missing body/summary/description` };
  if (!sourceUrl && !canonicalUrl) return { error: `${title}: missing sourceUrl/canonicalUrl` };
  const urls = [sourceUrl, canonicalUrl, ...cleanStringArray(card.urls)].filter(Boolean);
  const uniqueUrls = Array.from(new Map(urls.map((url) => [normalizeUrlKey(url), url])).values());
  const externalId = cleanString(card.externalId, 400) || undefined;
  const fingerprint = externalId
    ? `${source}:external:${externalId.toLowerCase()}`
    : canonicalUrl
      ? `canonical:${normalizeUrlKey(canonicalUrl)}`
      : sourceUrl
        ? `source:${normalizeUrlKey(sourceUrl)}`
        : `text:${textFingerprint(title, body)}`;
  return {
    card: {
      externalId,
      title,
      body,
      author: cleanString(card.author, 160) || undefined,
      category: cleanString(card.category, 120) || 'external',
      sourceUrl: sourceUrl || canonicalUrl,
      canonicalUrl: canonicalUrl || undefined,
      urls: uniqueUrls,
      metrics: cleanMetrics(card.metrics),
      publishedAt: cleanString(card.publishedAt, 80) || undefined,
      tags: cleanTags(card.tags),
      raw: card.raw,
      fingerprint,
    },
  };
}

export function normalizeExternalCards(payload: ExternalCardsPayload) {
  const source = cleanString(payload.source, 120) || 'external';
  const inputCards = Array.isArray(payload.cards) ? payload.cards as ExternalCardInput[] : [];
  const shouldDedupe = payload.options?.dedupe !== false;
  const seen = new Set<string>();
  const normalized: NormalizedExternalCard[] = [];
  const errors: string[] = [];
  let duplicates = 0;
  for (const input of inputCards) {
    const { card, error } = normalizeOne(input, source);
    if (error) {
      errors.push(error);
      continue;
    }
    if (!card) continue;
    if (shouldDedupe && seen.has(card.fingerprint)) {
      duplicates += 1;
      continue;
    }
    if (shouldDedupe) seen.add(card.fingerprint);
    normalized.push(card);
  }
  return { source, cardsReceived: inputCards.length, cards: normalized, duplicates, rejectedCount: errors.length, errors };
}

function inferCardType(card: NormalizedExternalCard): Pick<IngestionCard, 'type' | 'status' | 'risk' | 'targetDir' | 'strategicRelevance' | 'actionability' | 'confidence'> {
  const text = `${card.title} ${card.body} ${card.urls.join(' ')}`;
  const hasRepo = /github\.com\/[^/]+\/[^/?#]+/i.test(text);
  const risk = /token|private key|credential|wallet|crypto|install script/i.test(text) ? 'high' : hasRepo ? 'medium' : 'low';
  if (hasRepo) return { type: 'repo', status: 'verify', risk, targetDir: 'Repos', strategicRelevance: 4, actionability: 4, confidence: 'medium' };
  return { type: 'capture', status: 'watch', risk, targetDir: 'Inbox', strategicRelevance: 3, actionability: 3, confidence: 'medium' };
}

function metricLines(metrics?: Record<string, unknown>) {
  if (!metrics) return '- none';
  const lines = Object.entries(metrics).map(([key, value]) => `- ${key}: ${String(value)}`);
  return lines.length ? lines.join('\n') : '- none';
}

function externalCardBody(card: NormalizedExternalCard, source: string) {
  const links = Array.from(new Set([card.sourceUrl, card.canonicalUrl, ...card.urls].filter(Boolean))).map((url) => `- ${url}`).join('\n');
  return `Source: ${source}\nCategory: ${card.category}\nAuthor: ${card.author || 'unknown'}\n\n${card.body}\n\n## Links\n${links || '- pending'}\n\n## Metrics\n${metricLines(card.metrics)}`;
}

function toIngestionCard(card: NormalizedExternalCard, source: string, runId: string, ingestedAt: string): IngestionCard {
  const inferred = inferCardType(card);
  return {
    ...inferred,
    category: card.category,
    title: card.title,
    body: externalCardBody(card, source),
    sourceUrls: Array.from(new Set([card.sourceUrl, card.canonicalUrl, ...card.urls].filter((url): url is string => Boolean(url)))),
    ingestionRunId: runId,
    ingestedAt,
    sourceChannel: source,
    sourceStatusUrl: card.sourceUrl,
    statusIdentityStatus: 'unresolved',
    enrichmentStatus: 'pending',
    replyFetchStatus: 'pending',
    fileSlug: `${slugifyFileName(card.title)}-${stableHash(card.fingerprint)}`,
    external: {
      source,
      externalId: card.externalId,
      sourceUrl: card.sourceUrl,
      canonicalUrl: card.canonicalUrl,
      category: card.category,
      author: card.author,
      publishedAt: card.publishedAt,
      urls: card.urls,
      metrics: card.metrics,
      ingestionMode: 'external-cards',
    },
  };
}

function runIdFromDate(date: Date, source: string) {
  const stamp = date.toISOString().replace(/[:.]/g, '-').slice(0, 23);
  return `${stamp}-${slugifyFileName(source).slice(0, 32)}-external`;
}

export function ingestExternalCards(payload: ExternalCardsPayload, options: { root?: string; now?: Date } = {}) {
  const root = options.root || process.cwd();
  const started = options.now || new Date();
  const runId = runIdFromDate(started, cleanString(payload.source, 120) || 'external');
  const date = started.toISOString().slice(0, 10);
  const ingestedAt = started.toISOString();
  const { source, cardsReceived, cards, duplicates, rejectedCount, errors } = normalizeExternalCards(payload);
  const meta = payload.meta && typeof payload.meta === 'object' && !Array.isArray(payload.meta) ? payload.meta as Record<string, unknown> : {};
  const isHermesAtlas = source === 'hermes-atlas';
  const writeMarkdown = payload.options?.writeMarkdown !== false;
  ensureIngestionDirs(root);
  const runDir = path.join(getIngestionRunDir(root), runId);
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, 'raw-cards.json'), JSON.stringify({ source, sourceUrl: cleanUrl(payload.sourceUrl), cards: payload.cards || [] }, null, 2));
  fs.writeFileSync(path.join(runDir, 'normalized-cards.json'), JSON.stringify(cards, null, 2));
  const ingestionCards = cards.map((card) => toIngestionCard(card, source, runId, ingestedAt));
  const verificationGaps = [...errors, ...ingestionCards.flatMap(validateCard)];
  const files = writeMarkdown ? writeCards(ingestionCards, { root, runId, date, ingestedAt, sourceChannel: source }) : [];
  const status: IngestionRunStatus = {
    id: runId,
    mode: 'external-cards',
    status: verificationGaps.length ? 'partial' : 'ok',
    source,
    stage: 'discover',
    startedAt: started.toISOString(),
    finishedAt: new Date().toISOString(),
    health: { running: true, extension_connected: true, baseUrl: cleanUrl(payload.sourceUrl) || undefined },
    cardsCreated: files.length,
    rejectedCount,
    verificationGaps,
    files,
    message: `External card ingestion received ${cardsReceived}, created ${files.length}, deduped ${duplicates}.`,
    progress: {
      rawSignals: cardsReceived,
      cardsWritten: files.length,
      statusIds: 0,
      xSearchEnriched: 0,
      ...(isHermesAtlas ? {
        atlasCards: files.length,
        atlasRepos: Number(meta.repos) || cards.length,
        atlasSummaries: Number(meta.summaries) || cards.filter((card) => card.body).length,
      } : {}),
    },
    sidecars: {
      pending: 0,
      xSearchOk: 0,
      replyFetchOk: 0,
      replyFetchFailed: 0,
    },
    command: {
      maxCards: cardsReceived,
      source,
      dedupe: payload.options?.dedupe !== false,
      writeMarkdown,
      judge: Boolean(payload.options?.judge),
      sinceDays: Number(payload.options?.sinceDays) || undefined,
      preserveLatest: isHermesAtlas ? payload.options?.preserveLatest !== false : undefined,
    },
    paths: {
      rawSignals: path.relative(root, path.join(runDir, 'raw-cards.json')),
      merged: path.relative(root, path.join(runDir, 'normalized-cards.json')),
      cards: files,
    },
    errors: verificationGaps,
    agent_ready: files.length > 0,
    atlas: isHermesAtlas ? {
      sourceUrl: cleanUrl(payload.sourceUrl) || undefined,
      rssItems: Number(meta.rssItems) || undefined,
      repos: Number(meta.repos) || undefined,
      summaries: Number(meta.summaries) || undefined,
      llmsFullBytes: Number(meta.llmsFullBytes) || undefined,
      latestAtlasRun: runId,
    } : undefined,
  };
  const preserveLatest = isHermesAtlas && payload.options?.preserveLatest !== false;
  const statusPath = writeRunStatus(status, root, { updateLatest: !preserveLatest });
  if (isHermesAtlas) fs.writeFileSync(path.join(getIngestionRunDir(root), 'latest-hermes-atlas.json'), JSON.stringify(status, null, 2));
  return {
    ok: true,
    run: {
      id: runId,
      source,
      mode: 'external-cards' as const,
      cardsReceived,
      cardsCreated: files.length,
      duplicates,
      rejected: rejectedCount,
      files,
      statusPath: path.relative(root, statusPath),
      paths: status.paths,
      atlas: status.atlas,
    },
  };
}
