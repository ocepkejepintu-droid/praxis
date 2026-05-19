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
source_status_url: "https://hermesatlas.com/projects/NousResearch/Hermes-Function-Calling"
status_id: null
status_identity_status: unresolved
enrichment_status: pending
reply_fetch_status: pending
source: hermes-atlas
externalId: "NousResearch/Hermes-Function-Calling"
sourceUrl: "https://hermesatlas.com/projects/NousResearch/Hermes-Function-Calling"
canonicalUrl: "https://github.com/NousResearch/Hermes-Function-Calling"
author: "NousResearch"
publishedAt: "2026-05-18T09:09:36.048Z"
ingestionMode: external-cards
urls:
  - "https://hermesatlas.com/projects/NousResearch/Hermes-Function-Calling"
  - "https://github.com/NousResearch/Hermes-Function-Calling"
metrics:
  stars: 1249
  official: true
  audit: "pass"
source_urls:
  - https://hermesatlas.com/projects/NousResearch/Hermes-Function-Calling
  - https://github.com/NousResearch/Hermes-Function-Calling
last_checked: 2026-05-18
---

# Hermes-Function-Calling

Source: hermes-atlas
Category: Core & Official
Author: NousResearch

This repository provides the implementation and training data for enabling function calling and structured JSON output in Hermes LLMs, specifically optimized for the Hermes 2 Pro series. It utilizes a recursive inference loop to parse user queries, execute tools via the yfinance library, and return validated data within a ChatML-formatted dialogue. Users can define custom tools using Python decorators or generate structured data objects by integrating Pydantic schemas. The project serves as a reference for building agentic workflows that require reliable financial data retrieval and strict schema adherence. Highlights: Implements recursive function calling using ChatML prompt formatting; Supports structured data generation via Pydantic-based JSON mode; Includes pre-configured tools for retrieving real-time financial and stock data Function calling examples and training data for Hermes LLM models

## Links
- https://hermesatlas.com/projects/NousResearch/Hermes-Function-Calling
- https://github.com/NousResearch/Hermes-Function-Calling

## Metrics
- stars: 1249
- official: true
- audit: pass
