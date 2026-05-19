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
  - https://x.com/steipete
run_id: 2026-05-14-20-52-54-201
---

# Codex review skill

## Hypothesis
A reusable repo-review skill will reduce review time for solo projects by catching obvious risks and missing tests.

## First test
Run it on the latest local diff and compare findings to manual review.

## Success signal
Finds at least one actionable issue or missing verification step without noisy generic advice.

## Kill criteria
Kill or park this if the first test cannot produce evidence within one day or if the signal depends on unverifiable claims.

## Next actions
- Run it on the latest local diff and compare findings to manual review.
