---
type: idea
stage: act_now
status: test
category: llm-judgement
strategic_relevance: 5
actionability: 3
risk: medium
confidence: medium
source: Hermes LLM judgement
source_urls:
  - https://x.com/OpenAIDevs/status/2055032115964870838
run_id: 2026-05-15-04-19-13-334
---

# Agent hooks become the standard customization layer

## Thesis
Codex hooks turn validation, secret scanning, logging, and memory creation into first-class extension points; Hermes should match or exceed this.

## Why now
OpenAI Developers is promoting hooks as the way to automate/customize Codex around code.

## Next move
Map Hermes slash/tools/skills to a simple hooks contract: pre-task, post-edit, pre-command, post-run, memory-write.

## Next actions
- Map Hermes slash/tools/skills to a simple hooks contract: pre-task, post-edit, pre-command, post-run, memory-write.
