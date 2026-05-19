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
source_status_url: "https://hermesatlas.com/projects/elkimek/honcho-self-hosted"
status_id: null
status_identity_status: unresolved
enrichment_status: pending
reply_fetch_status: pending
source: hermes-atlas
externalId: "elkimek/honcho-self-hosted"
sourceUrl: "https://hermesatlas.com/projects/elkimek/honcho-self-hosted"
canonicalUrl: "https://github.com/elkimek/honcho-self-hosted"
author: "elkimek"
publishedAt: "2026-04-17T18:16:39.713Z"
ingestionMode: external-cards
urls:
  - "https://hermesatlas.com/projects/elkimek/honcho-self-hosted"
  - "https://github.com/elkimek/honcho-self-hosted"
metrics:
  stars: 126
  official: false
  audit: "pass"
source_urls:
  - https://hermesatlas.com/projects/elkimek/honcho-self-hosted
  - https://github.com/elkimek/honcho-self-hosted
last_checked: 2026-05-18
---

# honcho-self-hosted

Source: hermes-atlas
Category: Memory & Context
Author: elkimek

This project provides a configuration layer for self-hosting Plastic Labs' Honcho memory backend, enabling cross-session persistence for Hermes Agent without relying on third-party cloud storage. It deploys the full Honcho stack—including the API, PostgreSQL with pgvector, and Redis—on local hardware using Docker Compose. Users can route memory extraction and reasoning tasks through any OpenAI-compatible API or local inference servers like Ollama to maintain data sovereignty. This setup allows Hermes to build long-term user profiles and logical observations while keeping conversation data on the user's own infrastructure. Highlights: Enables private cross-session memory for Hermes Agent via self-hosting; Supports any OpenAI-compatible LLM provider or local inference servers; Includes automated setup script for Docker, PostgreSQL, and Redis Self-hosted Honcho memory backend for cross-session persistence

## Links
- https://hermesatlas.com/projects/elkimek/honcho-self-hosted
- https://github.com/elkimek/honcho-self-hosted

## Metrics
- stars: 126
- official: false
- audit: pass
