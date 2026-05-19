import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createCardsFromXSignals,
  createDryRunCards,
  getLatestRunPath,
  readLatestIngestionRun,
  validateCard,
  writeCards,
  writeRunStatus,
  type IngestionRunStatus,
} from '../src/lib/ingestion.ts';
import { hasExternalCards, ingestExternalCards, normalizeExternalCards } from '../src/lib/external-cards.ts';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-radar-ingestion-'));
const cards = createDryRunCards();
const gaps = cards.flatMap(validateCard);
assert(gaps.length === 0, `dry-run cards should validate, got ${gaps.join('; ')}`);

const files = writeCards(cards, { root, dryRun: true, runId: 'test-run', date: '2026-05-14' });
assert(files.length === 2, `expected 2 dry-run preview files, got ${files.length}`);
assert(files.every((file) => file.startsWith('.omx/ingestion-runs/test-run/preview/')), 'dry-run files should stay under .omx preview');
assert(files.some((file) => file.includes('/Inbox/')), 'dry-run should include Inbox preview card');
assert(files.some((file) => file.includes('/Experiments/')), 'dry-run should include Experiments preview card');


const liveCards = createCardsFromXSignals([
  {
    text: 'New coding agent repository for MCP workflows with browser automation, eval harnesses, and practical examples worth verifying for Agent Radar.',
    author: '@agentbuilder',
    urls: ['https://github.com/example/agent-radar-kit', 'https://x.com/agentbuilder/status/123'],
  },
  {
    text: 'Scorio style tournament operator idea: use browser agents to seed brackets, check scores, and draft sponsor recaps from live match data.',
    author: '@sportsops',
    urls: ['https://x.com/sportsops/status/456'],
  },
  {
    text: 'Aditi shared a real agent workflow with a long X status ID that must never be rounded by JavaScript number precision.',
    author: '@aditiitwt',
    urls: ['https://x.com/aditiitwt/status/2055704951062700434'],
  },
], 'https://x.com/search?q=ai%20agent');
assert(liveCards.length === 3, `expected 3 live cards, got ${liveCards.length}`);
assert(liveCards[0].type === 'repo', 'github signal should become a repo card');
assert(liveCards[1].type === 'scorio_idea', 'sports/tournament signal should become a Scorio idea card');
const liveFiles = writeCards(liveCards, { root, dryRun: false, runId: 'live-run', date: '2026-05-14' });
assert(liveFiles.some((file) => file.startsWith('Repos/')), 'live github card should write into Repos/');
assert(liveFiles.some((file) => file.startsWith('Scorio Ideas/')), 'live Scorio card should write into Scorio Ideas/');
const unsafeStatusFile = liveFiles.map((file) => path.join(root, file)).find((file) => fs.readFileSync(file, 'utf8').includes('2055704951062700434'));
assert(unsafeStatusFile, 'unsafe status ID card should be written');
const unsafeStatusMarkdown = fs.readFileSync(String(unsafeStatusFile), 'utf8');
assert(unsafeStatusMarkdown.includes('status_id: "2055704951062700434"'), 'unsafe status ID should be quoted in YAML');
assert(unsafeStatusMarkdown.includes('source_status_url: "https://x.com/aditiitwt/status/2055704951062700434"'), 'source status URL should be quoted in YAML');



assert(!hasExternalCards({ mode: 'live', source: 'home', maxScrolls: 80, maxCards: 120, minDurationMinutes: 60 }), 'X ingest payload should not trigger external cards mode');
assert(hasExternalCards({ mode: 'external', source: 'fixture', cards: [] }), 'cards[] payload should trigger external cards mode');

const externalPayload = {
  mode: 'external',
  source: 'hermes-atlas',
  sourceUrl: 'https://hermesatlas.com/',
  cards: [
    {
      externalId: 'jau123/MeiGen-AI-Design-MCP',
      title: 'MeiGen-AI-Design-MCP',
      body: 'MCP server for AI design/image/video generation with external-card ingestion coverage.',
      author: 'jau123',
      category: 'Plugins & Extensions',
      sourceUrl: 'https://hermesatlas.com/projects/jau123/MeiGen-AI-Design-MCP',
      canonicalUrl: 'https://github.com/jau123/MeiGen-AI-Design-MCP',
      urls: ['https://github.com/jau123/MeiGen-AI-Design-MCP'],
      metrics: { stars: 123, official: false },
      publishedAt: '2026-05-16T07:18:51Z',
      raw: { fixture: true },
    },
    {
      externalId: 'jau123/MeiGen-AI-Design-MCP',
      title: 'MeiGen-AI-Design-MCP duplicate',
      body: 'Duplicate should be skipped by source plus external ID.',
      sourceUrl: 'https://hermesatlas.com/projects/jau123/MeiGen-AI-Design-MCP?utm=test',
    },
    {
      title: 'Hermes Agent',
      summary: 'Self-improving agent runtime with memory, skills, and execution backends.',
      author: 'NousResearch',
      category: 'Core & Official',
      sourceUrl: 'https://hermesatlas.com/projects/NousResearch/hermes-agent',
      canonicalUrl: 'https://github.com/NousResearch/hermes-agent',
      metrics: { stars: 83290, official: true },
    },
  ],
  options: { dedupe: true, writeMarkdown: true, judge: false, preserveLatest: true, sinceDays: 30 },
  meta: { rssItems: 2, repos: 2, summaries: 2, llmsFullBytes: 1000 },
};
const normalizedExternal = normalizeExternalCards(externalPayload);
assert(normalizedExternal.cardsReceived === 3, `expected 3 external cards received, got ${normalizedExternal.cardsReceived}`);
assert(normalizedExternal.cards.length === 2, `expected 2 normalized external cards after dedupe, got ${normalizedExternal.cards.length}`);
assert(normalizedExternal.duplicates === 1, `expected 1 duplicate, got ${normalizedExternal.duplicates}`);

