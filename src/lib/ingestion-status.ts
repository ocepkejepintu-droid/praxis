import fs from 'node:fs';
import path from 'node:path';
import type { IngestionRunStatus } from './ingestion';

const LATEST_STATUS_FILE = path.join('.omx', 'ingestion-runs', 'latest.json');
const LATEST_ATLAS_FILE = path.join('.omx', 'ingestion-runs', 'latest-hermes-atlas.json');
const RUN_DIR = path.dirname(LATEST_STATUS_FILE);

function readRunFile(file: string): IngestionRunStatus | null {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) as IngestionRunStatus; } catch { return null; }
}

export function readLatestIngestionRun(): IngestionRunStatus | null {
  return readRunFile(LATEST_STATUS_FILE);
}

export function readLatestHermesAtlasRun(): IngestionRunStatus | null {
  const explicit = readRunFile(LATEST_ATLAS_FILE);
  if (explicit) return explicit;
  return readIngestionRunHistory(200).find((run) => run.source === 'hermes-atlas') || null;
}

export function readIngestionRunHistory(limit = 8): IngestionRunStatus[] {
  try {
    if (!fs.existsSync(RUN_DIR)) return [];
    return fs.readdirSync(RUN_DIR)
      .filter((file) => file.endsWith('.json') && !file.startsWith('latest'))
      .map((file) => readRunFile(path.join(RUN_DIR, file)))
      .filter((run): run is IngestionRunStatus => Boolean(run))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, limit);
  } catch {
    return [];
  }
}

export function readIngestionRun(runId: string): IngestionRunStatus | null {
  const safeRunId = runId.replace(/[^a-zA-Z0-9_.-]/g, '');
  if (!safeRunId) return null;
  return readRunFile(path.join(RUN_DIR, `${safeRunId}.json`));
}

export function groupRunsByDate(runs: IngestionRunStatus[]) {
  return runs.reduce<Array<{ date: string; runs: IngestionRunStatus[] }>>((groups, run) => {
    const date = run.startedAt.slice(0, 10);
    const existing = groups.find((group) => group.date === date);
    if (existing) existing.runs.push(run);
    else groups.push({ date, runs: [run] });
    return groups;
  }, []);
}
