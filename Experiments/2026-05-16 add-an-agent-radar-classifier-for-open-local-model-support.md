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
  - https://x.com/steipete/status/2055421654486921480
dependency_urls:
  - pending
source_note_path: /Users/yoseph/Documents/AI-Agent-Radar/Inbox/2026-05-16 x-signal-peter-steinberger-steipete-11h-are-you-sure-everything-i-build-is-open.md
run_id: 2026-05-16-10-10-31-599
---

# Add an Agent Radar classifier for open/local-model support

## Hypothesis
Classifying agent-product cards by model portability will surface more durable infrastructure opportunities than generic launch hype.

## First test
Patch judgement prompt/schema locally to tag future cards with model-portability: proprietary, BYO model, local/open, unknown.

## Success signal
After one week, at least 5 useful watchlist items cluster around model portability or cost-control decisions.

## Kill criteria
Kill if the tag remains unknown/noisy for >80% of promoted cards or yields no actionable stack decisions.

## Execution path
- Add a lightweight model-portability field to judgement notes
- Run it on the next 3 Agent Radar ingests
- Review whether it changes any Hermes/Scorio agent stack decision

## Source note
/Users/yoseph/Documents/AI-Agent-Radar/Inbox/2026-05-16 x-signal-peter-steinberger-steipete-11h-are-you-sure-everything-i-build-is-open.md

## Dependency / tool URLs
- No extra dependency URL found in source.

## Next actions
- Patch judgement prompt/schema locally to tag future cards with model-portability: proprietary, BYO model, local/open, unknown.
