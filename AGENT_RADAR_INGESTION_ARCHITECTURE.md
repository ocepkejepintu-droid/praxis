# Agent Radar Ingestion Architecture

Status: current architecture as of 2026-05-17
App path: `/Users/yoseph/Documents/AI-Agent-Radar`

## Short version

Agent Radar is a source-to-judgement pipeline.

It should not care whether signals came from X, Hermes Atlas, RSS, GitHub, Reddit, Hacker News, or a generic webpage. Every source should be translated into the same normalized card/run format first.

Core flow:

```text
source
  -> source adapter / skill / script
  -> normalized cards or raw X signals
  -> /api/hermes/ingest
  -> .omx ingestion run + markdown cards
  -> enrichment sidecars where needed
  -> /api/hermes/judgement
  -> Ideas / Experiments / Actions / Inbox / Repos / Use Cases
```

The important invariant:

```text
Disk owns the run. Browser/API calls only emit small chunks.
```

If Chrome, Kimi WebBridge, X, or an external website fails mid-run, previously written markdown and JSON are still usable.

---

## Main app surfaces

### Next.js app

The app is a Next.js app in:

```text
/Users/yoseph/Documents/AI-Agent-Radar
```

Key files:

```text
src/app/api/hermes/ingest/route.ts              Main Hermes ingestion endpoint
src/app/api/ingest/x/route.ts                   Existing X/browser ingestion route
src/app/api/hermes/judgement/route.ts           Judgement endpoint
src/lib/ingestion.ts                            Shared card/run types and markdown writer
src/lib/external-cards.ts                       Generic external-card ingestion mode
src/lib/ingestion-status.ts                     Latest/recent run status readers
scripts/ingest-x-fast.ts                        Chunked X home-feed discovery
scripts/enrich-x-cards.ts                       X sidecar preparation
scripts/fetch-first-replies.ts                  X first-reply link/media fetcher
scripts/judge-enriched-cards.ts                 Merge/judgement scaffold
scripts/ingest-hermes-atlas.ts                  Hermes Atlas external-card adapter
```

Package scripts:

```bash
npm run dev
npm run ingest:x
npm run ingest:hermes-atlas
npm run test:ingestion
```

---

## Data model

### Ingestion run

Every ingest creates a run status JSON under:

```text
.omx/ingestion-runs/<runId>.json
.omx/ingestion-runs/latest.json
```

Important fields:

```ts
type IngestionRunStatus = {
  id: string
  mode: 'dry-run' | 'live' | 'external-cards'
  status: 'running' | 'ok' | 'partial' | 'blocked' | 'failed'
  source?: string
  stage?: 'discover' | 'prepare_enrichment' | 'fetch_replies' | 'x_search_enrich' | 'merge' | 'judge'
  startedAt: string
  finishedAt: string
  cardsCreated: number
  rejectedCount: number
  verificationGaps: string[]
  files: string[]
  message: string
  crawlStats?: object
  progress?: object
  sidecars?: object
  command?: object
  paths?: object
  errors?: string[]
  agent_ready?: boolean
}
```

### Ingestion card

The internal card type is defined in `src/lib/ingestion.ts`:

```ts
type IngestionCard = {
  type: 'capture' | 'repo' | 'use_case' | 'scorio_idea' | 'experiment'
  status: 'inbox' | 'verify' | 'test' | 'watch' | 'ignore'
  category: string
  risk: 'low' | 'medium' | 'high'
  title: string
  body: string
  sourceUrls: string[]
  strategicRelevance: number
  actionability: number
  confidence: 'low' | 'medium' | 'high'
  targetDir: string

  ingestionRunId?: string
  ingestedAt?: string
  sourceChannel?: string

  // X-specific identity fields
  sourceStatusUrl?: string
  statusId?: string
  statusIdentityStatus?: 'ok' | 'missing_dom_status_url' | 'external_ad' | 'unresolved'
  homeFeedRank?: number
  enrichmentStatus?: 'pending' | 'partial' | 'complete'
  replyFetchStatus?: 'pending' | 'ok' | 'failed'

  // Generic external-source metadata
  external?: {
    source?: string
    externalId?: string
    sourceUrl?: string
    canonicalUrl?: string
    category?: string
    author?: string
    publishedAt?: string
    urls?: string[]
    metrics?: Record<string, unknown>
    ingestionMode?: 'external-cards'
  }
}
```

### Markdown card output

Cards are written to human-reviewable folders:

