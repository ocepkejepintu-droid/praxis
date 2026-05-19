---
type: experiment
stage: worth_trying
status: test
category: llm-judgement
risk: low
confidence: medium
source: Hermes LLM judgement
owner: Hermes
source_urls:
  - https://x.com/mattcassinelli/status/2055054264242991428
  - https://x.com/NickADobos/status/2055037902305001962
run_id: 2026-05-15-04-19-13-334
---

# Hermes mobile readiness probe

## Hypothesis
Before accepting phone-launched tasks, a readiness probe will reduce failed mobile agent runs.

## First test
Create a script that checks Mac awake state, target tmux session, localhost:3000, WebBridge, and active lock status.

## Success signal
Probe catches one blocked run before user sends work from phone.

## Kill criteria
Kill or park this if the first test cannot produce evidence within one day or if the signal depends on unverifiable claims.

## Next actions
- Create a script that checks Mac awake state, target tmux session, localhost:3000, WebBridge, and active lock status.
