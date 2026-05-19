# Agent Radar Ingestion Evolution Notes

Date: 2026-05-17
Author: Hermes Dev
Context: X doomscroll / Kimi WebBridge / x_search hybrid ingestion for Agent Radar.

## Executive summary

We changed the ingestion philosophy from:

`one long browser crawl -> write cards at the end`

to:

`browser writes small persisted markdown/raw chunks -> sidecar enrichment -> first-reply/media fetch -> merge/judgement`.

Reason: Kimi WebBridge is reliable for short browser extraction rounds but unreliable for long `evaluate` sessions that also open replies. Long sessions produced stale tabs / unexpected tool_result and could lose the whole run before cards were written.

The app should now treat ingestion as a staged pipeline with checkpoints and sidecars, not a single request/response crawl.

## What changed during implementation

### 1. Browser ingestion became fast and incremental

Created:

```text
scripts/ingest-x-fast.ts
```

Purpose:
- Discover posts from Yoseph's trained X home feed.
- Preserve home-feed order.
- Capture visible tweet text, authors, status URLs, visible external links, and visible media hints.
- Write markdown cards after each short round.

Important behavior:
- Uses short Kimi WebBridge `evaluate` calls.
- Does not open first replies during the main doomscroll.
- Writes progress every round via `.omx/ingestion-runs/latest.json`.
- If browser/bridge dies mid-run, already-written markdown remains usable.

Tested command:

```bash
cd /Users/yoseph/Documents/AI-Agent-Radar
node --experimental-strip-types scripts/ingest-x-fast.ts \
  --max-cards 30 --rounds 6 --scrolls-per-round 2 --pause-ms 1500
```

Observed result:
- 35 unique signals
- 30 cards written
- 10 scrolls completed
- runtime ~21.6s

Smoke command:

```bash
cd /Users/yoseph/Documents/AI-Agent-Radar
node --experimental-strip-types scripts/ingest-x-fast.ts \
  --max-cards 12 --rounds 3 --scrolls-per-round 2 --pause-ms 1000
```

Observed result:
- 16 unique signals
- 12 cards written
- runtime ~11s

### 2. Enrichment is now sidecar-first

Created:

```text
scripts/enrich-x-cards.ts
```

Purpose:
- Read latest run markdown cards.
- Extract status URLs/IDs from card markdown.
- Create one sidecar JSON per status ID:

```text
.omx/ingestion-runs/<runId>/enriched/<statusId>.json
```

Sidecar contains:
- runId
- sourceCard path
- status handle/id/url
- browserExternalLinks
- xSearch pending payload:
  - query: `conversation_id:<statusId>`
  - enable_image_understanding: true
- replyFetch state

Current limitation:
- `x_search` is a Hermes tool, not a local Node API, so Node cannot directly call it unless the app gets app-level xAI/X credentials or a Hermes tool bridge.
- For now this script prepares sidecars for the agent/tool to fill.

### 3. First-reply/comment link fetching is separate

Created:

```text
scripts/fetch-first-replies.ts
```

Purpose:
- Open selected status URLs after markdown exists.
- Inspect the first visible tweet/reply articles.
- Extract hidden links and raw media URLs that were not visible in the home feed.

Output:

```text
.omx/ingestion-runs/<runId>/reply-fetch/<statusId>.json
```

Captures:
- reply rank
- reply author
- reply text
- all URLs
- external links
- raw media URLs / video thumbnails / image alt text

Observed result on latest test:
- status 2055384989798224264: 0 links, 6 media
- status 2055620345923871213: 1 link, 10 media
- status 2055648903731556475: 1 link, 5 media

This solves the "repo/demo/docs link is in first comment" problem better than x_search alone.

### 4. Merge/judgement scaffold now reads persisted materials

Created:

```text
scripts/judge-enriched-cards.ts
```

Purpose:
- Merge markdown + enrichment sidecars + reply-fetch results.
- Bucket cards into rough categories.
- Write merged machine-readable output:

```text
.omx/ingestion-runs/<runId>/merged.json
```

Current buckets:
- experiment
- idea
- new-feature-update
- scorio
- ignore
- inbox

Observed result on short test:
- 10 merged status IDs
- 6 experiments
- 3 ideas
- 1 new-feature-update

This is a scaffold. Final judgement should be LLM-backed and follow the existing Agent Radar quality bar.

## New stable pipeline

```bash
cd /Users/yoseph/Documents/AI-Agent-Radar

# 1. Browser discovery / markdown persistence
node --experimental-strip-types scripts/ingest-x-fast.ts \
  --max-cards 30 --rounds 6 --scrolls-per-round 2 --pause-ms 1500

# 2. Prepare metadata sidecars from markdown
node --experimental-strip-types scripts/enrich-x-cards.ts --run latest

# 3. Fetch first replies/comments for hidden links/media
node --experimental-strip-types scripts/fetch-first-replies.ts --run latest --limit 10

# 4. Merge + rough judgement buckets
node --experimental-strip-types scripts/judge-enriched-cards.ts --run latest
```

