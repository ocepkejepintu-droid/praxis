import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { getNoteBySlug } from './markdown';

export const praxisStages = ['worth_trying', 'queued', 'verifying', 'learning', 'tried', 'adopted', 'killed'] as const;
export type PraxisStage = typeof praxisStages[number];

export const praxisStatuses = ['inbox', 'verify', 'test', 'learning', 'adopt', 'watch', 'ignore', 'promoted', 'blocked'] as const;
export type PraxisStatus = typeof praxisStatuses[number];

type UpdatePraxisInput = {
  stage?: string;
  status?: string;
  markdown?: string;
  actor?: string;
};

function isPraxisStage(value?: string): value is PraxisStage {
  return Boolean(value && praxisStages.includes(value as PraxisStage));
}

function isPraxisStatus(value?: string): value is PraxisStatus {
  return Boolean(value && praxisStatuses.includes(value as PraxisStatus));
}

export function getPraxisBySlug(slug: string) {
  const note = getNoteBySlug(slug);
  if (!note || note.type !== 'experiment') return null;
  return note;
}

export function updatePraxis(slug: string, input: UpdatePraxisInput) {
  const note = getPraxisBySlug(slug);
  if (!note) return null;
  const fullPath = path.join(process.cwd(), note.path);
  const raw = fs.readFileSync(fullPath, 'utf8');
  const parsed = matter(raw);
  const data = { ...parsed.data };
  if (input.stage !== undefined) {
    if (!isPraxisStage(input.stage)) throw new Error(`Invalid praxis stage: ${input.stage}`);
    data.stage = input.stage;
  }
  if (input.status !== undefined) {
    if (!isPraxisStatus(input.status)) throw new Error(`Invalid praxis status: ${input.status}`);
    data.status = input.status;
  }
  data.updated = new Date().toISOString();
  if (input.actor) data.updated_by = input.actor.slice(0, 80);
  const content = typeof input.markdown === 'string' ? input.markdown.trimEnd() : parsed.content.trimEnd();
  const next = matter.stringify(`${content}\n`, data);
  fs.writeFileSync(fullPath, next);
  return getPraxisBySlug(slug);
}
