#!/usr/bin/env node
import fs from 'node:fs';
import matter from 'gray-matter';

function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }
const praxisLib = fs.readFileSync('src/lib/praxis.ts', 'utf8');
const routeText = fs.readFileSync('src/app/api/praxies/[slug]/route.ts', 'utf8');
const editorText = fs.readFileSync('src/components/PraxisEditor.tsx', 'utf8');
const agentText = fs.readFileSync('src/lib/agent.ts', 'utf8');

for (const stage of ['queued', 'verifying', 'learning', 'tried', 'adopted', 'killed']) assert(praxisLib.includes(`'${stage}'`), `praxis stage missing ${stage}`);
for (const status of ['verify', 'learning', 'test', 'adopt', 'ignore', 'blocked']) assert(praxisLib.includes(`'${status}'`), `praxis status missing ${status}`);
assert(agentText.includes('praxis_status_updated'), 'ACP event type praxis_status_updated missing');
assert(routeText.includes('appendAcpEvent') && routeText.includes('requestActorLabel'), 'Praxis route must append auth-derived audit event');
assert(routeText.includes("type: praxis.stage === 'adopted'") && routeText.includes("'praxis_status_updated'"), 'Praxis route must classify status/adopt/kill events');
assert(editorText.includes('quickMoves') && editorText.includes('Start learning') && editorText.includes('Verify source'), 'Praxis editor quick moves missing');

const parsed = matter(`---\ntype: experiment\nstage: queued\nstatus: test\nupdated_by: old\n---\n\n# Test Praxis\n`);
const next = matter.stringify(`${parsed.content.trimEnd()}\n`, { ...parsed.data, stage: 'learning', status: 'learning', updated_by: 'Founder <founder@example.com>' });
assert(next.includes('stage: learning'), 'frontmatter stage update simulation failed');
assert(next.includes('status: learning'), 'frontmatter status update simulation failed');
assert(next.includes('updated_by: Founder <founder@example.com>'), 'frontmatter actor update simulation failed');
console.log(JSON.stringify({ ok: true, checked: ['stage-enum', 'status-enum', 'route-audit', 'editor-quick-moves', 'frontmatter-update'] }, null, 2));
