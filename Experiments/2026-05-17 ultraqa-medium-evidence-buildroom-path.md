---
type: experiment
stage: queued
status: test
category: llm-judgement
risk: low
confidence: medium
source: Hermes LLM judgement
target_lane: buildroom
priority: medium
owner: OMX
verification_status: partially_verified
evidence_strength: medium
blocked_reason: none
claims:
  - "A medium evidence item can enter buildroom with traceability."
source_urls:
  - https://hermesatlas.com/projects/example/ultraqa-adapter
dependency_urls:
  - https://github.com/example/ultraqa-adapter
source_note_path: Repos/ultraqa-adapter.md
run_id: 2026-05-17T14-54-48-658-hermes-atlas-external
---

# UltraQA medium evidence buildroom path

## Hypothesis
A medium evidence item can enter buildroom with traceability.

## First test
Run one one-hour smoke test and record a learning report.

## Success signal
Learning report contains evidence URLs.

## Kill criteria
Kill or park this if the first test cannot produce evidence within one day or if the signal depends on unverifiable claims.

## Execution path
- Run one one-hour smoke test and record a learning report.

## Source note
Repos/ultraqa-adapter.md

## Dependency / tool URLs
- https://github.com/example/ultraqa-adapter

## Next actions
- Run one one-hour smoke test and record a learning report.
