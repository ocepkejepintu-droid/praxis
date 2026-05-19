---
type: experiment
stage: queued
status: test
category: llm-judgement
risk: low
confidence: medium
source: Hermes LLM judgement
target_lane: verify
priority: medium
owner: Hermes
verification_status: partially_verified
evidence_strength: medium
blocked_reason: Local provenance/install/repro check not run yet.
claims:
  - "x_search corroborated Vox reported 87 Clawpatch findings."
  - "Reported breakdown was 6 high, 46 medium, 35 low."
  - "No local reproduction has been run in this environment."
source_urls:
  - https://x.com/Voxyz_ai/status/2055770273039683588
dependency_urls:
  - https://clawpatch.ai
source_note_path: Inbox/2026-05-17 x-signal-vox-voxyz-ai-18h-ran-clawpatch-on-my-whole-repo-didn-t-expect-87-findin.md
run_id: 2026-05-17-16-49-17-830-fast
---

# Verify Clawpatch on a disposable repo before using it on Scorio/OMX

## Hypothesis
If Clawpatch produces reproducible, low-noise findings on a disposable repo, it can become a verify-lane audit tool for Scorio/OMX.

## First test
Check package/source provenance, install path, and run on a non-sensitive fixture repo only.

## Success signal
At least one real reproducible finding with clear audit trail and no credential exposure.

## Kill criteria
Kill if package provenance is unclear, findings are mostly false positives, or it requires unsafe repo/token access.

## Execution path
- Open primary site/repo/package metadata
- Install only in disposable environment
- Run on fixture repo
- Review high findings manually

## Source note
Inbox/2026-05-17 x-signal-vox-voxyz-ai-18h-ran-clawpatch-on-my-whole-repo-didn-t-expect-87-findin.md

## Dependency / tool URLs
- https://clawpatch.ai

## Next actions
- Check package/source provenance, install path, and run on a non-sensitive fixture repo only.
