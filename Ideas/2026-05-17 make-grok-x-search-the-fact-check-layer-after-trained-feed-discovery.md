---
type: idea
stage: act_now
status: test
category: llm-judgement
strategic_relevance: 5
actionability: 4
risk: medium
confidence: medium
source: Hermes LLM judgement
target_lane: buildroom
priority: high
owner: Hermes
verification_status: verified
evidence_strength: strong
blocked_reason: none
claims:
  - "Hermes Agent supports xAI Grok OAuth."
  - "x_search can be used from the current Hermes session."
  - "Public X search does not require separate X API keys when using the configured Grok OAuth path."
source_urls:
  - https://x.com/IcarusHermes/status/2055900844441174235
  - https://x.com/taiyo_ai_gakuse/status/2055807592824479982
  - https://x.com/jumperz/status/2056001174709383457
dependency_urls:
  - https://hermes-agent.nousresearch.com/docs/guides/xai-grok-oauth
source_note_path: Inbox/2026-05-17 hermes-grok-oauth-x-search-is-live-enough-to-use-for-agent-fact-checking-9e0f7b8.md
run_id: 2026-05-17T16-27-29-499-x-home-grok-factcheck-external
---

# Make Grok/x_search the fact-check layer after trained-feed discovery

## Thesis
Discovery should remain Yoseph’s trained home feed, but claims can be verified with Grok/x_search before routing to buildroom.

## Why now
Home feed and x_search both confirmed Hermes Grok OAuth/x_search usage without separate X API keys.

## Next move
Add an enrichment step that fills pending sidecars with x_search answer/citations for extracted status IDs.

## Execution path
- Extract status URLs from cards
- Run x_search for each promoted claim
- Write xSearch.answer/citations into sidecars
- Route weak/uncited claims to verify/watch

## Source note
Inbox/2026-05-17 hermes-grok-oauth-x-search-is-live-enough-to-use-for-agent-fact-checking-9e0f7b8.md

## Dependency / tool URLs
- https://hermes-agent.nousresearch.com/docs/guides/xai-grok-oauth

## Next actions
- Add an enrichment step that fills pending sidecars with x_search answer/citations for extracted status IDs.
