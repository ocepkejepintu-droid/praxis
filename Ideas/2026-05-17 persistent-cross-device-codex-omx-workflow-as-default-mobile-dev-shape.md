---
type: idea
stage: act_now
status: test
category: llm-judgement
strategic_relevance: 5
actionability: 4
risk: medium
confidence: medium
source: Hermes LLM judgement
target_lane: buildroom
priority: high
owner: Hermes
verification_status: verified
evidence_strength: strong
blocked_reason: none
claims:
  - "Greg Brockman posted about linking devices with Codex to develop from anywhere."
  - "x_search corroborated the connected-device/persistent-devbox workflow discussion."
  - "Yoseph already uses mobile terminal/tmux patterns that this workflow can improve."
source_urls:
  - https://x.com/gdb/status/2056046844921172243
  - https://x.com/i/status/2056046844921172243
dependency_urls:
  - pending
source_note_path: Inbox/2026-05-17 x-signal-greg-brockman-gdb-30m-link-together-your-devices-with-codex-to-develop-.md
run_id: 2026-05-17-16-49-17-830-fast
---

# Persistent cross-device Codex/OMX workflow as default mobile dev shape

## Thesis
The useful pattern is a persistent home devbox with mobile/laptop as thin controllers, matching Yoseph’s Termius+tmux workflow and OMX daemon goals.

## Why now
Greg Brockman/OpenAI posts are pushing linked-device Codex usage and always-on devbox workflows; x_search corroborated the current discussion.

## Next move
Draft a minimal OMX daemon/mobile workflow spec: home machine, tmux sessions, notification handoff, and safe resume semantics.

## Execution path
- Extract requirements from current Termius/tmux setup
- Define one home-devbox session model
- Map notifications/backlog to Hermes/WhatsApp
- Open implementation issue only after spec is tight

## Source note
Inbox/2026-05-17 x-signal-greg-brockman-gdb-30m-link-together-your-devices-with-codex-to-develop-.md

## Dependency / tool URLs
- No extra dependency URL found in source.

## Next actions
- Draft a minimal OMX daemon/mobile workflow spec: home machine, tmux sessions, notification handoff, and safe resume semantics.
