import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';
import type { ActionItem, DashboardData, NoteType, RadarNote, RepoMention, Risk, Status } from './types';

const VAULT_ROOT = process.cwd();
const MARKDOWN_EXT = '.md';
const md = new MarkdownIt({ html: false, linkify: true, typographer: true });
const IGNORE_DIRS = new Set(['node_modules', '.next', '.git', 'research-vault']);
const EXCLUDED_SIGNAL_FILES = new Set(['Agent-Radar-Dashboard-Plan.md', 'README.md', 'KimiWebBridge-X-Ingestion-Pipeline.md', 'kimiwebbridge-x-ingestion.md']);

function slugify(value: string) {
  return value.replace(/\.md$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function uniqueSlug(baseSlug: string, seenSlugs: Map<string, number>) {
  const fallbackSlug = baseSlug || 'note';
  const seenCount = seenSlugs.get(fallbackSlug) ?? 0;
  seenSlugs.set(fallbackSlug, seenCount + 1);
  return seenCount === 0 ? fallbackSlug : `${fallbackSlug}-${seenCount + 1}`;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function asNumber(value: unknown, fallback: number) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.max(1, Math.min(5, num)) : fallback;
}

function frontmatterScalar(raw: string, key: string) {
  const match = raw.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
  if (!match) return undefined;
  const value = match[1].trim();
  if (!value || value === 'null') return undefined;
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) return value.slice(1, -1);
  return value;
}

function normalizeStatus(value: unknown, content: string): Status {
  const raw = String(value ?? '').toLowerCase();
  if (['inbox', 'verify', 'test', 'adopt', 'watch', 'ignore', 'promoted'].includes(raw)) return raw as Status;
  if (/must inspect|verify|needs verification|not verified|resolve exact/i.test(content)) return 'verify';
  if (/next action|immediate next actions|action queue/i.test(content)) return 'watch';
  return 'inbox';
}

function normalizeRisk(value: unknown, content: string): Risk {
  const raw = String(value ?? '').toLowerCase();
  if (['low', 'medium', 'high'].includes(raw)) return raw as Risk;
  if (/high risk|crypto|credential|voice cloning|untrusted|install script|free unlimited/i.test(content)) return 'high';
  if (/risk|caveat|watch|verify/i.test(content)) return 'medium';
  return 'low';
}

function inferType(fileName: string, dataType: unknown, content: string): NoteType {
  const raw = String(dataType ?? '').toLowerCase();
  if (['repo', 'use_case', 'product', 'model', 'synthesis', 'scorio_idea', 'idea', 'experiment', 'action', 'capture', 'plan'].includes(raw)) return raw as NoteType;
  if (/plan/i.test(fileName)) return 'plan';
  if (/repo watch|repo lead|github/i.test(content)) return 'capture';
  if (/executive synthesis|durable knowledge|weekly synthesis/i.test(content)) return 'synthesis';
  return 'unknown';
}

function extractTitle(content: string, fileName: string) {
  return content.match(/^#\s+(.+)$/m)?.[1]?.trim() || fileName.replace(/\.md$/i, '');
}

function extractHeadings(content: string) {
  return Array.from(content.matchAll(/^#{2,3}\s+(.+)$/gm)).map((m) => m[1].trim()).slice(0, 30);
}

function extractExcerpt(content: string) {
  return content.replace(/^---[\s\S]*?---/, '').split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#') && !line.startsWith('---')).slice(0, 3).join(' ').slice(0, 280);
}

function findMarkdownFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    if (IGNORE_DIRS.has(entry.name)) return [];
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return findMarkdownFiles(fullPath);
    if (entry.isFile() && entry.name.endsWith(MARKDOWN_EXT)) return [fullPath];
    return [];
  });
}

function categoryFromText(text: string) {
  if (/browser|chrome|scrcpy|mobile/i.test(text)) return 'browser-agent';
  if (/mcp|cli|api/i.test(text)) return 'mcp-cli';
  if (/runtime|sandbox|firecracker|microvm/i.test(text)) return 'agent-runtime';
  if (/voice|audio|content|youtube/i.test(text)) return 'content-agent';
  if (/model|ring|llm/i.test(text)) return 'model';
  if (/scorio|hermes|omx/i.test(text)) return 'scorio';
  if (/commerce|payment|usdc|wallet|onchain/i.test(text)) return 'commerce';
  return 'coding-agent';
}

function scoreRelevance(text: string) {
  if (/very high|directly shapes|Scorio relevance:\s*High|Hermes\/OMX relevance:\s*High/i.test(text)) return 5;
  if (/high relevance|relevance:\s*high|strategically important/i.test(text)) return 4;
  if (/medium-high|medium/i.test(text)) return 3;
  return 2;
}

function scoreActionability(text: string) {
  if (/act now|next action|immediate next actions|test this week|first experiment/i.test(text)) return 5;
  if (/inspect|verify|resolve|create repo cards/i.test(text)) return 4;
  if (/watch|track|compare/i.test(text)) return 3;
  return 2;
}

function extractRepoMentions(note: Pick<RadarNote, 'slug' | 'title' | 'content' | 'status' | 'risk' | 'category'>): RepoMention[] {
  const repos = new Map<string, RepoMention>();
  const githubUrls = Array.from(note.content.matchAll(/https:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/g));
  for (const match of githubUrls) {
    const repo = match[1].replace(/\.git$/i, '');
    const start = Math.max(0, match.index - 500);
    const end = Math.min(note.content.length, match.index + 800);
    const context = note.content.slice(start, end);
    repos.set(repo.toLowerCase(), {
      name: repo,
      url: `https://github.com/${repo}`,
      sourceNoteSlug: note.slug,
      sourceNoteTitle: note.title,
      risk: normalizeRisk(undefined, context),
      status: /verify|must inspect|not verified|repo lead|candidate/i.test(context) ? 'verify' : note.status,
      category: categoryFromText(context + ' ' + repo),
      relevance: scoreRelevance(context),
    });
  }
  const repoLeadSections = Array.from(note.content.matchAll(/^###\s+\d*\.?\s*(.+)$/gm));
  for (let i = 0; i < repoLeadSections.length; i += 1) {
    const section = repoLeadSections[i];
    const nextSection = repoLeadSections[i + 1];
    const raw = section[1].replace(/—.*/, '').trim();
    const chunk = section.input.slice(section.index, nextSection?.index ?? note.content.length);
    if (!/Repo(?: lead)?:/i.test(chunk) || /https:\/\/github\.com\//i.test(chunk)) continue;
    if (!raw || raw.length > 70) continue;
    const key = raw.toLowerCase();
    if (!repos.has(key)) {
      repos.set(key, {
        name: raw,
        sourceNoteSlug: note.slug,
        sourceNoteTitle: note.title,
        risk: normalizeRisk(undefined, chunk),
        status: /not verified|repo lead|candidate|exact repo/i.test(chunk) ? 'verify' : note.status,
        category: categoryFromText(chunk + ' ' + raw),
        relevance: scoreRelevance(chunk),
      });
    }
  }
  return Array.from(repos.values()).slice(0, 60);
}


function isConcreteAction(text: string) {
  return /^(add|adopt|build|check|compare|connect|create|define|design|document|do not|extract|find|inspect|keep|map|promote|publish|put|refresh|resolve|review|run|send|star|test|track|turn|update|use|verify|watch|write)\b/i.test(text);
}

function extractActionItems(note: Pick<RadarNote, 'slug' | 'title' | 'content' | 'category'>): ActionItem[] {
  const actions: ActionItem[] = [];
  const lines = note.content.split('\n');
  let inActionBlock = false;
  let inInlineAction = false;
  lines.forEach((line, index) => {
    if (/^##+\s+(Immediate next actions|Next actions|Actions|Recommended next task|First implementation plan)/i.test(line)) {
      inActionBlock = true;
      inInlineAction = false;
      return;
    }
    if (/^Action:\s*$/i.test(line.trim())) {
      inInlineAction = true;
      return;
    }
    if (line.trim() === '' && inInlineAction) inInlineAction = false;
    if (inActionBlock && /^##\s+/.test(line)) inActionBlock = false;
    const bullet = line.match(/^[-*]\s+(.+)/) || line.match(/^\d+\.\s+(.+)/);
    if (bullet && (inActionBlock || inInlineAction)) {
      const text = bullet[1].replace(/`/g, '').trim();
      const isNonAction = /^(x|link|links|repo|source|reason|caveat|status|stars|description):/i.test(text) || /https?:\/\//i.test(text) || /:\s*$/.test(text);
      if (!isNonAction && isConcreteAction(text) && text.length > 8 && text.length < 180) {
        actions.push({
          id: `${note.slug}-${index}`,
          text,
          sourceNoteSlug: note.slug,
          sourceNoteTitle: note.title,
          priority: /build|run|design|immediate|must|verify|resolve/i.test(text) ? 'high' : 'medium',
          category: categoryFromText(text) || note.category,
        });
      }
    }
  });
  return actions.slice(0, 40);
}

export function getDashboardData(): DashboardData {
  const files = findMarkdownFiles(VAULT_ROOT)
    .filter((file) => !file.includes(`${path.sep}.omx${path.sep}`))
    .filter((file) => !EXCLUDED_SIGNAL_FILES.has(path.basename(file)))
    .sort();
  const seenSlugs = new Map<string, number>();
  const notes: RadarNote[] = files.map((file) => {
    const raw = fs.readFileSync(file, 'utf8');
    const rawIngestionRunId = frontmatterScalar(raw, 'ingestion_run_id') || frontmatterScalar(raw, 'run_id');
    const rawSourceStatusUrl = frontmatterScalar(raw, 'source_status_url');
    const rawStatusId = frontmatterScalar(raw, 'status_id');
    const rawStatusIdentityStatus = frontmatterScalar(raw, 'status_identity_status');
    const parsed = matter(raw);
    const rel = path.relative(VAULT_ROOT, file);
    const fileName = path.basename(file);
    const title = String(parsed.data.name || extractTitle(parsed.content, fileName));
    const status = normalizeStatus(parsed.data.status, parsed.content);
    const risk = normalizeRisk(parsed.data.risk, parsed.content);
    const type = inferType(fileName, parsed.data.type, parsed.content);
    const category = String(parsed.data.category || categoryFromText(parsed.content));
    const noteBase: RadarNote = {
      slug: uniqueSlug(slugify(rel), seenSlugs),
      fileName,
      path: rel,
      title,
      type,
      status,
      category,
      strategicRelevance: asNumber(parsed.data.strategic_relevance, scoreRelevance(parsed.content)),
      actionability: asNumber(parsed.data.actionability, scoreActionability(parsed.content)),
      risk,
      confidence: String(parsed.data.confidence || (/checked|verified|metadata/i.test(parsed.content) ? 'medium' : 'low')).toLowerCase() as RadarNote['confidence'],
      sourceUrls: asStringArray(parsed.data.source_urls).concat(Array.from(parsed.content.matchAll(/https?:\/\/[^\s)]+/g)).map((m) => m[0]).slice(0, 12)),
      tags: asStringArray(parsed.data.tags),
      created: parsed.data.created ? String(parsed.data.created) : undefined,
      updated: parsed.data.updated ? String(parsed.data.updated) : undefined,
      lastChecked: parsed.data.last_checked ? String(parsed.data.last_checked) : undefined,
      ingestionRunId: rawIngestionRunId || (parsed.data.ingestion_run_id ? String(parsed.data.ingestion_run_id) : parsed.data.run_id ? String(parsed.data.run_id) : undefined),
      ingestedAt: parsed.data.ingested_at ? String(parsed.data.ingested_at) : undefined,
      sourceChannel: parsed.data.source_channel ? String(parsed.data.source_channel) : undefined,
      sourceStatusUrl: rawSourceStatusUrl || (parsed.data.source_status_url ? String(parsed.data.source_status_url) : undefined),
      statusId: rawStatusId || (parsed.data.status_id ? String(parsed.data.status_id) : undefined),
      statusIdentityStatus: rawStatusIdentityStatus || (parsed.data.status_identity_status ? String(parsed.data.status_identity_status) : undefined),
      stage: parsed.data.stage ? String(parsed.data.stage) : undefined,
      owner: parsed.data.owner ? String(parsed.data.owner) : undefined,
      source: parsed.data.source ? String(parsed.data.source) : undefined,
      excerpt: extractExcerpt(parsed.content),
      content: parsed.content,
      html: md.render(parsed.content),
      headings: extractHeadings(parsed.content),
      repoMentions: [],
      actionItems: [],
    };
    noteBase.repoMentions = noteBase.type === 'plan' ? [] : extractRepoMentions(noteBase);
    noteBase.actionItems = extractActionItems(noteBase);
    return noteBase;
  }).sort((a, b) => b.strategicRelevance - a.strategicRelevance || a.title.localeCompare(b.title));

  const repoMap = new Map<string, RepoMention>();
  for (const note of notes) {
    for (const repo of note.repoMentions) {
      const key = (repo.url || repo.name).toLowerCase();
      const existing = repoMap.get(key);
      if (!existing || repo.relevance > existing.relevance) repoMap.set(key, repo);
    }
  }
  const repos = Array.from(repoMap.values()).sort((a, b) => b.relevance - a.relevance || a.name.localeCompare(b.name));
  const actions = notes.flatMap((note) => note.actionItems).sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority));
  return {
    notes,
    repos,
    actions,
    stats: {
      notes: notes.length,
      repos: repos.length,
      actions: actions.length,
      highRelevance: notes.filter((note) => note.strategicRelevance >= 4).length,
      verify: repos.filter((repo) => repo.status === 'verify').length,
    },
  };
}

function priorityRank(priority: ActionItem['priority']) {
  return priority === 'high' ? 3 : priority === 'medium' ? 2 : 1;
}

export function getNoteBySlug(slug: string) {
  return getDashboardData().notes.find((note) => note.slug === slug);
}
