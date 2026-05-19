---
type: idea
stage: worth_trying
status: watch
category: llm-judgement
strategic_relevance: 4
actionability: 4
risk: medium
confidence: medium
source: Hermes LLM judgement
source_urls:
  - https://x.com/neil_xbt/status/2055168802036576600
  - https://x.com/PawelHuryn
dependency_urls:
  - https://n8n.io/
  - https://docs.n8n.io/
source_note_path: Inbox/2026-05-15 x-signal-neilxbt-neil-xbt-2h-n8n-could-easily-charge-10-000-for-this-automation.md
run_id: 2026-05-15-09-09-38-986
---

# Turn n8n competitor-monitoring agents into an Agent Radar template

## Thesis
The n8n training signal points to an obvious productized workflow: competitor/update monitoring agents that turn public web changes into action queues, not dashboards.

## Why now
The source says free n8n automation training covers competitor monitoring, replacing repetitive workflows, and multi-agent research. Agent Radar already has ingestion + judgement plumbing, so this can be cloned into a narrow template quickly.

## Next move
Build a one-page n8n-style competitor monitor spec for Scorio/Agent Radar and test it against 5 competitor/product URLs.

## Execution path
- Define 5 URLs to monitor and 3 change types worth alerting on: launch, pricing, integration/docs change.
- Create a simple poller that saves diffs and asks Hermes to judge only concrete changes.
- Emit one action queue item per verified change with source URL and diff snippet.
- If useful, port the flow to n8n or keep it as a lightweight Hermes script.

## Source note
Inbox/2026-05-15 x-signal-neilxbt-neil-xbt-2h-n8n-could-easily-charge-10-000-for-this-automation.md

## Dependency / tool URLs
- https://n8n.io/
- https://docs.n8n.io/

## Next actions
- Build a one-page n8n-style competitor monitor spec for Scorio/Agent Radar and test it against 5 competitor/product URLs.
