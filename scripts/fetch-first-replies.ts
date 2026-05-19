#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const runArg = process.argv.includes('--run') ? process.argv[process.argv.indexOf('--run') + 1] : 'latest';
const limit = Number(process.argv.includes('--limit') ? process.argv[process.argv.indexOf('--limit') + 1] : 5);
const runPath = runArg === 'latest' ? path.join(root, '.omx/ingestion-runs/latest.json') : path.join(root, '.omx/ingestion-runs', `${runArg}.json`);
const run = JSON.parse(fs.readFileSync(runPath, 'utf8'));
const runDir = path.join(root, '.omx/ingestion-runs', run.id);
const enrichedDir = path.join(runDir, 'enriched');
const replyDir = path.join(runDir, 'reply-fetch');
fs.mkdirSync(replyDir, { recursive: true });

const kimiBin = process.env.KIMI_WEBBRIDGE_BIN || '/Users/yoseph/.hermes/profiles/dev/home/.kimi-webbridge/bin/kimi-webbridge';
const kimiBaseUrl = process.env.KIMI_WEBBRIDGE_URL || 'http://127.0.0.1:10086';

function health() { return JSON.parse(execFileSync(kimiBin, ['status'], { encoding: 'utf8' })); }
function writeRun(next: any) {
  fs.writeFileSync(path.join(root, '.omx/ingestion-runs', `${run.id}.json`), JSON.stringify(next, null, 2));
  fs.writeFileSync(path.join(root, '.omx/ingestion-runs', 'latest.json'), JSON.stringify(next, null, 2));
}
function sidecarCounts() {
  const files = fs.existsSync(enrichedDir) ? fs.readdirSync(enrichedDir).filter(f => f.endsWith('.json')) : [];
  const items = files.map((f) => {
    try { return JSON.parse(fs.readFileSync(path.join(enrichedDir, f), 'utf8')); } catch { return null; }
  }).filter(Boolean);
  return {
    pending: items.filter((item) => !item.xSearch || item.xSearch.status === 'pending').length,
    xSearchOk: items.filter((item) => item.xSearch?.status === 'ok' || item.xSearch?.answer).length,
    replyFetchOk: items.filter((item) => item.replyFetch?.status === 'ok').length,
    replyFetchFailed: items.filter((item) => item.replyFetch?.status === 'failed').length,
  };
}
async function command(action: string, args: Record<string, unknown>, timeoutMs = 45000) {
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(`${kimiBaseUrl}/command`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, args, session: 'agent-radar-reply-fetch' }), signal: ac.signal });
    const text = await res.text();
    let parsed: any = null; try { parsed = text ? JSON.parse(text) : null; } catch {}
    if (!res.ok) throw new Error(`HTTP ${res.status} ${text.slice(0, 300)}`);
    return parsed;
  } finally { clearTimeout(to); }
}
function val<T>(r: any): T { return (r?.data?.value ?? r?.data ?? r?.value ?? r) as T; }

const js = `
(async () => {
  const clean = v => String(v || '').replace(/\\s+/g, ' ').trim();
  const norm = href => { try { const u = new URL(href, location.href); if (u.pathname.includes('/analytics') || u.pathname.includes('/compose')) return ''; return u.href; } catch { return ''; } };
  await new Promise(r => setTimeout(r, 3500));
  const articles = Array.from(document.querySelectorAll('article, [data-testid="tweet"]')).slice(0, 12);
  return articles.map((node, idx) => {
    const text = clean(node.innerText || node.textContent);
    const authorNode = node.querySelector('[data-testid="User-Name"]');
    const urls = Array.from(node.querySelectorAll('a[href]')).map(a => norm(a.getAttribute('href'))).filter(Boolean);
    const externalLinks = urls.filter(u => !/x\\.com|twitter\\.com|t\\.co/i.test(u));
    const media = Array.from(node.querySelectorAll('img, video')).map(el => ({ tag: el.tagName, src: el.src || el.poster || '', alt: el.alt || '' })).filter(x => x.src && !x.src.includes('profile_images')).slice(0, 8);
    return { rank: idx, author: clean(authorNode && (authorNode.innerText || authorNode.textContent)), text, urls, externalLinks, media };
  }).filter(x => x.text.length > 20 || x.urls.length || x.media.length);
})()`;

async function runFetch() {
  const h = health();
  if (!h.running || !h.extension_connected) throw new Error('Kimi WebBridge not connected');
  const files = fs.existsSync(enrichedDir) ? fs.readdirSync(enrichedDir).filter(f => f.endsWith('.json')) : [];
  const targets = files.map(f => JSON.parse(fs.readFileSync(path.join(enrichedDir, f), 'utf8'))).filter(x => x?.status?.url).slice(0, limit);
  const results: any[] = [];
  for (const target of targets) {
    await command('navigate', { url: target.status.url, newTab: false, group_title: 'Agent Radar reply fetch' }, 30000);
    const out = val<any[]>(await command('evaluate', { code: js }, 60000));
    const replies = Array.isArray(out) ? out : [];
    const payload = { runId: run.id, status: target.status, sourceCard: target.sourceCard, fetchedAt: new Date().toISOString(), replies, firstReplyLinks: Array.from(new Set(replies.flatMap(r => r.externalLinks || []))), media: replies.flatMap(r => r.media || []) };
    fs.writeFileSync(path.join(replyDir, `${target.status.id}.json`), JSON.stringify(payload, null, 2));
    target.replyFetch = { status: 'ok', path: path.relative(runDir, path.join(replyDir, `${target.status.id}.json`)), firstReplyLinks: payload.firstReplyLinks, mediaCount: payload.media.length, fetchedAt: payload.fetchedAt };
    fs.writeFileSync(path.join(enrichedDir, `${target.status.id}.json`), JSON.stringify(target, null, 2));
    results.push({ id: target.status.id, links: payload.firstReplyLinks.length, media: payload.media.length });
    console.log(`reply-fetch ${target.status.id}: ${payload.firstReplyLinks.length} links, ${payload.media.length} media`);
  }
  writeRun({
    ...run,
    stage: 'fetch_replies',
    status: run.status === 'failed' || run.status === 'blocked' ? 'partial' : run.status,
    finishedAt: new Date().toISOString(),
    progress: {
      ...run.progress,
      replyFetched: results.length,
      xSearchEnriched: sidecarCounts().xSearchOk,
    },
    sidecars: sidecarCounts(),
    paths: {
      ...run.paths,
      enrichedDir: path.relative(root, enrichedDir),
      replyFetchDir: path.relative(root, replyDir),
    },
    agent_ready: Boolean((run.files || []).length && fs.existsSync(path.join(runDir, 'merged.json'))),
  });
  console.log(JSON.stringify({ ok: true, runId: run.id, fetched: results.length, results }, null, 2));
}
runFetch().catch((e) => { console.error(e instanceof Error ? e.stack || e.message : String(e)); process.exit(1); });
