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
  - https://x.com/Alex_Rogov_js/status/2055362886516486384
  - https://x.com/altryne/status/2055385677626519647
dependency_urls:
  - pending
source_note_path: /Users/yoseph/Documents/AI-Agent-Radar/Inbox/2026-05-16 x-signal-alex-rogov-alex-rogov-js-15h-the-defend-against-parallel-agents-part-is.md
run_id: 2026-05-16-10-14-06-510
---

# Agent permission red-team for OMX/Hermes workers

## Hypothesis
A simple default-deny permission checklist will prevent more damage than adding more autonomy controls later.

## First test
Run one throwaway worker task with intentionally limited filesystem/git/browser access and record what breaks.

## Success signal
We identify at least 3 concrete boundaries to encode without slowing normal Scorio PR workflow.

## Kill criteria
Kill if all findings are generic and no actual Hermes/OMX config or workflow change results.

## Execution path
- Inventory current worker-access surfaces
- Run a harmless red-team prompt against a sandbox repo/session
- Patch workflow docs/config with the smallest useful boundaries

## Source note
/Users/yoseph/Documents/AI-Agent-Radar/Inbox/2026-05-16 x-signal-alex-rogov-alex-rogov-js-15h-the-defend-against-parallel-agents-part-is.md

## Dependency / tool URLs
- No extra dependency URL found in source.

## Next actions
- Run one throwaway worker task with intentionally limited filesystem/git/browser access and record what breaks.
