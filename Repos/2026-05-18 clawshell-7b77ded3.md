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
source_status_url: "https://hermesatlas.com/projects/clawshell/clawshell"
status_id: null
status_identity_status: unresolved
enrichment_status: pending
reply_fetch_status: pending
source: hermes-atlas
externalId: "clawshell/clawshell"
sourceUrl: "https://hermesatlas.com/projects/clawshell/clawshell"
canonicalUrl: "https://github.com/clawshell/clawshell"
author: "clawshell"
publishedAt: "2026-05-18T09:09:04.000Z"
ingestionMode: external-cards
urls:
  - "https://hermesatlas.com/projects/clawshell/clawshell"
  - "https://github.com/clawshell/clawshell"
metrics:
  stars: 255
  official: false
  audit: "pass"
source_urls:
  - https://hermesatlas.com/projects/clawshell/clawshell
  - https://github.com/clawshell/clawshell
last_checked: 2026-05-18
---

# clawshell

Source: hermes-atlas
Category: Plugins & Extensions
Author: clawshell

ClawShell is a security-privileged process that acts as a safety harness for the Hermes Agent ecosystem by protecting sensitive credentials and PII. It functions as a proxy between the agent and upstream LLM providers, swapping virtual keys for real ones stored in a restricted directory to ensure the agent never has direct access to credentials. The system performs Data Loss Prevention (DLP) scanning to redact or block sensitive information in request and response bodies. Additionally, it provides secure email isolation through IMAP sender filtering and supports OAuth-based authentication for providers like OpenAI. Highlights: Maps virtual keys to real credentials stored in protected Unix directories; Scans and redacts PII in request and response bodies via regex; Enforces sender-based email filtering for secure mailbox access The Runtime Security Layer for OpenClaw/Hermes-agent, the essential safety harness for PII & sensitive credentials protection. ClawShell is a security-privileged process that acts as a safety harness for the Hermes Agent ecosystem by protecting sensitive credentials and PII. It functions as a proxy between the agent and upstream LLM providers, swapping virtual keys for real ones stored in a restricted directory to ensure the agent never has direct access to credentials. The system performs Data Loss Prevention (DLP) scanning to redact or block sensitive information in request and response bodies. Additionally, it provid

## Links
- https://hermesatlas.com/projects/clawshell/clawshell
- https://github.com/clawshell/clawshell

## Metrics
- stars: 255
- official: false
- audit: pass
