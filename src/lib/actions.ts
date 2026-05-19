import type { ActionItem, CanonicalAction, DashboardData, NoteType } from './types';

const BOILERPLATE_PATTERNS = [
  /^resolve primary source links and verify claims before adopting\.?$/i,
  /^promote to an experiment only if the first test is under one day\.?$/i,
];

function priorityRank(priority: ActionItem['priority']) {
  return priority === 'high' ? 3 : priority === 'medium' ? 2 : 1;
}

function normalizeActionText(text: string) {
  return text
    .toLowerCase()
    .replace(/—.*$/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/[.。]+$/g, '')
    .trim();
}

function sourceType(type: NoteType): CanonicalAction['sourceTypes'][number] {
  if (type === 'action') return 'action';
  if (type === 'idea') return 'idea';
  if (type === 'experiment') return 'experiment';
  return 'raw';
}

function isBoilerplate(text: string) {
  return BOILERPLATE_PATTERNS.some((pattern) => pattern.test(text.trim()));
}

export function getCanonicalActions(data: DashboardData): CanonicalAction[] {
  const notesBySlug = new Map(data.notes.map((note) => [note.slug, note]));
  const groups = new Map<string, CanonicalAction>();

  for (const action of data.actions) {
    const note = notesBySlug.get(action.sourceNoteSlug);
    const key = normalizeActionText(action.text);
    const existing = groups.get(key);
    const type = sourceType(note?.type || 'unknown');
    const source = {
      noteSlug: action.sourceNoteSlug,
      noteTitle: action.sourceNoteTitle,
      notePath: note?.path || '',
      noteType: note?.type || 'unknown',
    };

    if (existing) {
      existing.sourceCount += 1;
      if (!existing.categories.includes(action.category)) existing.categories.push(action.category);
      if (!existing.sourceTypes.includes(type)) existing.sourceTypes.push(type);
      if (existing.sources.length < 12 && !existing.sources.some((item) => item.noteSlug === source.noteSlug)) existing.sources.push(source);
      if (priorityRank(action.priority) > priorityRank(existing.priority)) existing.priority = action.priority;
      existing.score = Math.max(existing.score, priorityRank(action.priority) * 100 + (note?.strategicRelevance || 0) * 10 + (note?.actionability || 0));
      continue;
    }

    groups.set(key, {
      id: key.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || action.id,
      text: action.text,
      normalizedText: key,
      priority: action.priority,
      primaryCategory: action.category,
      categories: [action.category],
      sourceTypes: [type],
      sourceCount: 1,
      sources: [source],
      boilerplate: isBoilerplate(action.text),
      score: priorityRank(action.priority) * 100 + (note?.strategicRelevance || 0) * 10 + (note?.actionability || 0),
    });
  }

  return Array.from(groups.values()).sort((a, b) => {
    if (a.boilerplate !== b.boilerplate) return a.boilerplate ? 1 : -1;
    return b.score - a.score || b.sourceCount - a.sourceCount || a.text.localeCompare(b.text);
  });
}
