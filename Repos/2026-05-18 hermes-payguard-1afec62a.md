---
type: repo
status: verify
category: "Plugins & Extensions"
risk: high
strategic_relevance: 4
actionability: 4
confidence: medium
ingestion_run_id: 2026-05-18T10-09-41-500-hermes-atlas-external
run_id: 2026-05-18T10-09-41-500-hermes-atlas-external
ingested_at: 2026-05-18T10:09:41.500Z
source_channel: hermes-atlas
source_status_url: "https://hermesatlas.com/projects/nativ3ai/hermes-payguard"
status_id: null
status_identity_status: unresolved
enrichment_status: pending
reply_fetch_status: pending
source: hermes-atlas
externalId: "nativ3ai/hermes-payguard"
sourceUrl: "https://hermesatlas.com/projects/nativ3ai/hermes-payguard"
canonicalUrl: "https://github.com/nativ3ai/hermes-payguard"
author: "nativ3ai"
publishedAt: "2026-04-17T18:17:13.852Z"
ingestionMode: external-cards
urls:
  - "https://hermesatlas.com/projects/nativ3ai/hermes-payguard"
  - "https://github.com/nativ3ai/hermes-payguard"
metrics:
  stars: 4
  official: false
  audit: "pass"
source_urls:
  - https://hermesatlas.com/projects/nativ3ai/hermes-payguard
  - https://github.com/nativ3ai/hermes-payguard
last_checked: 2026-05-18
---

# hermes-payguard

Source: hermes-atlas
Category: Plugins & Extensions
Author: nativ3ai

Hermes PayGuard is a security-focused plugin that enables Hermes Agents to handle USDC and x402 payments through a gated execution model. It separates payment preparation from execution by requiring an out-of-band human approval stamp for transfers exceeding user-defined policy limits. The system supports Circle developer-controlled wallets, cross-chain CCTP transfers, and automated x402 micropayments for paid HTTP fetches. This architecture ensures that while agents can stage financial intents, they cannot unilaterally move significant funds without explicit operator consent. Highlights: Enforces human-in-the-loop approval for high-value USDC transfers; Supports Circle CCTP for cross-chain USDC routing and execution; Automates x402 micropayments below configurable policy thresholds Safe-by-design USDC and x402 payment plugin for Hermes Agent

## Links
- https://hermesatlas.com/projects/nativ3ai/hermes-payguard
- https://github.com/nativ3ai/hermes-payguard

## Metrics
- stars: 4
- official: false
- audit: pass
