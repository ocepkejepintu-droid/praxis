---
type: repo
status: verify
category: "Memory & Context"
risk: medium
strategic_relevance: 4
actionability: 4
confidence: medium
ingestion_run_id: 2026-05-18T10-09-41-500-hermes-atlas-external
run_id: 2026-05-18T10-09-41-500-hermes-atlas-external
ingested_at: 2026-05-18T10:09:41.500Z
source_channel: hermes-atlas
source_status_url: "https://hermesatlas.com/projects/stephenschoettler/hermes-lcm"
status_id: null
status_identity_status: unresolved
enrichment_status: pending
reply_fetch_status: pending
source: hermes-atlas
externalId: "stephenschoettler/hermes-lcm"
sourceUrl: "https://hermesatlas.com/projects/stephenschoettler/hermes-lcm"
canonicalUrl: "https://github.com/stephenschoettler/hermes-lcm"
author: "stephenschoettler"
publishedAt: "2026-05-18T09:09:04.000Z"
ingestionMode: external-cards
urls:
  - "https://hermesatlas.com/projects/stephenschoettler/hermes-lcm"
  - "https://github.com/stephenschoettler/hermes-lcm"
metrics:
  stars: 178
  official: false
  audit: "pass"
source_urls:
  - https://hermesatlas.com/projects/stephenschoettler/hermes-lcm
  - https://github.com/stephenschoettler/hermes-lcm
last_checked: 2026-05-18
---

# hermes-lcm

Source: hermes-atlas
Category: Memory & Context
Author: stephenschoettler

Hermes-LCM is a context management plugin for the Hermes Agent that prevents information loss during long-running conversations. It replaces standard lossy compression with a hierarchical Directed Acyclic Graph (DAG) that stores messages in a local SQLite database and generates depth-aware summaries. This architecture allows the agent to maintain a bounded active context while using specialized tools to drill back into specific historical details. The system includes automated controls for externalizing large payloads and filtering noisy sessions to optimize storage and retrieval quality. Highlights: Hierarchical DAG structure for depth-aware context compaction; SQLite-backed message store for persistent raw history retrieval; Agent tools for searching, describing, and expanding compressed context Lossless Context Management plugin for Hermes Agent — DAG-based context engine that never loses a message Hermes-LCM is a context management plugin for the Hermes Agent that prevents information loss during long-running conversations. It replaces standard lossy compression with a hierarchical Directed Acyclic Graph (DAG) that stores messages in a local SQLite database and generates depth-aware summaries. This architecture allows the agent to maintain a bounded active context while using specialized tools to drill back into specific historical details. The system includes automated controls for exter

## Links
- https://hermesatlas.com/projects/stephenschoettler/hermes-lcm
- https://github.com/stephenschoettler/hermes-lcm

## Metrics
- stars: 178
- official: false
- audit: pass
