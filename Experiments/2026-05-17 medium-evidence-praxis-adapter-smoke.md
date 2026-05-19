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
  - "A documented adapter can be smoke-tested in one hour."
source_urls:
  - https://hermesatlas.com/projects/example/praxis-adapter
dependency_urls:
  - https://github.com/example/praxis-adapter
source_note_path: Repos/2026-05-17 praxis-adapter.md
run_id: 2026-05-17T14-54-48-658-hermes-atlas-external
---

# Medium evidence Praxis adapter smoke

## Hypothesis
If a repo has docs and examples, OMX can run a one-hour adapter smoke test.

## First test
Run the quickstart and record output in a learning report.

## Success signal
One learning report is created with evidence URLs.

## Kill criteria
Kill or park this if the first test cannot produce evidence within one day or if the signal depends on unverifiable claims.

## Execution path
- Run the quickstart and record output in a learning report.

## Source note
Repos/2026-05-17 praxis-adapter.md

## Dependency / tool URLs
- https://github.com/example/praxis-adapter

## Next actions
- Run the quickstart and record output in a learning report.
