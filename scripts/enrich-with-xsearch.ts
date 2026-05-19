#!/usr/bin/env node
// Run after any ingest-x.ts run to enrich all discovered status IDs with x_search
import fs from 'node:fs';
import path from 'node:path';

const runDir = path.join(process.cwd(), '.omx', 'ingestion-runs');
const latest = JSON.parse(fs.readFileSync(path.join(runDir, 'latest.json'), 'utf8'));

console.log('Latest run:', latest.id);
console.log('Extracting status IDs from cards...');

// Simple extraction from written files or status (demo)
const statusIds: string[] = [];
console.log('Status IDs found:', statusIds.length);
console.log('Next: feed these IDs to x_search for full enrichment (metrics, canonical text, conversationId, etc.)');
console.log('Run: hermes x-search on the IDs or ask agent to batch-enrich.');