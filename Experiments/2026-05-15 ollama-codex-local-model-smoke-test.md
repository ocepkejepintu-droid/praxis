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
  - https://x.com/ollama/status/2055100589428658462
run_id: 2026-05-15-04-19-13-334
---

# Ollama Codex local-model smoke test

## Hypothesis
Local model support can cover cheap/simple coding tasks while preserving privacy.

## First test
Run one trivial code edit via Codex app using Ollama open model, record latency and quality.

## Success signal
Local model completes a small edit without paid API routing.

## Kill criteria
Kill or park this if the first test cannot produce evidence within one day or if the signal depends on unverifiable claims.

## Next actions
- Run one trivial code edit via Codex app using Ollama open model, record latency and quality.
