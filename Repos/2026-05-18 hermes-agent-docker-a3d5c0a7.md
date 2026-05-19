---
type: repo
status: verify
category: "Deployment & Infra"
risk: medium
strategic_relevance: 4
actionability: 4
confidence: medium
ingestion_run_id: 2026-05-18T10-09-41-500-hermes-atlas-external
run_id: 2026-05-18T10-09-41-500-hermes-atlas-external
ingested_at: 2026-05-18T10:09:41.500Z
source_channel: hermes-atlas
source_status_url: "https://hermesatlas.com/projects/xmbshwll/hermes-agent-docker"
status_id: null
status_identity_status: unresolved
enrichment_status: pending
reply_fetch_status: pending
source: hermes-atlas
externalId: "xmbshwll/hermes-agent-docker"
sourceUrl: "https://hermesatlas.com/projects/xmbshwll/hermes-agent-docker"
canonicalUrl: "https://github.com/xmbshwll/hermes-agent-docker"
author: "xmbshwll"
publishedAt: "2026-04-17T18:18:11.811Z"
ingestionMode: external-cards
urls:
  - "https://hermesatlas.com/projects/xmbshwll/hermes-agent-docker"
  - "https://github.com/xmbshwll/hermes-agent-docker"
metrics:
  stars: 6
  official: false
  audit: "pass"
source_urls:
  - https://hermesatlas.com/projects/xmbshwll/hermes-agent-docker
  - https://github.com/xmbshwll/hermes-agent-docker
last_checked: 2026-05-18
---

# hermes-agent-docker

Source: hermes-atlas
Category: Deployment & Infra
Author: xmbshwll

This project provides a minimal Docker sandbox image designed to package and deploy Hermes Agent. It utilizes the official upstream installation script to set up the agent and includes mini-swe-agent within the container. The image supports multi-arch publishing and allows for persistent state management by mounting the agent's home directory. Users can easily build specific versions using build arguments to target different Hermes branches or tags. Highlights: Includes mini-swe-agent and official Hermes installation; Supports persistent state via mounted home directories; Allows building specific Hermes tags using build arguments Simple Docker sandbox image for Hermes Agent

## Links
- https://hermesatlas.com/projects/xmbshwll/hermes-agent-docker
- https://github.com/xmbshwll/hermes-agent-docker

## Metrics
- stars: 6
- official: false
- audit: pass