const preAtlasStatus: IngestionRunStatus = {
  id: 'latest-x-before-atlas',
  mode: 'live',
  status: 'ok',
  source: 'home',
  startedAt: '2026-05-17T09:00:00.000Z',
  finishedAt: '2026-05-17T09:01:00.000Z',
  health: { running: true, extension_connected: true },
  cardsCreated: 1,
  rejectedCount: 0,
  verificationGaps: [],
  files: [],
  message: 'X latest should survive Atlas enrichment.',
};
writeRunStatus(preAtlasStatus, root);
const externalResult = ingestExternalCards(externalPayload, { root, now: new Date('2026-05-17T10:43:00.303Z') });
assert(externalResult.ok, 'external ingestion should return ok');
assert(externalResult.run.mode === 'external-cards', 'external ingestion should use external-cards mode');
assert(externalResult.run.cardsReceived === 3, 'external run should count received cards');
assert(externalResult.run.cardsCreated === 2, `external run should create 2 markdown files, got ${externalResult.run.cardsCreated}`);
assert(externalResult.run.duplicates === 1, 'external run should report duplicate count');
assert(externalResult.run.files.every((file) => fs.existsSync(path.join(root, file))), 'external markdown files should exist');
const externalMarkdown = fs.readFileSync(path.join(root, externalResult.run.files[0]), 'utf8');
assert(externalMarkdown.includes('ingestionMode: external-cards'), 'external markdown should include ingestionMode frontmatter');
assert(externalMarkdown.includes('externalId: "jau123/MeiGen-AI-Design-MCP"'), 'external markdown should include quoted externalId');
assert(externalMarkdown.includes('sourceUrl: "https://hermesatlas.com/projects/jau123/MeiGen-AI-Design-MCP"'), 'external markdown should include sourceUrl');
assert(externalMarkdown.includes('canonicalUrl: "https://github.com/jau123/MeiGen-AI-Design-MCP"'), 'external markdown should include canonicalUrl');
assert(externalMarkdown.includes('metrics:\n  stars: 123'), 'external markdown should include metrics');
assert(fs.existsSync(path.join(root, '.omx', 'ingestion-runs', externalResult.run.id, 'raw-cards.json')), 'external raw-cards sidecar should exist');
assert(fs.existsSync(path.join(root, '.omx', 'ingestion-runs', externalResult.run.id, 'normalized-cards.json')), 'external normalized-cards sidecar should exist');
assert(readLatestIngestionRun(root)?.id === 'latest-x-before-atlas', 'Hermes Atlas ingestion should preserve latest X run by default');
const latestAtlasPath = path.join(root, '.omx', 'ingestion-runs', 'latest-hermes-atlas.json');
assert(fs.existsSync(latestAtlasPath), 'Hermes Atlas latest pointer should be written');
const latestAtlas = JSON.parse(fs.readFileSync(latestAtlasPath, 'utf8'));
assert(latestAtlas.id === externalResult.run.id, 'latest Hermes Atlas pointer should target Atlas run');
assert(latestAtlas.progress.atlasCards === 2, 'Atlas status should count atlasCards');
assert(latestAtlas.progress.atlasRepos === 2, 'Atlas status should count atlasRepos from meta/fallback');

const status: IngestionRunStatus = {
  id: 'test-run',
  mode: 'dry-run',
  status: 'ok',
  startedAt: '2026-05-14T00:00:00.000Z',
  finishedAt: '2026-05-14T00:00:01.000Z',
  health: { running: true, extension_connected: false, bin: '/tmp/kimi-webbridge', baseUrl: 'http://127.0.0.1:10086' },
  cardsCreated: files.length,
  rejectedCount: 1,
  verificationGaps: [],
  files,
  message: 'test status',
};
const statusPath = writeRunStatus(status, root);
assert(statusPath === path.join(root, '.omx', 'ingestion-runs', 'test-run.json'), 'status path should be rooted in supplied root');
assert(fs.existsSync(getLatestRunPath(root)), 'latest status artifact should be written');
assert(readLatestIngestionRun(root)?.id === 'test-run', 'latest status artifact should round-trip');

fs.rmSync(root, { recursive: true, force: true });
console.log(JSON.stringify({ files: files.length, liveFiles: liveFiles.length, externalFiles: externalResult.run.files.length, statusPath: path.relative(root, statusPath) }, null, 2));
