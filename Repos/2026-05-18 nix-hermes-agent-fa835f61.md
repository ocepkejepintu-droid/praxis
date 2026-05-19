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
source_status_url: "https://hermesatlas.com/projects/0xrsydn/nix-hermes-agent"
status_id: null
status_identity_status: unresolved
enrichment_status: pending
reply_fetch_status: pending
source: hermes-atlas
externalId: "0xrsydn/nix-hermes-agent"
sourceUrl: "https://hermesatlas.com/projects/0xrsydn/nix-hermes-agent"
canonicalUrl: "https://github.com/0xrsydn/nix-hermes-agent"
author: "0xrsydn"
publishedAt: "2026-04-17T18:17:59.605Z"
ingestionMode: external-cards
urls:
  - "https://hermesatlas.com/projects/0xrsydn/nix-hermes-agent"
  - "https://github.com/0xrsydn/nix-hermes-agent"
metrics:
  stars: 11
  official: false
  audit: "pass"
source_urls:
  - https://hermesatlas.com/projects/0xrsydn/nix-hermes-agent
  - https://github.com/0xrsydn/nix-hermes-agent
last_checked: 2026-05-18
---

# nix-hermes-agent

Source: hermes-atlas
Category: Deployment & Infra
Author: 0xrsydn

nix-hermes-agent provides a Nix package and NixOS module for the declarative deployment of Hermes Agent. It allows users to manage the entire agent lifecycle—including configuration, workspace documents, and systemd services—through a single Nix configuration file. The module ensures reproducibility by rendering settings into a structured CLI configuration while keeping sensitive API keys secure via external environment files. It supports both Nix-managed declarative skills and native Hermes CLI interactive skills, providing a stable foundation for production-ready agent infrastructure. Highlights: Declarative management of agent config, documents, and systemd services; Secure secrets handling via systemd EnvironmentFiles and sops-nix integration; Hybrid skill support for both Nix-managed and interactive CLI installs Nix package and NixOS module for reproducible Hermes deployment

## Links
- https://hermesatlas.com/projects/0xrsydn/nix-hermes-agent
- https://github.com/0xrsydn/nix-hermes-agent

## Metrics
- stars: 11
- official: false
- audit: pass
