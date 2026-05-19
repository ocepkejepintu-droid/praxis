---
type: experiment
stage: queued
status: test
category: llm-judgement
risk: low
confidence: medium
source: Hermes LLM judgement
owner: Hermes
source_urls:
  - https://x.com/neil_xbt/status/2055168802036576600
dependency_urls:
  - https://n8n.io/
  - https://docs.n8n.io/
source_note_path: Inbox/2026-05-15 x-signal-neilxbt-neil-xbt-2h-n8n-could-easily-charge-10-000-for-this-automation.md; run 2026-05-15-09-09-38-986
run_id: 2026-05-15-09-09-38-986
---

# n8n-style multi-agent research flow for competitor updates

## Hypothesis
A simple multi-agent research workflow can convert competitor/product monitoring into higher-quality Agent Radar actions than raw X doomscroll cards.

## First test
Create a 5-source monitor that detects one product update and has Hermes write a sourced action with kill/next-step fields.

## Success signal
Within one day, it finds at least one real update with source URL, evidence snippet, and a concrete next action worth saving.

## Kill criteria
Kill if it produces duplicate noise, misses source URLs, or cannot generate one useful action from 5 monitored sources in a day.

## Execution path
- Choose 5 agent-tool/product pages to monitor.
- Poll them once, store source snapshots, and diff against the next run.
- Ask Hermes to judge only changed evidence and emit one action.
- Review whether the action is more useful than the raw X card.

## Source note
Inbox/2026-05-15 x-signal-neilxbt-neil-xbt-2h-n8n-could-easily-charge-10-000-for-this-automation.md; run 2026-05-15-09-09-38-986

## Dependency / tool URLs
- https://n8n.io/
- https://docs.n8n.io/

## Next actions
- Create a 5-source monitor that detects one product update and has Hermes write a sourced action with kill/next-step fields.
