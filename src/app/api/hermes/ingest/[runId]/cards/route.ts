import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { NextResponse } from 'next/server';
import { isHermesIngestAuthorized, missingHermesTokenMessage } from '@/lib/ingest-auth';
import { readIngestionRun } from '@/lib/ingestion-status';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type CardRow = {
  slug: string;
  title: string;
  path: string;
  type: string;
  category: string;
  bucket: string | null;
  sourceUrls: string[];
  sourceStatusUrl: string | null;
  statusId: string | null;
  statusIdentityStatus: string | null;
  excerpt: string;
};

function unauthorized() {
  return NextResponse.json({ ok: false, message: missingHermesTokenMessage() }, { status: 401 });
}

function safeRelativePath(value: string | undefined | null) {
  if (!value) return null;
  if (path.isAbsolute(value)) return null;
  const normalized = path.normalize(value);
  if (normalized === '..' || normalized.startsWith(`..${path.sep}`)) return null;
  return normalized;
}

function mergedPathFor(runId: string, mergedPath?: string) {
  return safeRelativePath(mergedPath) || path.join('.omx', 'ingestion-runs', runId, 'merged.json');
}

function repoFilePath(relativePath: string) {
  return path.join(/* turbopackIgnore: true */ process.cwd(), relativePath);
}

function readBuckets(runId: string, mergedPath?: string) {
  const filePath = mergedPathFor(runId, mergedPath);
  try {
    const merged = JSON.parse(fs.readFileSync(repoFilePath(filePath), 'utf8')) as { items?: Array<{ sourceCard?: string; bucket?: string }> };
    return new Map((merged.items || []).filter((item) => item.sourceCard && item.bucket).map((item) => [item.sourceCard as string, item.bucket as string]));
  } catch {
    return new Map<string, string>();
  }
}

function slugify(value: string) {
  return value.replace(/\.md$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'note';
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function frontmatterScalar(raw: string, key: string) {
  const match = raw.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
  if (!match) return undefined;
  const value = match[1].trim();
  if (!value || value === 'null') return undefined;
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) return value.slice(1, -1);
  return value;
}

function extractTitle(content: string, fileName: string) {
  return content.match(/^#\s+(.+)$/m)?.[1]?.trim() || fileName.replace(/\.md$/i, '');
}

function extractExcerpt(content: string) {
  return content.replace(/^---[\s\S]*?---/, '').split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#') && !line.startsWith('---')).slice(0, 3).join(' ').slice(0, 280);
}

function parseRunCard(file: string, bucket: string | null): CardRow | null {
  const safeFile = safeRelativePath(file);
  if (!safeFile || !safeFile.endsWith('.md')) return null;
  try {
    const raw = fs.readFileSync(repoFilePath(safeFile), 'utf8');
    const parsed = matter(raw);
    const fileName = path.basename(safeFile);
    const sourceUrls = asStringArray(parsed.data.source_urls).concat(Array.from(parsed.content.matchAll(/https?:\/\/[^\s)]+/g)).map((match) => match[0]).slice(0, 12));
    return {
      slug: slugify(safeFile),
      title: String(parsed.data.name || extractTitle(parsed.content, fileName)),
      path: safeFile,
      type: String(parsed.data.type || 'unknown'),
      category: String(parsed.data.category || 'uncategorized'),
      bucket,
      sourceUrls,
      sourceStatusUrl: frontmatterScalar(raw, 'source_status_url') || (parsed.data.source_status_url ? String(parsed.data.source_status_url) : null),
      statusId: frontmatterScalar(raw, 'status_id') || (parsed.data.status_id ? String(parsed.data.status_id) : null),
      statusIdentityStatus: frontmatterScalar(raw, 'status_identity_status') || (parsed.data.status_identity_status ? String(parsed.data.status_identity_status) : null),
      excerpt: extractExcerpt(parsed.content),
    };
  } catch {
    return null;
  }
}

export async function GET(request: Request, { params }: { params: Promise<unknown> }) {
  if (!isHermesIngestAuthorized(request)) return unauthorized();
  const { runId } = await params as { runId: string };
  const run = readIngestionRun(runId);
  if (!run) return NextResponse.json({ ok: false, message: 'Run not found.' }, { status: 404 });
  const buckets = readBuckets(run.id, run.paths?.merged);
  const notes = (run.files || [])
    .map((file) => parseRunCard(file, buckets.get(file) || null))
    .filter((note): note is CardRow => Boolean(note));
  return NextResponse.json({ ok: true, runId: run.id, count: notes.length, notes, cards: notes, files: run.files });
}