```text
Inbox/*.md
Repos/*.md
Use Cases/*.md
Scorio Ideas/*.md
Experiments/*.md
Ideas/*.md
Actions/*.md
```

Markdown includes YAML frontmatter with run/source metadata and a body with the captured signal.

For external cards, frontmatter includes:

```yaml
source: hermes-atlas
externalId: "owner/repo"
sourceUrl: "https://hermesatlas.com/projects/owner/repo"
canonicalUrl: "https://github.com/owner/repo"
author: owner
publishedAt: "..."
ingestionMode: external-cards
urls:
  - "..."
metrics:
  stars: 123
  official: false
```

---

## API entrypoint: `/api/hermes/ingest`

File:

```text
src/app/api/hermes/ingest/route.ts
```

This route is now the stable ingestion front door.

### GET

Returns service status:

```json
{
  "ok": true,
  "service": "agent-radar-hermes-ingestion",
  "latestRun": {},
  "recentRuns": [],
  "activeLock": {},
  "trigger": {
    "method": "POST",
    "body": {
      "mode": "live",
      "source": "home",
      "maxScrolls": 80,
      "maxCards": 120,
      "minDurationMinutes": 60
    }
  }
}
```

### POST router behavior

The POST route has two modes:

```text
if body.cards is an array:
  route to ingestExternalCards(body)
else:
  route to existing X ingestion handler
```

In code:

```ts
if (hasExternalCards(body)) {
  return NextResponse.json(ingestExternalCards(body))
}

return triggerXIngestion(...)
```

This means:

- Existing X doomscroll payloads keep working unchanged.
- New websites can skip browser/X crawl and directly submit normalized cards.

### Auth

If `HERMES_INGEST_TOKEN` exists, requests must send:

```http
Authorization: Bearer <token>
```

If the env var is absent, local requests are accepted without auth.

---

## Flow A: X home-feed doomscroll

Use when the source is Yoseph's trained X home feed.

### Why X is special

X needs special handling because valuable links are often hidden in first replies and because the home feed order is itself a signal.

X stages:

```text
X home feed in logged-in Chrome
  -> Kimi WebBridge browser discovery
  -> raw markdown cards + raw JSON
  -> extract status IDs
  -> x_search / X enrichment sidecars
  -> targeted first-reply browser fetch
  -> merged enriched cards
  -> judgement
```

### Discovery

Script:

```text
scripts/ingest-x-fast.ts
```

Purpose:

- Use Kimi WebBridge against `https://x.com/home`.
- Reuse the existing X tab/session.
- Scroll in short rounds, not one giant browser eval.
- Capture visible tweet text, author/context, status URL, visible links, media hints.
- Write markdown incrementally.

Smoke command:

```bash
cd /Users/yoseph/Documents/AI-Agent-Radar
node --experimental-strip-types scripts/ingest-x-fast.ts \
  --max-cards 12 --rounds 3 --scrolls-per-round 2 --pause-ms 1000
```

Production-ish command:

```bash
node --experimental-strip-types scripts/ingest-x-fast.ts \
  --max-cards 300 --rounds 40 --scrolls-per-round 2 --pause-ms 1500
```

Important rule:

```text
Do not open first replies during main scrolling.
```

Main scrolling should stay fast and persist data first.

### X enrichment prep

Script:

```text
scripts/enrich-x-cards.ts
```

Purpose:

- Read latest run markdown cards.
- Extract `x.com/<handle>/status/<id>` IDs.
- Write sidecars in:

```text
.omx/ingestion-runs/<runId>/enriched/<statusId>.json
```

It prepares x_search query shapes like:

```text
conversation_id:<statusId>
```

with image understanding expected when available.

### First-reply fetch

Script:

```text
scripts/fetch-first-replies.ts
```

Purpose:

- Open selected status pages in the same browser session.
- Read first 5-10 replies.
- Extract GitHub/docs/demo/product links and media URLs hidden in comments.
- Write:

```text
.omx/ingestion-runs/<runId>/reply-fetch/<statusId>.json
```

### Merge / judgement scaffold

Script:

```text
scripts/judge-enriched-cards.ts
```

Purpose:

- Merge markdown cards + x_search sidecars + reply-fetch sidecars.
- Bucket signals into `experiment`, `idea`, `new-feature-update`, `scorio`, `ignore`, or `inbox`.
- Write:

```text
.omx/ingestion-runs/<runId>/merged.json
```

Final judgement should then promote only high-quality items into Ideas / Experiments / Actions.

### X failure model

