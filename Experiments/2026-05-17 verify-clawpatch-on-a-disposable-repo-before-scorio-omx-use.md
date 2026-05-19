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
blocked_reason: Local source/install/repro check not run yet.
claims:
  - "Grok/x_search corroborated a Vox post reporting 87 Clawpatch findings."
  - "Grok/x_search identified Clawpatch as a repo-audit CLI promoted by Peter Steinberger."
  - "No local reproduction has been run."
source_urls:
  - https://x.com/Voxyz_ai/status/2055770273039683588
  - https://x.com/steipete/status/2055657966515155293
dependency_urls:
  - https://clawpatch.ai
source_note_path: Inbox/2026-05-17 clawpatch-ai-repo-audit-workflow-appears-actionable-but-needs-source-repro-check.md
run_id: 2026-05-17T16-27-29-499-x-home-grok-factcheck-external
---

# Verify Clawpatch on a disposable repo before Scorio/OMX use

## Hypothesis
If Clawpatch reproduces meaningful findings on a disposable repo, it can become a verify-lane reviewer for Scorio/OMX code.

## First test
Check clawpatch source/install docs and run on a non-sensitive fixture repo only.

## Success signal
Produces an auditable report with at least one reproducible real issue and no credential leakage.

## Kill criteria
Kill if install path is opaque, repo/license cannot be verified, or findings are mostly false positives.

## Execution path
- Open primary site/repo
- Check package provenance
- Run on disposable fixture
- Review report manually

## Source note
Inbox/2026-05-17 clawpatch-ai-repo-audit-workflow-appears-actionable-but-needs-source-repro-check.md

## Dependency / tool URLs
- https://clawpatch.ai

## Next actions
- Check clawpatch source/install docs and run on a non-sensitive fixture repo only.
