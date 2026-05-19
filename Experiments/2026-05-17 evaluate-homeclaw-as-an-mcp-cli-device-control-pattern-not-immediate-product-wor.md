---
type: experiment
stage: queued
status: test
category: llm-judgement
risk: low
confidence: medium
source: Hermes LLM judgement
target_lane: verify
priority: low
owner: Hermes
verification_status: partially_verified
evidence_strength: medium
blocked_reason: High-permission real-world control; needs security review before any use.
claims:
  - "x_search identified HomeClaw as CLI/MCP/OpenClaw plugin for Apple Home/HomeKit."
  - "x_search reported explicit permissions and allow/block list discussion."
source_urls:
  - https://x.com/OmarShahine/status/2055707450125500514
dependency_urls:
  - https://github.com/omarshahine/HomeClaw
source_note_path: Inbox/2026-05-17 x-signal-omar-shahine-omarshahine-22h-homeclaw-lets-you-use-any-agent-to-control.md
run_id: 2026-05-17-16-49-17-830-fast
---

# Evaluate HomeClaw as an MCP/CLI device-control pattern, not immediate product work

## Hypothesis
HomeClaw may show a reusable design pattern for high-permission MCP tools: explicit allow/block lists, CLI plus MCP, and local app boundary.

## First test
Review HomeClaw repo/docs for permission model and MCP interface; do not connect real home devices.

## Success signal
Clear permission model and isolated demo path documented.

## Kill criteria
Kill if setup requires broad HomeKit permissions or unclear security boundary.

## Execution path
- Open repo/docs
- Extract permission model
- Note MCP tool shape
- Summarize reusable patterns

## Source note
Inbox/2026-05-17 x-signal-omar-shahine-omarshahine-22h-homeclaw-lets-you-use-any-agent-to-control.md

## Dependency / tool URLs
- https://github.com/omarshahine/HomeClaw

## Next actions
- Review HomeClaw repo/docs for permission model and MCP interface; do not connect real home devices.