For production ~300-card discovery:

```bash
node --experimental-strip-types scripts/ingest-x-fast.ts \
  --max-cards 300 --rounds 40 --scrolls-per-round 2 --pause-ms 1500
```

Estimated full pipeline:
- browser discovery: 6-10 minutes realistic
- first-reply fetch for selected posts: depends on limit, roughly 4-8 sec/post
- x_search enrichment: 15-30 minutes if every status gets full conversation/media enrichment
- judgement: a few minutes

## Why app/API changes are needed

The app currently treats ingestion too much like a single action. The new model is staged and resumable.

The API should expose pipeline stages and status instead of one opaque long request.

Recommended API stages:

```text
discover
prepare_enrichment
fetch_replies
x_search_enrich
merge
judge
```

Recommended endpoints:

```text
POST /api/hermes/ingest
GET  /api/hermes/ingest/latest
GET  /api/hermes/ingest/:runId
POST /api/hermes/ingest/:runId/enrich
POST /api/hermes/ingest/:runId/replies
POST /api/hermes/ingest/:runId/x-search
POST /api/hermes/ingest/:runId/merge
POST /api/hermes/ingest/:runId/judge
GET  /api/hermes/ingest/:runId/cards
```

The API should return immediately with a runId, then update progress as each stage runs.

## Run manifest shape requested from app

`latest.json` / `<runId>.json` should eventually look like:

```json
{
  "id": "2026-05-17-...",
  "source": "home",
  "status": "running|ok|partial|failed",
  "stage": "discover|prepare_enrichment|fetch_replies|x_search_enrich|merge|judge",
  "progress": {
    "roundsCompleted": 5,
    "scrollsCompleted": 10,
    "rawSignals": 35,
    "cardsWritten": 30,
    "statusIds": 10,
    "replyFetched": 3,
    "xSearchEnriched": 0,
    "merged": 10,
    "judged": 10
  },
  "paths": {
    "rawSignals": ".omx/ingestion-runs/<runId>/raw-signals.jsonl",
    "statusIds": ".omx/ingestion-runs/<runId>/status-ids.json",
    "enrichedDir": ".omx/ingestion-runs/<runId>/enriched",
    "replyFetchDir": ".omx/ingestion-runs/<runId>/reply-fetch",
    "merged": ".omx/ingestion-runs/<runId>/merged.json",
    "cards": []
  },
  "errors": []
}
```

## What the bridge side should support

Kimi/WebBridge usage should follow these constraints:

- Short `evaluate` calls only, ideally <45-60 seconds.
- No long async loops that browse many posts before returning.
- Discovery tab and reply-fetch tab/session should be separate logical sessions.
- On stale tab:
  1. `find_tab`
  2. `navigate`
  3. retry only the current round
- On extension disconnect:
  - mark run as `partial`
  - preserve existing cards/sidecars
  - allow resume

App should not assume a killed browser crawl means zero usable data.

## What the x_search/API side should support

Best product version: add app-level xAI/X search credentials so Next API can run enrichment without Hermes manually filling sidecars.

Suggested env:

```env
XAI_API_KEY=...
AGENT_RADAR_X_SEARCH_ENABLED=true
```

For each discovered status ID, run:

```text
conversation_id:<statusId>
```

with image understanding enabled.

Store result in:

```text
.omx/ingestion-runs/<runId>/enriched/<statusId>.json
```

Fields wanted:
- canonical text/summary
- author metadata
- public metrics where available
- conversation/thread summary
- reply URLs surfaced
- quoted/reposted status context
- image/video descriptions
- model/tool/provider used
- fetchedAt
- error if failed

## What markdown cards should evolve to include

Current markdown cards are enough for discovery, but final enriched cards should include:

```md
## Browser Capture
- Home feed rank
- Original visible text
- Visible links
- Visible media URLs / alt text

## First Replies / Comments
- Top reply text
- Links found in replies
- Repo/demo/docs links

## X Search Enrichment
- Canonical summary
- Conversation summary
- Metrics where available
- Image/video descriptions

## Resolved Links
- GitHub repo
- Website/demo
- Docs
- Paper
- Video/demo
- Media URLs

## Judgement
- Bucket
- Why it matters
- Next action
```

Frontmatter should eventually include:

```yaml
run_id:
status_id:
status_url:
discovery_source: home_feed
home_feed_rank:
enrichment_status: pending|partial|complete
reply_fetch_status: pending|ok|failed
media_count:
external_link_count:
bucket:
```

## URL resolver requirement

Add a resolver stage after browser + reply fetch:

- expand `t.co`
- normalize URLs
- dedupe URLs
- classify links:
  - github_repo
  - docs
  - product_site
  - demo
  - paper
  - youtube/video
  - media
  - spam

