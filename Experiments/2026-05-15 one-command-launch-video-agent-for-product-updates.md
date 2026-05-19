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
  - https://x.com/shengkun_ye/status/2055037941119082832
dependency_urls:
  - https://docs.anthropic.com/en/docs/claude-code
source_note_path: Inbox/2026-05-15 x-signal-shengkun-shengkun-ye-11h-randomly-asked-claude-code-to-make-me-a-launch.md
run_id: 2026-05-15-09-09-38-986
---

# One-command launch-video agent for product updates

## Hypothesis
A coding agent can generate a usable launch/update video from a feature diff and screenshots, reducing the friction of shipping product comms.

## First test
Ask Claude Code to generate a 20-30 second launch video asset for one Agent Radar feature using existing screenshots and a simple script template.

## Success signal
The output is good enough to post internally or turn into a public demo with less than 30 minutes of human cleanup.

## Kill criteria
Kill if the agent cannot produce coherent visuals/audio timing, requires more than 30 minutes cleanup, or invents product claims not in the source diff.

## Execution path
- Pick one recent Agent Radar feature and collect 2-3 screenshots plus a changelog bullet list.
- Prompt Claude Code to create a short video script/storyboard and renderable asset pipeline.
- Review for factual accuracy and visual clarity.
- Keep only if the asset reduces launch-content work versus manual recording.

## Source note
Inbox/2026-05-15 x-signal-shengkun-shengkun-ye-11h-randomly-asked-claude-code-to-make-me-a-launch.md

## Dependency / tool URLs
- https://docs.anthropic.com/en/docs/claude-code

## Next actions
- Ask Claude Code to generate a 20-30 second launch video asset for one Agent Radar feature using existing screenshots and a simple script template.
