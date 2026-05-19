#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { generateResearchLayer, type ResearchJudgementPayload } from '../src/lib/research-layer.ts';
import { findHermesAtlasMatches, getHermesAtlasStatus, writeHermesAtlasPraxisMapArtifact } from '../src/lib/hermes-atlas.ts';

const root = process.cwd();
const args = process.argv.slice(2);

type Row = Record<string, any>;

function arg(name: string, fallback = '') {
  const i = args.findIndex((a) => a === name);
  const inline = args.find((a) => a.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  return i >= 0 ? args[i + 1] || fallback : fallback;
}
function num(name: string, fallback: number) {
  const n = Number(arg(name, String(fallback)));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}
function readJson(p: string) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function readJsonSafe(p: string) { try { return readJson(p); } catch { return null; } }
function arr(value: unknown): string[] { return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : []; }
function uniq(values: string[]) { return Array.from(new Set(values.filter(Boolean))); }
function compact(value: string, max = 220) { return value.replace(/\s+/g, ' ').trim().slice(0, max); }
function stripFrontmatter(markdown: string) { return markdown.replace(/^---[\s\S]*?---\s*/u, '').trim(); }
function titleFrom(markdown: string, fallback: string) { return stripFrontmatter(markdown).match(/^#\s+(.+)$/m)?.[1]?.trim() || fallback; }
function excerptFrom(markdown: string) { return compact(stripFrontmatter(markdown), 520); }
function extractUrls(text: string) { return Array.from(new Set(Array.from(text.matchAll(/https?:\/\/[^\s)\]"'>]+/g)).map((m) => m[0].replace(/[.,;]+$/, '')))); }
function host(url: string) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } }
function isPrimary(url: string) { return /(^|\.)github\.com$|(^|\.)gitlab\.com$|(^|\.)npmjs\.com$|(^|\.)pypi\.org$|(^|\.)docs\./i.test(host(url)) || /\/docs?\b|\/readme\b/i.test(url); }
function isTrackingOrMedia(url: string) { return /pbs\.twimg\.com|video_thumb|twclid=|utm_campaign=/i.test(url); }
function resolveRun() {
  const runArg = arg('--run', 'latest');
  const runPath = runArg === 'latest' ? path.join(root, '.omx/ingestion-runs/latest.json') : path.join(root, '.omx/ingestion-runs', `${runArg}.json`);
  const run = readJson(runPath);
  if (!run?.id) throw new Error(`run not found: ${runPath}`);
  const runDir = path.join(root, '.omx/ingestion-runs', run.id);
  const mergedPath = path.join(runDir, 'merged.json');
  const merged = readJson(mergedPath);
  const rows = Array.isArray(merged.items) ? merged.items as Row[] : [];
  return { run, runDir, mergedPath, rows };
}
function urlsFor(row: Row) {
  const enrichment = row.enrichment || {};
  const reply = row.replyFetch || {};
  return uniq([
    row.statusUrl,
    row.sourceUrl,
    ...(arr(row.sourceUrls)),
    ...(arr(row.urls)),
    ...(arr(enrichment.browserExternalLinks)),
    ...(arr(enrichment.xSearch?.citations)),
    ...(arr(reply.firstReplyLinks)),
    ...extractUrls(String(row.browserMarkdown || '')),
    ...extractUrls(String(enrichment.xSearch?.answer || '')),
  ].map(String).filter((url) => /^https?:\/\//.test(url)));
}
function noiseReason(text: string, urls: string[]) {
  const joined = `${text}\n${urls.join('\n')}`;
  if (/\b(ad|ads|promoted|sponsored|paid social|advertisement)\b/i.test(joined) || urls.some((url) => /utm_(source|medium|campaign)|twclid=/i.test(url))) return 'promoted/tracking-heavy source';
  if (/\b(crypto|airdrop|testnet farming|trading bot|meme coin|memecoin|token presale|100x|claim\s+\$?\d+)\b/i.test(joined)) return 'crypto/spam-like source';
  if (/\b(viral video|1 prompt|one prompt|copy.?paste|revenue bible|get rich|free gemini pro|claim .* free)\b/i.test(joined)) return 'viral prompt-bait source';
  return '';
}
function claimSentences(row: Row, excerpt: string) {
  const answer = compact(String(row.enrichment?.xSearch?.answer || ''), 900);
  const base = answer || excerpt;
  const sentences = base.split(/(?<=[.!?])\s+/).map((x) => compact(x, 260)).filter((x) => x.length >= 24).slice(0, 3);
  if (sentences.length) return sentences;
  return [`Source post claims: ${compact(excerpt, 180)}`];
}
function itemScore(row: Row, urls: string[]) {
  const text = `${row.browserMarkdown || ''}\n${JSON.stringify(row.enrichment || {})}\n${JSON.stringify(row.replyFetch || {})}`;
  let score = 0;
  if (row.enrichment?.xSearch?.status === 'ok' && row.enrichment?.xSearch?.answer) score += 20;
  if (urls.some(isPrimary)) score += 10;
  if (/github\.com|\brepo\b|open source|mcp|sdk|cli|api|plugin|extension|agent|workflow|automation/i.test(text)) score += 8;
  if (row.bucket === 'experiment') score += 4;
  if (row.bucket === 'idea') score += 2;
  return score;
}
function buildPayload(): ResearchJudgementPayload {
  const { run, rows } = resolveRun();
  const limit = num('--limit', 12);
  const candidates = rows.map((row) => {
    const markdown = String(row.browserMarkdown || '');
    const urls = urlsFor(row);
    const text = `${markdown}\n${JSON.stringify(row.enrichment || {})}\n${JSON.stringify(row.replyFetch || {})}`;
    return { row, urls, markdown, text, score: itemScore(row, urls), noise: noiseReason(text, urls) };
  }).sort((a, b) => b.score - a.score).slice(0, limit);

  const ideas: NonNullable<ResearchJudgementPayload['ideas']> = [];
  const experiments: NonNullable<ResearchJudgementPayload['experiments']> = [];
  const actions: NonNullable<ResearchJudgementPayload['actions']> = [];

  for (const candidate of candidates) {
    const row = candidate.row;
    const title = titleFrom(candidate.markdown, row.sourceCard || row.statusId || 'Radar signal');
    const excerpt = excerptFrom(candidate.markdown);
    const atlasMatches = findHermesAtlasMatches({ text: candidate.text, urls: candidate.urls }, 2);
    const atlasSourceUrls = uniq(atlasMatches.flatMap((match) => match.sourceUrls));
    const atlasDependencyUrls = uniq(atlasMatches.flatMap((match) => match.dependencyUrls));
    const sourceUrls = uniq([...candidate.urls.filter((url) => !isTrackingOrMedia(url)), ...atlasSourceUrls]).slice(0, 16);
    const dependencyUrls = uniq([...sourceUrls.filter(isPrimary), ...atlasDependencyUrls]).slice(0, 10);
    const hasXSearch = row.enrichment?.xSearch?.status === 'ok' && Boolean(row.enrichment?.xSearch?.answer);
    const hasAtlas = atlasMatches.length > 0;
    const hasPrimary = dependencyUrls.length > 0;
    const verificationStatus = hasXSearch || hasAtlas ? 'partially_verified' : candidate.noise ? 'unverified' : 'needs_verification';
    const evidenceStrength = (hasXSearch && hasPrimary) || (hasAtlas && hasPrimary) ? 'medium' : 'weak';
    const risky = /homekit|security|credential|payment|browser control|computer control|control over/i.test(candidate.text);
    const sourceNotePath = String(row.sourceCard || 'pending');
    const claims = uniq([...claimSentences(row, excerpt), ...atlasMatches.flatMap((match) => match.claims)]).slice(0, 8);

    if (candidate.noise) {
      actions.push({
        text: `Watch/ignore noisy source: ${compact(title, 100)}`,
        reason: candidate.noise,
        sourceUrls,
        sourceNotePath,
        dependencyUrls,
        targetLane: 'watch',
        priority: 'low',
        owner: 'Hermes',
        verificationStatus,
        evidenceStrength,
        claims,
      });
      continue;
    }

    if (row.bucket === 'experiment' && evidenceStrength !== 'weak' && !risky) {
      experiments.push({
        title: compact(title, 140),
        hypothesis: claims[0] || excerpt,
        firstTest: dependencyUrls.length ? `Run a one-hour smoke test using ${dependencyUrls[0]} and record success/failure evidence.` : 'Find primary source, then run a one-hour smoke test.',
        successSignal: 'One reproducible command/path plus source-backed learning report.',
        killCriteria: 'Kill if primary source is missing, install path fails, or claim depends only on social proof.',
        executionPath: ['Open source card and cited links.', 'Verify primary repo/docs.', 'Run smallest safe smoke test.', 'Write learning report with citations.'],
        sourceUrls,
        sourceNotePath,
        dependencyUrls,
        targetLane: 'buildroom',
        priority: 'medium',
        owner: 'OMX',
        verificationStatus,
        evidenceStrength,
        claims,
      });
    } else if (row.bucket === 'idea' || row.bucket === 'experiment') {
      ideas.push({
        title: compact(title, 140),
        thesis: claims[0] || excerpt,
        whyNow: hasXSearch ? 'x_search sidecar added external context, but this still needs operator review before build.' : hasAtlas ? 'Hermes Atlas matched this tool/repo and added project evidence; verify fit before build.' : 'Latest ingestion surfaced this, but source evidence is still incomplete.',
        nextMove: hasPrimary ? `Verify ${dependencyUrls[0]} and decide whether it becomes a Praxis.` : 'Find primary source or first-reply links before promotion.',
        executionPath: ['Read source note.', 'Check source URLs and sidecar evidence.', 'Classify as buildroom only after medium/strong evidence.', 'Record decision memory.'],
        sourceUrls,
        sourceNotePath,
        dependencyUrls,
        targetLane: evidenceStrength === 'weak' ? 'verify' : risky ? 'verify' : 'content',
        priority: hasXSearch ? 'medium' : 'low',
        owner: 'Hermes',
        verificationStatus,
        evidenceStrength,
        claims,
      });
    } else {
      actions.push({
        text: `Verify signal before promotion: ${compact(title, 100)}`,
        reason: excerpt || 'No clean excerpt found.',
        sourceUrls,
        sourceNotePath,
        dependencyUrls,
        targetLane: 'verify',
        priority: 'low',
        owner: 'Hermes',
        verificationStatus,
        evidenceStrength,
        claims,
      });
    }
  }

  return {
    runId: run.id,
    summary: `Regenerated Research Operator surfaces from latest merged run ${run.id}. Evidence is conservative: no Node-side x_search, no fake citations, weak signals stay verify/watch. Hermes Atlas status: ${JSON.stringify(getHermesAtlasStatus())}.`,
    ideas: ideas.slice(0, 8),
    experiments: experiments.slice(0, 4),
    actions: actions.slice(0, 8),
  };
}

try {
  const payload = buildPayload();
  const atlasArtifact = writeHermesAtlasPraxisMapArtifact();
  const result = generateResearchLayer(payload, { writtenFiles: [atlasArtifact.path] });
  console.log(JSON.stringify({ ok: true, runId: result.runId, counts: result.counts, atlasPraxisMap: { path: atlasArtifact.path, totalRepos: atlasArtifact.map.totalRepos, subcategories: atlasArtifact.map.totalSubcategories }, files: result.files }, null, 2));
} catch (error: any) {
  console.error(JSON.stringify({ ok: false, error: error?.message || String(error) }, null, 2));
  process.exit(2);
}
