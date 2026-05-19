import { getDashboardData } from '../src/lib/markdown.ts';

const data = getDashboardData();
const actionTexts = data.actions.map((action) => action.text);
const repoNames = data.repos.map((repo) => repo.name);
const noteTitles = data.notes.map((note) => note.title);
const notePaths = data.notes.map((note) => note.path);

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(!noteTitles.includes('Agent Radar Dashboard Plan'), 'plan document should not be dashboard signal data');
assert(!notePaths.includes('Meta/KimiWebBridge-X-Ingestion-Pipeline.md'), 'pipeline artifact should not be dashboard signal data');
assert(!notePaths.includes('prompts/kimiwebbridge-x-ingestion.md'), 'prompt artifact should not be dashboard signal data');
assert(!notePaths.some((notePath) => notePath.startsWith('.omx/')), 'OMX run artifacts should not become dashboard signal data');
assert(!noteTitles.includes('Kimi WebBridge X ingestion quality test'), 'dry-run preview cards should not become promoted signal data');
assert(!actionTexts.includes('Human UI is not enough.'), 'concept bullet should not become an action');
assert(!actionTexts.includes('per-project workspace'), 'runtime checklist field should not become an action');
assert(!actionTexts.includes('Tournament director agent'), 'role/category bullet should not become an action');
assert(!actionTexts.includes('Test <specific smallest action>.'), 'template action should not become dashboard work');
assert(actionTexts.includes('Verify GitHub auth so starred/unstarred can be checked.'), 'immediate action should be extracted');
assert(actionTexts.includes('Create repo cards for high-value projects.'), 'repo-card action should be extracted');
assert(repoNames.includes('KevRojo/Dulus'), 'GitHub URL repo should be extracted');
assert(repoNames.includes('Mini Browser'), 'explicit unresolved repo lead should be extracted');
const unsafeStatusNote = data.notes.find((note) => note.sourceStatusUrl === 'https://x.com/aditiitwt/status/2055704951062700434');
if (unsafeStatusNote) {
  assert(unsafeStatusNote.statusId === '2055704951062700434', `unsafe X status ID must stay exact string, got ${unsafeStatusNote.statusId}`);
}

console.log(JSON.stringify({ notes: data.notes.length, repos: data.repos.length, actions: data.actions.length }, null, 2));
