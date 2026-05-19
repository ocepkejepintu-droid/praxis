---
type: repo
status: verify
category: "Skills & Skill Registries"
risk: high
strategic_relevance: 4
actionability: 4
confidence: medium
ingestion_run_id: 2026-05-18T10-09-41-500-hermes-atlas-external
run_id: 2026-05-18T10-09-41-500-hermes-atlas-external
ingested_at: 2026-05-18T10:09:41.500Z
source_channel: hermes-atlas
source_status_url: "https://hermesatlas.com/projects/cablate/Agentic-MCP-Skill"
status_id: null
status_identity_status: unresolved
enrichment_status: pending
reply_fetch_status: pending
source: hermes-atlas
externalId: "cablate/Agentic-MCP-Skill"
sourceUrl: "https://hermesatlas.com/projects/cablate/Agentic-MCP-Skill"
canonicalUrl: "https://github.com/cablate/Agentic-MCP-Skill"
author: "cablate"
publishedAt: "2026-05-18T09:10:19.173Z"
ingestionMode: external-cards
urls:
  - "https://hermesatlas.com/projects/cablate/Agentic-MCP-Skill"
  - "https://github.com/cablate/Agentic-MCP-Skill"
metrics:
  stars: 22
  official: false
  audit: "pass"
source_urls:
  - https://hermesatlas.com/projects/cablate/Agentic-MCP-Skill
  - https://github.com/cablate/Agentic-MCP-Skill
last_checked: 2026-05-18
---

# Agentic-MCP-Skill

Source: hermes-atlas
Category: Skills & Skill Registries
Author: cablate

Agentic-MCP-Skill is an experimental MCP client and daemon designed to optimize token consumption through a three-layer lazy loading architecture. It implements the AgentSkills.io pattern by progressively disclosing server metadata, tool lists, and specific schemas only when requested by the agent. This approach reduces context window overhead by up to 86% compared to loading full tool definitions upfront. The project includes a socket-based daemon for persistent server connections and a CLI for managing tools like Playwright and filesystem access. Highlights: Three-layer progressive disclosure reduces context token usage; Socket-based daemon maintains persistent MCP server connections; Hot-reload support for dynamic configuration without daemon restarts Progressive MCP client with three-layer lazy loading — validates agentskills.io pattern

## Links
- https://hermesatlas.com/projects/cablate/Agentic-MCP-Skill
- https://github.com/cablate/Agentic-MCP-Skill

## Metrics
- stars: 22
- official: false
- audit: pass
