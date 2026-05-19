---
type: repo
status: verify
category: "Core & Official"
risk: medium
strategic_relevance: 4
actionability: 4
confidence: medium
ingestion_run_id: 2026-05-18T10-09-41-500-hermes-atlas-external
run_id: 2026-05-18T10-09-41-500-hermes-atlas-external
ingested_at: 2026-05-18T10:09:41.500Z
source_channel: hermes-atlas
source_status_url: "https://hermesatlas.com/projects/NousResearch/hermes-agent-self-evolution"
status_id: null
status_identity_status: unresolved
enrichment_status: pending
reply_fetch_status: pending
source: hermes-atlas
externalId: "NousResearch/hermes-agent-self-evolution"
sourceUrl: "https://hermesatlas.com/projects/NousResearch/hermes-agent-self-evolution"
canonicalUrl: "https://github.com/NousResearch/hermes-agent-self-evolution"
author: "NousResearch"
publishedAt: "2026-05-01T16:43:58.788Z"
ingestionMode: external-cards
urls:
  - "https://hermesatlas.com/projects/NousResearch/hermes-agent-self-evolution"
  - "https://github.com/NousResearch/hermes-agent-self-evolution"
metrics:
  stars: 778
  official: true
  audit: "pass"
source_urls:
  - https://hermesatlas.com/projects/NousResearch/hermes-agent-self-evolution
  - https://github.com/NousResearch/hermes-agent-self-evolution
last_checked: 2026-05-18
---

# hermes-agent-self-evolution

Source: hermes-atlas
Category: Core & Official
Author: NousResearch

Hermes Agent Self-Evolution is an automated optimization framework designed to improve the performance of Hermes Agent without requiring GPU training. It utilizes DSPy and Genetic-Pareto Prompt Evolution (GEPA) to analyze execution traces and mutate skill files, tool descriptions, and system prompts based on reflective feedback. The system validates candidate variants through constraint gates, including size limits and full test suite passes, before proposing improvements via pull requests. It supports evaluation using both synthetic data and real session history from tools like Claude Code and Copilot. Highlights: Optimizes agent skills and prompts using DSPy and GEPA engines; Operates via API calls without requiring local GPU resources; Enforces strict guardrails including size limits and 100% test pass rates Evolutionary self-improvement using DSPy + GEPA — optimizes skills, prompts, and code

## Links
- https://hermesatlas.com/projects/NousResearch/hermes-agent-self-evolution
- https://github.com/NousResearch/hermes-agent-self-evolution

## Metrics
- stars: 778
- official: true
- audit: pass