This is needed because many real project links are hidden behind `t.co` or first-comment links.

## What app UI should show

Dashboard should expose:

- latest run stage
- cards written
- status IDs found
- first-reply links recovered
- media items recovered
- x_search enriched count
- merged count
- judgement buckets
- stage errors

Add buttons:

```text
Run 30-card test
Run 300-card discovery
Prepare enrichment
Fetch first replies
Run x_search enrichment
Merge
Judge
Open latest merged output
```

## Codex follow-up: bridge ingestion into agent layer/date dashboard

Checked: 2026-05-17
Reviewer: Codex

Hermes' staged ingestion direction is correct. Before building the MCP/ACP agent layer, the app needs one clean run/date spine so humans and agents can answer:

- What came from the latest ingestion?
- Which cards belong to which run?
- Which source post produced this idea/experiment/action?
- Which run has already been enriched, merged, judged, or promoted?

Current repo state:

- `scripts/ingest-x-fast.ts` exists and writes progress to `.omx/ingestion-runs/latest.json`.
- `scripts/enrich-x-cards.ts`, `scripts/fetch-first-replies.ts`, and `scripts/judge-enriched-cards.ts` exist as separate staged sidecars.
- `.omx/ingestion-runs/<runId>/merged.json` exists for enriched/judged materials.
- `src/app/api/hermes/judgement/route.ts` already writes `run_id` for Hermes LLM-created ideas/experiments/actions.
- Raw ingestion markdown cards still need stronger per-card run metadata so the app can group by run/date reliably.

Required before agent layer:

1. Add run metadata to every newly written markdown card:

```yaml
ingestion_run_id: <runId>
ingested_at: <ISO timestamp>
source_channel: x_home | x_search
source_status_url: https://x.com/<handle>/status/<id>
status_id: <id>
```

2. Evolve run status from simple latest/history into a staged manifest:

```json
{
  "id": "2026-05-17-...",
  "source": "home",
  "status": "running|ok|partial|failed",
  "stage": "discover|prepare_enrichment|fetch_replies|x_search_enrich|merge|judge",
  "progress": {
    "rawSignals": 35,
    "cardsWritten": 30,
    "statusIds": 10,
    "replyFetched": 3,
    "xSearchEnriched": 0,
    "merged": 10,
    "judged": 10
  },
  "paths": {
    "rawSignals": ".omx/ingestion-runs/<runId>/raw-signals.jsonl",
    "statusIds": ".omx/ingestion-runs/<runId>/status-ids.json",
    "enrichedDir": ".omx/ingestion-runs/<runId>/enriched",
    "replyFetchDir": ".omx/ingestion-runs/<runId>/reply-fetch",
    "merged": ".omx/ingestion-runs/<runId>/merged.json",
    "cards": []
  },
  "errors": []
}
```

3. Add a date/run dashboard before MCP:

- `/radar/runs` or expanded `/ingestion`: latest successful run, grouped by date, stage health, files written, gaps.
- `/radar/runs/[runId]`: exact run detail, generated cards, merged output, buckets, source posts, recovered links/media.
- Diff mode: new since previous run, duplicates, promoted ideas/experiments.

4. Then expose the same run/date spine to agents:

- `GET /api/agent/report?date=&runId=`
- `GET /api/agent/signals?date=&runId=&q=&category=`
- `GET /api/agent/experiments/candidates?date=&runId=`
- `GET /api/agent/notes/[slug]`
- `POST /api/agent/notes`
- `POST /api/agent/decisions`

5. MCP/ACP should consume the date/run spine, not bypass it:

- MCP resources: `agent-radar://runs/latest`, `agent-radar://runs/{runId}`, `agent-radar://dates/{yyyy-mm-dd}`, `agent-radar://experiments/candidates`, `agent-radar://notes/{slug}`.
- MCP tools: `get_report_brief`, `search_real_world_use_cases`, `get_signal_detail`, `rank_experiment_candidates`, `create_experiment`, `record_experiment_result`.
- ACP events: `x_ingested`, `signals_ranked`, `experiment_proposed`, `experiment_selected`, `experiment_created`, `experiment_result`, `experiment_killed`, `experiment_adopted`.

Product invariant:

The human UI and agent layer must use the same source trail. If a human sees a card, an agent must be able to retrieve the same card, source URL, run ID, enrichment state, and experiment path.

## Current known limitation

`x_search` enrichment is not fully automated in Node yet because `x_search` is currently a Hermes tool, not a local script API. The app needs either:

1. direct xAI/X API integration, or
2. a Hermes tool bridge endpoint that the app can call, or
3. keep Hermes agent as the enrichment runner that fills sidecars.

## Invariant

Disk owns the run. Browser only emits small chunks.

Every stage must be resumable and idempotent.

If Chrome/Kimi dies, already-written markdown and sidecars remain valid input for enrichment and judgement.
