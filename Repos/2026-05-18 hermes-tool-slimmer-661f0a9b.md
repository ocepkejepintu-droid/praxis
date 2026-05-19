---
type: repo
status: verify
category: "Memory & Context"
risk: high
strategic_relevance: 4
actionability: 4
confidence: medium
ingestion_run_id: 2026-05-18T10-09-41-500-hermes-atlas-external
run_id: 2026-05-18T10-09-41-500-hermes-atlas-external
ingested_at: 2026-05-18T10:09:41.500Z
source_channel: hermes-atlas
source_status_url: "https://hermesatlas.com/projects/alias8818/hermes-tool-slimmer"
status_id: null
status_identity_status: unresolved
enrichment_status: pending
reply_fetch_status: pending
source: hermes-atlas
externalId: "alias8818/hermes-tool-slimmer"
sourceUrl: "https://hermesatlas.com/projects/alias8818/hermes-tool-slimmer"
canonicalUrl: "https://github.com/alias8818/hermes-tool-slimmer"
author: "alias8818"
publishedAt: "2026-05-18T09:09:04.000Z"
ingestionMode: external-cards
urls:
  - "https://hermesatlas.com/projects/alias8818/hermes-tool-slimmer"
  - "https://github.com/alias8818/hermes-tool-slimmer"
metrics:
  stars: 4
  official: false
  audit: "pass"
source_urls:
  - https://hermesatlas.com/projects/alias8818/hermes-tool-slimmer
  - https://github.com/alias8818/hermes-tool-slimmer
last_checked: 2026-05-18
---

# hermes-tool-slimmer

Source: hermes-atlas
Category: Memory & Context
Author: alias8818

Hermes Tool Slimmer is a context-optimization plugin that reduces prompt overhead by dynamically filtering large tool catalogs into a smaller, relevant subset. It builds an indexable corpus from Hermes tool schemas and ranks them using local BM25 keyword selection and explicit boosts. This process can significantly decrease the token footprint of requests in environments with dozens of native or MCP tools. The project includes a dashboard for monitoring estimated token savings and provides a fail-safe mechanism that reverts to the full schema list if errors occur. Highlights: Reduces schema overhead using BM25 keyword ranking and explicit boosts.; Supports Anthropic Tool Search and deferred tool loading modes.; Includes a dashboard plugin for tracking estimated token savings. Reduce Hermes Agent tool-schema overhead with keyword selection and Tool Search support Hermes Tool Slimmer is a context-optimization plugin that reduces prompt overhead by dynamically filtering large tool catalogs into a smaller, relevant subset. It builds an indexable corpus from Hermes tool schemas and ranks them using local BM25 keyword selection and explicit boosts. This process can significantly decrease the token footprint of requests in environments with dozens of native or MCP tools. The project includes a dashboard for monitoring estimated token savings and provides a fai

## Links
- https://hermesatlas.com/projects/alias8818/hermes-tool-slimmer
- https://github.com/alias8818/hermes-tool-slimmer

## Metrics
- stars: 4
- official: false
- audit: pass
