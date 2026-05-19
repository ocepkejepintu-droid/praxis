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
  - https://x.com/Dimillian/status/2055031923240493436
  - https://x.com/nickbaumann_/status/2055066537002725393
run_id: 2026-05-15-03-55-14-363
---

# Phone-to-OMX command queue

## Hypothesis
Yoseph can run more work from mobile if Hermes can queue a task into an existing OMX session and return a concise done/blocker report.

## First test
Implement one command path: WhatsApp/Telegram text -> select AI-Agent-Radar OMX session -> tmux send command -> poll summary.

## Success signal
One task launched and summarized from phone without opening laptop.

## Kill criteria
Kill or park this if the first test cannot produce evidence within one day or if the signal depends on unverifiable claims.

## Next actions
- Implement one command path: WhatsApp/Telegram text -> select AI-Agent-Radar OMX session -> tmux send command -> poll summary.
