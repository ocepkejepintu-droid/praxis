---
type: capture
status: watch
category: "agent-infra"
risk: high
strategic_relevance: 3
actionability: 3
confidence: medium
ingestion_run_id: 2026-05-17T16-27-29-499-x-home-grok-factcheck-external
run_id: 2026-05-17T16-27-29-499-x-home-grok-factcheck-external
ingested_at: 2026-05-17T16:27:29.499Z
source_channel: x-home-grok-factcheck
source_status_url: "https://x.com/IcarusHermes/status/2055900844441174235"
status_id: null
status_identity_status: unresolved
enrichment_status: pending
reply_fetch_status: pending
source: x-home-grok-factcheck
externalId: "x-2055900844441174235-grok-oauth-hermes"
sourceUrl: "https://x.com/IcarusHermes/status/2055900844441174235"
author: "@IcarusHermes / @taiyo_ai_gakuse / @jumperz"
ingestionMode: external-cards
urls:
  - "https://x.com/IcarusHermes/status/2055900844441174235"
  - "https://x.com/taiyo_ai_gakuse/status/2055807592824479982"
  - "https://x.com/jumperz/status/2056001174709383457"
  - "https://hermes-agent.nousresearch.com/docs/guides/xai-grok-oauth"
metrics:
  x_search_verified: true
  home_feed_rank: 2
  visible_views: "1.7K"
source_urls:
  - https://x.com/IcarusHermes/status/2055900844441174235
  - https://x.com/taiyo_ai_gakuse/status/2055807592824479982
  - https://x.com/jumperz/status/2056001174709383457
  - https://hermes-agent.nousresearch.com/docs/guides/xai-grok-oauth
last_checked: 2026-05-17
---

# Hermes Grok OAuth + x_search is live enough to use for agent fact-checking

Source: x-home-grok-factcheck
Category: agent-infra
Author: @IcarusHermes / @taiyo_ai_gakuse / @jumperz

Home feed surfaced multiple posts claiming Hermes can use existing Grok credentials/OAuth for x_search without separate API keys. Grok/x_search fact-check confirmed official Hermes Agent xAI Grok OAuth support, live X Search Tool access, and no separate X API key requirement for public search. Strategic angle: Agent Radar can now use trained feed discovery first, then Grok x_search as verification/backfill. Route to buildroom only for integrating this fact-check step into the pipeline; claims are verified by x_search but implementation still needs wiring.

## Links
- https://x.com/IcarusHermes/status/2055900844441174235
- https://x.com/taiyo_ai_gakuse/status/2055807592824479982
- https://x.com/jumperz/status/2056001174709383457
- https://hermes-agent.nousresearch.com/docs/guides/xai-grok-oauth

## Metrics
- x_search_verified: true
- home_feed_rank: 2
- visible_views: 1.7K
