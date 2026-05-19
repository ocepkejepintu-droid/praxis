#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { atlasCardToPraxis, getHermesAtlasPraxisMap, writeHermesAtlasPraxisMapArtifact } from '../src/lib/hermes-atlas.ts';
import { getDashboardData } from '../src/lib/markdown.ts';
import { getOperatingSlice } from '../src/lib/os.ts';

function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }

const latestPath = path.join('.omx', 'ingestion-runs', 'latest-hermes-atlas.json');
assert(fs.existsSync(latestPath), 'latest Hermes Atlas run pointer missing');
const latest = JSON.parse(fs.readFileSync(latestPath, 'utf8')) as { id?: string };
assert(latest.id, 'latest Hermes Atlas run id missing');
const normalizedPath = path.join('.omx', 'ingestion-runs', latest.id!, 'normalized-cards.json');
assert(fs.existsSync(normalizedPath), 'latest Hermes Atlas normalized-cards map missing');
const normalized = JSON.parse(fs.readFileSync(normalizedPath, 'utf8')) as unknown[];

const map = getHermesAtlasPraxisMap();
assert(map.source === 'Hermes Atlas', 'map source must be Hermes Atlas');
assert(map.generatedFrom === 'latest-hermes-atlas-normalized-cards', 'map must declare normalized-card source of truth');
assert(map.sourceMapPath === normalizedPath, `map source path mismatch: ${map.sourceMapPath}`);
assert(map.totalRepos === normalized.length, `map total ${map.totalRepos} must match normalized cards ${normalized.length}`);
assert(map.totalRepos >= 117, `expected at least 117 Hermes Atlas repo Praxies, got ${map.totalRepos}`);
assert(map.totalSubcategories >= 10, `expected categorized subgroups, got ${map.totalSubcategories}`);
assert(map.subcategories.some((group) => group.name === 'Skills & Skill Registries'), 'missing Skills & Skill Registries subcategory');
assert(map.subcategories.some((group) => group.name === 'Memory & Context'), 'missing Memory & Context subcategory');

for (const praxis of map.praxies) {
  assert(praxis.category === 'Hermes Atlas', `${praxis.id}: category must be Hermes Atlas`);
  assert(praxis.subcategory, `${praxis.id}: subcategory missing`);
  assert(praxis.overview, `${praxis.id}: overview missing`);
  assert(praxis.hypothesis === praxis.overview, `${praxis.id}: hypothesis should mirror overview for UI compatibility`);
  assert(!/may be useful as/i.test(praxis.overview), `${praxis.id}: generic usefulness template leaked into overview`);
  assert(praxis.sourceUrls.length >= 1, `${praxis.id}: source URLs missing`);
  assert(praxis.sourcePath === normalizedPath, `${praxis.id}: sourcePath must point to normalized-card map`);
  assert(praxis.firstTest.includes('verify install/docs') || praxis.firstTest.includes('Find primary repo/docs'), `${praxis.id}: first test not clean`);
  assert(praxis.successSignal.includes('learning report'), `${praxis.id}: success signal missing learning report`);
  assert(praxis.killCriteria.includes('Kill if'), `${praxis.id}: kill criteria missing`);
  assert(praxis.evidenceStrength === 'medium', `${praxis.id}: Atlas evidence must be medium, not fake strong`);
}

const os = getOperatingSlice(getDashboardData());
const osAtlas = os.experiments.filter((praxis) => praxis.id.startsWith('hermes-atlas-'));
assert(osAtlas.length === map.totalRepos, `Operating slice Atlas praxies ${osAtlas.length} must equal map ${map.totalRepos}`);
assert(!fs.readFileSync(path.join('src', 'app', 'praxies', 'page.tsx'), 'utf8').includes('<p>{praxis.hypothesis}</p>'), 'Praxis UI should render explicit Atlas overview, not stale hypothesis-only text');

const bodyPraxis = atlasCardToPraxis({
  title: 'Body Rich Project',
  body: 'Body Rich Project is a practical guide for agent learning loops. It explains memory, verification, and safe execution paths. Extra sentence should be compacted.',
  category: 'Guides & Docs',
  urls: ['https://github.com/example/body-rich-project'],
});
assert(bodyPraxis.overview.startsWith('Body Rich Project is a practical guide for agent learning loops.'), 'card.body should drive Praxis overview when present');
assert(bodyPraxis.hypothesis === bodyPraxis.overview, 'body-driven overview should be visible through hypothesis compatibility field');
assert(!/may be useful as/i.test(bodyPraxis.overview), 'body-driven overview must not use generic usefulness template');

const fallbackPraxis = atlasCardToPraxis({
  title: 'Sparse Atlas Project',
  category: 'Guides & Docs',
  urls: ['https://github.com/example/sparse-atlas-project'],
});
assert(fallbackPraxis.overview === 'Sparse Atlas Project is a guides & docs Hermes Atlas project. Verify primary docs/repo before using it as Praxis.', 'generic fallback should only be used when body is missing');

const richByBody = (normalized as Array<{ title?: string; body?: string }>).filter((card) => typeof card.body === 'string' && card.body.trim().length >= 40);
const richIds = new Set(richByBody.map((card) => String(card.title || '')));
for (const praxis of map.praxies.filter((item) => richIds.has(item.title))) {
  assert(!/Hermes Atlas project\. Verify primary docs\/repo/i.test(praxis.overview), `${praxis.id}: body-rich card fell back to generic overview`);
}

const awesome = map.praxies.find((praxis) => /awesome-hermes-agent/i.test(`${praxis.title} ${praxis.externalId}`));
assert(awesome?.overview.includes('curated repository of resources designed to support the ecosystem'), 'awesome-hermes-agent should show rich Atlas overview');
const orangeBook = map.praxies.find((praxis) => /orange-book/i.test(`${praxis.title} ${praxis.externalId}`));
assert(orangeBook?.overview.includes('practical guide') && orangeBook.overview.includes('memory'), 'hermes-agent-orange-book should show practical guide/memory overview');

const artifact = writeHermesAtlasPraxisMapArtifact();
assert(fs.existsSync(artifact.path), 'Research Operator Atlas Praxis map artifact not written');
const artifactJson = JSON.parse(fs.readFileSync(artifact.path, 'utf8')) as typeof map;
assert(artifactJson.totalRepos === map.totalRepos, 'artifact totalRepos mismatch');
assert(artifactJson.subcategories.length === map.subcategories.length, 'artifact subcategories mismatch');

console.log(JSON.stringify({ ok: true, runId: map.runId, totalRepos: map.totalRepos, subcategories: map.totalSubcategories, artifact: artifact.path, osAtlas: osAtlas.length }, null, 2));
