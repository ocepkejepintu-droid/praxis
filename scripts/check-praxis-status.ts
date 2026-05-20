#!/usr/bin/env node
import fs from 'node:fs';
import matter from 'gray-matter';

function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }
const praxisLib = fs.readFileSync('src/lib/praxis.ts', 'utf8');
const routeText = fs.readFileSync('src/app/api/praxies/[slug]/route.ts', 'utf8');
const editorText = fs.readFileSync('src/components/PraxisEditor.tsx', 'utf8');
const agentText = fs.readFileSync('src/lib/agent.ts', 'utf8');
const praxiesPageText = fs.readFileSync('src/app/praxies/page.tsx', 'utf8');
const praxisLearningPanelText = fs.readFileSync('src/components/PraxisLearningPanel.tsx', 'utf8');
const globalsCss = fs.readFileSync('src/app/globals.css', 'utf8');

for (const stage of ['queued', 'verifying', 'learning', 'tried', 'adopted', 'killed']) assert(praxisLib.includes(`'${stage}'`), `praxis stage missing ${stage}`);
for (const status of ['verify', 'learning', 'test', 'adopt', 'ignore', 'blocked']) assert(praxisLib.includes(`'${status}'`), `praxis status missing ${status}`);
assert(agentText.includes('praxis_status_updated'), 'ACP event type praxis_status_updated missing');
assert(routeText.includes('appendAcpEvent') && routeText.includes('requestActorLabel'), 'Praxis route must append auth-derived audit event');
assert(routeText.includes("type: praxis.stage === 'adopted'") && routeText.includes("'praxis_status_updated'"), 'Praxis route must classify status/adopt/kill events');
assert(editorText.includes('quickMoves') && editorText.includes('Start learning') && editorText.includes('Verify source'), 'Praxis editor quick moves missing');
assert(!praxiesPageText.includes('operatorPraxies.map'), 'Public Praxis page must not render internal/operator experiment notes');
assert(!praxiesPageText.includes('[...xPraxies, ...operatorPraxies]'), 'Public Praxis priority queue must not mix internal/operator notes');
assert(praxiesPageText.includes('Public Praxis shows X use cases and Atlas repo evidence only'), 'Public Praxis source boundary copy missing');
assert(praxiesPageText.includes('Internal experiments stay in operator space, not public Praxis'), 'Public Praxis must explain internal notes are excluded');
assert(praxisLearningPanelText.includes('dcLearningReportCard') && praxisLearningPanelText.includes('dcLearningReportStack'), 'Praxis learning reports must use hardened dark report card classes');
assert(globalsCss.includes('Praxis learning report cards: stop paper-theme bleed'), 'Praxis learning dark theme guard missing');
assert(globalsCss.includes('.dcPraxisLearningPanel.dcPraxisLearningPanel .dcLearningReportCard'), 'Praxis learning card selector missing');
assert(globalsCss.includes('#101010') && globalsCss.includes('rgba(255,255,255,.58)'), 'Praxis learning card must use dark surface and readable muted text');
assert(globalsCss.includes('.dcDashboardPage.dcDashboardPage .dcReportRow'), 'Generic dashboard report rows must be dark themed');
assert(globalsCss.includes('.dcDashboardPage.dcDashboardPage .dcMcpCards > *'), 'Dashboard metric cards must be dark themed');
assert(globalsCss.includes('.dcDashboardPage.dcDashboardPage .dcDashboardHero') && globalsCss.includes('overflow-wrap: anywhere'), 'Dashboard mobile layout must collapse and wrap long adapter text');

const parsed = matter(`---\ntype: experiment\nstage: queued\nstatus: test\nupdated_by: old\n---\n\n# Test Praxis\n`);
const next = matter.stringify(`${parsed.content.trimEnd()}\n`, { ...parsed.data, stage: 'learning', status: 'learning', updated_by: 'Founder <founder@example.com>' });
assert(next.includes('stage: learning'), 'frontmatter stage update simulation failed');
assert(next.includes('status: learning'), 'frontmatter status update simulation failed');
assert(next.includes('updated_by: Founder <founder@example.com>'), 'frontmatter actor update simulation failed');
console.log(JSON.stringify({ ok: true, checked: ['stage-enum', 'status-enum', 'route-audit', 'editor-quick-moves', 'public-praxis-filter', 'learning-report-dark-theme', 'dashboard-report-dark-theme', 'dashboard-mobile-collapse',
    'dashboard-dark-primary-buttons',
    'dashboard-dark-adapter-buttons',
    'all-pages-dark-cta-sweep',
    'mobile-filter-wrap', 'frontmatter-update'] }, null, 2));