Common X/WebBridge issues:

- Long browser evaluate hangs or fails.
- Tab/session binding becomes stale.
- First-reply opening inside the main loop loses progress.
- Client HTTP timeout happens while server run continues.

Rules:

- Chunk browser work.
- Persist after every small round.
- Check `GET /api/hermes/ingest` before starting duplicate runs.
- If `activeLock` exists, poll instead of launching another run.
- Judge partial runs only if cards were written, and label them partial.

---

## Flow B: Generic external-card ingestion

Use for websites that can be translated into cards without browser doomscroll.

File:

```text
src/lib/external-cards.ts
```

### External-card request

Any source adapter can call:

```http
POST http://localhost:3000/api/hermes/ingest
Content-Type: application/json
```

Payload:

```json
{
  "mode": "external",
  "source": "hermes-atlas",
  "sourceUrl": "https://hermesatlas.com/",
  "cards": [
    {
      "externalId": "jau123/MeiGen-AI-Design-MCP",
      "title": "MeiGen-AI-Design-MCP",
      "body": "MCP server for AI design/image/video generation...",
      "author": "jau123",
      "category": "Plugins & Extensions",
      "sourceUrl": "https://hermesatlas.com/projects/jau123/MeiGen-AI-Design-MCP",
      "canonicalUrl": "https://github.com/jau123/MeiGen-AI-Design-MCP",
      "urls": ["https://github.com/jau123/MeiGen-AI-Design-MCP"],
      "metrics": { "stars": 123 },
      "publishedAt": "2026-05-16T07:18:51Z",
      "raw": {}
    }
  ],
  "options": {
    "dedupe": true,
    "writeMarkdown": true,
    "judge": false
  }
}
```

### Accepted fields

Required:

```text
title
body OR summary OR description
sourceUrl OR canonicalUrl
```

Optional:

```text
externalId
author
category
canonicalUrl
urls
metrics
publishedAt
tags
raw
```

### Normalization

`normalizeExternalCards()` cleans and clamps data:

- strings are whitespace-normalized
- URLs must be http/https
- URL lists are deduped
- metrics only allow safe simple keys and primitive values
- tags are capped
- invalid cards become verification errors

### Dedupe order

External card dedupe uses this priority:

```text
1. source + externalId
2. canonicalUrl
3. sourceUrl
4. normalized title + body fingerprint
```

The dedupe is per request currently. Persisted historical dedupe is not the main mechanism yet; repeated calls may still create a new run with files unless the adapter filters by date/source.

### Classification

External cards are converted to internal `IngestionCard` objects.

Simple current inference:

```text
if card mentions github.com -> type repo, status verify, target Repos
else -> type capture, status watch, target Inbox
```

Risk inference flags token/private-key/wallet/crypto/install-script language.

### Persistence

For every external-card request:

```text
.omx/ingestion-runs/<runId>/raw-cards.json
.omx/ingestion-runs/<runId>/normalized-cards.json
.omx/ingestion-runs/<runId>.json
.omx/ingestion-runs/latest.json
Repos/*.md or Inbox/*.md
```

Run id shape:

```text
<iso-timestamp>-<source>-external
```

Response shape:

```json
{
  "ok": true,
  "run": {
    "id": "2026-05-17T...-hermes-atlas-external",
    "source": "hermes-atlas",
    "mode": "external-cards",
    "cardsReceived": 50,
    "cardsCreated": 37,
    "duplicates": 13,
    "rejected": 0,
    "files": [],
    "statusPath": ".omx/ingestion-runs/<runId>.json",
    "paths": {
      "rawSignals": ".omx/ingestion-runs/<runId>/raw-cards.json",
      "merged": ".omx/ingestion-runs/<runId>/normalized-cards.json",
      "cards": []
    }
  }
}
```

---

## Flow C: Hermes Atlas adapter

Use for https://hermesatlas.com/.

Script:

```text
scripts/ingest-hermes-atlas.ts
```

Package command:

```bash
npm run ingest:hermes-atlas -- --max-cards 50 --since-days 7
```

Dry run:

```bash
npm run ingest:hermes-atlas -- --max-cards 5 --since-days 7 --dry-run
```

Custom endpoint:

```bash
npm run ingest:hermes-atlas -- \
  --endpoint http://localhost:3000/api/hermes/ingest \
  --max-cards 50 \
  --since-days 7
```

### Why Hermes Atlas should not use browser doomscroll

Hermes Atlas exposes clean machine-readable sources:

```text
https://hermesatlas.com/rss.xml
https://hermesatlas.com/data/repos.json
https://hermesatlas.com/data/summaries.json
https://hermesatlas.com/llms-full.txt
```

So its best adapter flow is:

```text
fetch rss.xml + repos.json + summaries.json + llms-full.txt
  -> parse RSS recent project entries
  -> merge repos by owner/repo with summaries
  -> rank by published date then stars
  -> create normalized cards
  -> POST cards[] to /api/hermes/ingest
```

### Hermes Atlas card mapping

```text
externalId    owner/repo
title         repo.name or repo.repo
body          summary.summary + highlights + repo.description + rss.description
author        owner
category      repo.category or rss.category
sourceUrl     hermesatlas.com/projects/<owner>/<repo>
canonicalUrl  GitHub repo URL
urls          [GitHub URL, Hermes Atlas project URL]
metrics       stars, official, audit
publishedAt   RSS pubDate or summary.generatedAt
raw           repo + summary + rss
```

### Current script internals

The script fetches four resources in parallel:

```ts
const [rssXml, repos, summaries, llmsFull] = await Promise.all([
  fetchText(`${ATLAS_BASE}/rss.xml`),
  fetchJson<RepoRecord[]>(`${ATLAS_BASE}/data/repos.json`),
  fetchJson<Record<string, SummaryRecord>>(`${ATLAS_BASE}/data/summaries.json`),
  fetchText(`${ATLAS_BASE}/llms-full.txt`),
])
```

Then it posts:

```json
{
  "mode": "external",
  "source": "hermes-atlas",
  "sourceUrl": "https://hermesatlas.com",
  "cards": [],
  "options": {
    "dedupe": true,
    "writeMarkdown": true,
    "judge": false
  }
}
```

---

## Judgement flow

Endpoint:

```http
POST /api/hermes/judgement
```

Purpose:

- Read a run and/or receive judged payload.
- Create promoted files in Ideas / Experiments / Actions.
- Keep raw cards as evidence, not final recommendations.
- Emit Research Operator metadata so Codex/OMX can route work into build, verify, content, or watch lanes.

Hermes role:

```text
Hermes becomes the research analyst.
Codex builds the Research Operator infrastructure.
```

Required fields for every promoted Idea / Experiment / Action:

```ts
type ResearchOperatorFields = {
  runId: string
  sourceUrls: string[]
  sourceNotePath?: string
  dependencyUrls: string[]
  targetLane: 'buildroom' | 'verify' | 'content' | 'watch'
  priority: 'high' | 'medium' | 'low'
  owner: 'Hermes' | 'OMX' | 'Yoseph'
  blockedReason?: string
  verificationStatus: 'unverified' | 'needs_verification' | 'partially_verified' | 'verified'
  evidenceStrength: 'weak' | 'medium' | 'strong'
  claims: string[]
}
```

Routing logic:

```text
buildroom = ready to implement or test
verify    = needs source check, reproduction, or evidence
content   = useful for report/story/thread
watch     = interesting but too early
```

Evidence rules:

```text
weak   = one post or unclear source
medium = repo/docs/demo exists
strong = primary docs + working example + clear adoption signal
```

Promotion rule:

```text
Do not silently promote weak evidence to buildroom.
If evidence is weak, route to verify/watch and explain why in blockedReason or rationale.
```

Quality bar for promoted Ideas:

```text
- sourceUrls
- sourceNotePath or runId traceability
- dependencyUrls when present
- targetLane / priority / owner
- verificationStatus / evidenceStrength / claims
- thesis
- why now
- next move
- 2-4 concrete execution steps
```

Quality bar for promoted Experiments:

```text
- sourceUrls
- sourceNotePath or runId traceability
- dependencyUrls when present
- targetLane / priority / owner
- verificationStatus / evidenceStrength / claims
- hypothesis
- first test
- success signal
- kill criteria
- 2-4 concrete execution steps
```

Actions should be concrete, traceable, routed, and evidence-labeled.

Every run-level judgement should include an operator summary:

```ts
type OperatorSummary = {
  whatChanged: string[]
  whatMatters: string[]
  blockers: string[]
  humanReview: string[]
  agentNextActions: string[]
}
```

Generic external-card runs should be judged the same way as X runs, except they may not have X status IDs or first-reply sidecars. Judgement must tolerate generic source URLs.

---

## How skills fit in

Skills are not the database and should not directly own app storage.

Skills/adapters should:

```text
1. Know one source well.
2. Fetch from that source.
3. Normalize into cards[].
4. POST to /api/hermes/ingest.
5. Optionally trigger judgement.
6. Report run id, cards created, files, blockers.
```

The app should:

```text
1. Validate payload.
2. Dedupe within the run.
3. Write raw JSON and markdown files.
4. Maintain latest/recent run status.
5. Expose runs/cards to UI.
6. Accept judgement output.
```

This separation keeps source-specific weirdness out of the app core.

Recommended skill/adapters:

```text
xdoomscroll                 X home feed + replies + x_search enrichment
web-source-ingestion         generic RSS/sitemap/llms.txt/article-list adapter
hermes-atlas-ingestion       Hermes Atlas dedicated adapter
github-trending-ingestion    GitHub Trending/release adapter
hn-ingestion                 Hacker News frontpage/item comments adapter
reddit-ingestion             Subreddit/search adapter
producthunt-ingestion        Product and maker comment adapter
```

---

## Recommended source-adapter contract

Every new source adapter should output this minimal card:

```ts
type NormalizedSourceCard = {
  externalId?: string
  title: string
  body: string
  author?: string
  category?: string
  sourceUrl: string
  canonicalUrl?: string
  urls?: string[]
  metrics?: Record<string, number | string | boolean>
  publishedAt?: string
  tags?: string[]
  raw?: unknown
}
```

Then submit:

```json
{
  "mode": "external",
  "source": "source-name",
  "sourceUrl": "https://source.example/",
  "cards": [],
  "options": {
    "dedupe": true,
    "writeMarkdown": true,
    "judge": false
  }
}
```

---

## Source detection for generic web ingestion

A future generic `web-source-ingestion` adapter should inspect a URL in this order:

```text
1. /rss.xml, /feed.xml, Atom feeds, alternate RSS links
2. /sitemap.xml
3. /llms.txt and /llms-full.txt
4. embedded JSON-LD / schema.org data
5. public JSON data endpoints referenced by the HTML
6. article/list/card DOM extraction
7. browser scroll fallback via WebBridge
```

It should prefer APIs/files over visual browser scraping when available.

Hermes Atlas is the perfect example: because it has JSON/RSS/llms-full files, browser scraping would be lower quality and more brittle.

---

## Run/file layout

Preferred full layout:

```text
.omx/ingestion-runs/
  latest.json
  <runId>.json
  <runId>/
    raw-signals.jsonl          X discovery raw chunks
    status-ids.json            X status IDs
    raw-cards.json             external-card raw request
    normalized-cards.json      external-card normalized output
    enriched/
      <statusId>.json          X search/API enrichment sidecars
    reply-fetch/
      <statusId>.json          browser first-reply sidecars
    merged.json                merged enriched judgement input

Inbox/
Repos/
Use Cases/
Scorio Ideas/
Experiments/
Ideas/
Actions/
```

---

## Operational commands

### Check local ingest service

```bash
curl -s http://localhost:3000/api/hermes/ingest | jq
```

### X smoke test

```bash
cd /Users/yoseph/Documents/AI-Agent-Radar
node --experimental-strip-types scripts/ingest-x-fast.ts \
  --max-cards 12 --rounds 3 --scrolls-per-round 2 --pause-ms 1000
```

### Hermes Atlas dry run

```bash
cd /Users/yoseph/Documents/AI-Agent-Radar
npm run ingest:hermes-atlas -- --max-cards 5 --since-days 7 --dry-run
```

### Hermes Atlas live ingest

```bash
cd /Users/yoseph/Documents/AI-Agent-Radar
npm run ingest:hermes-atlas -- --max-cards 50 --since-days 7
```

### Prepare X sidecars

```bash
node --experimental-strip-types scripts/enrich-x-cards.ts --run latest
```

### Fetch X first replies

```bash
node --experimental-strip-types scripts/fetch-first-replies.ts --run latest --limit 10
```

### Merge X enriched cards

```bash
node --experimental-strip-types scripts/judge-enriched-cards.ts --run latest
```

---

## Architecture decision: API adaptation vs translation bridge

Best answer: use a translation bridge before the app API.

Do not make the app core know every website.

The app API only needs to know:

```text
X live crawl payloads
external normalized cards[] payloads
judgement payloads
```

Everything source-specific belongs in adapters/skills/scripts.

Good split:

```text
X adapter:
  knows X DOM, status URLs, replies, x_search

Hermes Atlas adapter:
  knows rss.xml, repos.json, summaries.json, llms-full.txt

Generic web adapter:
  knows RSS, sitemap, llms.txt, JSON-LD, article DOM

App API:
  knows normalized cards, runs, markdown, judgement
```

---

## Current limitations / next fixes

1. Historical dedupe is shallow.
   - Current external-card dedupe is within the submitted payload.
   - Next: maintain `.omx/ingestion-runs/external-index.json` keyed by `source+externalId`, canonicalUrl, sourceUrl.

2. `options.judge` is recorded but not auto-executed.
   - Next: if `judge: true`, queue or invoke judgement after card write.

3. External-card classification is simple.
   - Current: GitHub URL -> Repos, otherwise Inbox.
   - Next: classify by category/tags/source into Repos, Use Cases, Experiments, Ideas, new-feature-update.

4. Generic web adapter does not exist yet.
   - Hermes Atlas adapter exists as first dedicated external adapter.
   - Next: build generic adapter around RSS/sitemap/llms.txt/JSON-LD.

5. X enrichment with x_search is partially tool-bound.
   - Node scripts prepare sidecars; Hermes tool runs can fill them.
   - Next: either wire an xAI/X API client or keep Hermes as the enrichment executor.

---

## Mental model

Think of Agent Radar as three layers:

```text
1. Collectors / adapters
   - X doomscroll
   - Hermes Atlas
   - RSS
   - GitHub
   - HN / Reddit / Product Hunt

2. Radar app ingestion core
   - normalize
   - dedupe
   - persist runs
   - write markdown cards
   - expose status/UI

3. Judgement/promotions
   - read evidence
   - filter noise
   - promote to Ideas / Experiments / Actions
```

That is the architecture to keep.

Do not create a giant plugin framework yet. Keep each adapter as a simple script/skill that emits `cards[]` into the stable `/api/hermes/ingest` contract.

---

## Research Operator Layer MVP

Status: implemented as MVP on 2026-05-17.

Agent Radar now separates signal capture from research operations:

```text
Ingestion Layer
  raw cards + runs + source markdown

Judgement Layer
  ideas / experiments / actions
  with traceability + evidence + routing fields

Research Operator Layer
  claims registry
  dispatch queue
  operator brief
  action ledger
  lane handoffs

Execution Layer
  buildroom / verify / content / watch
```

Flow:

```text
X / Hermes Atlas / web source
  -> /api/hermes/ingest
  -> raw cards + runId
  -> /api/hermes/judgement
  -> structured judgement payload
  -> Research Operator writer
  -> research-vault + queue artifacts
```

The Research Operator Layer consumes judgement output only. It does not crawl sources itself.

### Judgement evidence and routing fields

`/api/hermes/judgement` accepts these fields on every idea, experiment, and action:

```ts
targetLane?: 'buildroom' | 'verify' | 'content' | 'watch'
priority?: 'high' | 'medium' | 'low'
owner?: 'Hermes' | 'OMX' | 'Yoseph'
blockedReason?: string
verificationStatus?: 'unverified' | 'needs_verification' | 'partially_verified' | 'verified'
evidenceStrength?: 'weak' | 'medium' | 'strong'
claims?: string[]
sourceUrls?: string[]
sourceNotePath?: string
dependencyUrls?: string[]
```

Missing fields are normalized to safe defaults:

```text
targetLane: verify
priority: medium
owner: Hermes
verificationStatus: needs_verification
evidenceStrength: weak
claims: []
```

Promotion rule:

```text
Weak evidence cannot enter buildroom.
```

If a judgement item asks for `targetLane: buildroom` with `evidenceStrength: weak`, the Research Operator writer reroutes it to `verify` or `watch` and records `reroutedReason`.

### Generated artifacts

After every judgement request, the app writes:

```text
research-vault/ops/operator-brief.md
research-vault/ops/action-ledger.md
research-vault/ops/dispatch.json
research-vault/ops/focus.md
research-vault/claims/*.json
research-vault/health/latest-health-check.md
queue/buildroom-handoff.json
queue/verify-handoff.json
queue/content-handoff.json
```

`research-vault/ops/dispatch.json` is the agent-readable routing surface:

```json
{
  "runId": "...",
  "generatedAt": "...",
  "handoffs": {
    "buildroom": [],
    "verify": [],
    "content": [],
    "watch": []
  },
  "blocked": [],
  "needsAttention": []
}
```

Claims are written with stable IDs based on claim statement hash, so repeated runs reinforce existing claims instead of producing timestamp spam.
