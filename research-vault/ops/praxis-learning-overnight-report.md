# Praxis Learning Morning Report

Run: praxis-learning-morning-1779133231721-44ecso
Created: 2026-05-18T19:40:31.721Z
Agents: mock-hermes, mock-openclaw, hermes, openclaw
Selected Praxis: 10
Praxis learned: 10
Reports: 40 (20 completed, 20 blocked, 0 failed)
Selected top 10 candidates with min score 5.

## CEO short
Agents studied 10 source-backed Praxis entries and produced 20 completed local learning reports. Real runtime lanes stayed blocked unless configured, so no fake execution was recorded.

## Top learned patterns
- Hermes found 2 evidence URL(s) to verify before skill adoption. (8x)
- Hermes mapped the execution path: Open Hermes Atlas project page. → Open canonical GitHub or primary dependency URL. → Verify README, install path, license/risk, and current maint… (8x)
- Hermes mapped the verification/stop rule: Kill if source repo is unavailable, docs are missing, install path fails, or evidence stays social-only. (8x)
- OpenClaw found 2 evidence URL(s) to verify before skill adoption. (8x)
- OpenClaw mapped the execution path: Open Hermes Atlas project page. → Open canonical GitHub or primary dependency URL. → Verify README, install path, license/risk, and current mai… (8x)
- OpenClaw mapped the verification/stop rule: Kill if source repo is unavailable, docs are missing, install path fails, or evidence stays social-only. (8x)
- Hermes found 3 evidence URL(s) to verify before skill adoption. (2x)
- OpenClaw found 3 evidence URL(s) to verify before skill adoption. (2x)
- Hermes identified the smallest safe first test: Create a 5-source monitor that detects one product update and has Hermes write a sourced action with kill/next-step fields.
- Hermes identified the smallest safe first test: Open https://github.com/0xNyk/awesome-hermes-agent, verify install/docs, and run the smallest safe smoke test.

## Best next actions today
- Open Hermes Atlas project page. (16x)
- Use mock-hermes for local safe learning, or configure HERMES_LEARNER_COMMAND with an approved runner. (10x)
- Use mock-openclaw for local safe learning, or configure OPENCLAW_LEARNER_COMMAND with an approved runner. (10x)
- Create a 5-source monitor that detects one product update and has Hermes write a sourced action with kill/next-step fields. (2x)
- Perform the same small repo inspection/fix from phone workflow using current setup; compare against C3 only if available without major setup. (2x)

## Repeated blockers
- HERMES_LEARNER_COMMAND is not configured. Use mock-hermes for local safe learning or configure an approved runtime bridge. (10x)
- OPENCLAW_LEARNER_COMMAND is not configured. Use mock-openclaw for local safe learning or configure an approved runtime bridge. (10x)

## Promoted skill drafts
- research-vault/ops/skill-drafts/mobile-remote-agent-ops-bakeoff-current-termius-tmux-vs-c3-mock-hermes/SKILL.md
- research-vault/ops/skill-drafts/mobile-remote-agent-ops-bakeoff-current-termius-tmux-vs-c3-mock-openclaw/SKILL.md
- research-vault/ops/skill-drafts/n8n-style-multi-agent-research-flow-for-competitor-updates-mock-hermes/SKILL.md
- research-vault/ops/skill-drafts/n8n-style-multi-agent-research-flow-for-competitor-updates-mock-openclaw/SKILL.md
- research-vault/ops/skill-drafts/agentic-mcp-skill-mock-hermes/SKILL.md

## Source evidence
- https://x.com/naa_rang/status/2055589765756686382
- https://x.com/fcoury/status/2055315105055694869
- https://getc3.app
- https://x.com/neil_xbt/status/2055168802036576600
- https://n8n.io/
- https://docs.n8n.io/
- https://hermesatlas.com/projects/cablate/Agentic-MCP-Skill
- https://github.com/cablate/Agentic-MCP-Skill
- https://hermesatlas.com/projects/rodmarkun/anihermes
- https://github.com/rodmarkun/anihermes
- https://hermesatlas.com/projects/NousResearch/autonovel
- https://github.com/NousResearch/autonovel
- https://hermesatlas.com/projects/0xNyk/awesome-hermes-agent
- https://github.com/0xNyk/awesome-hermes-agent
- https://hermesatlas.com/projects/supermodeltools/bigiron
- https://github.com/supermodeltools/bigiron
- https://hermesatlas.com/projects/black-forest-labs/skills
- https://github.com/black-forest-labs/skills
- https://hermesatlas.com/projects/armelhbobdad/bmad-module-skill-forge
- https://github.com/armelhbobdad/bmad-module-skill-forge
- https://hermesatlas.com/projects/yepyhun/Brainstack
- https://github.com/yepyhun/Brainstack

## Artifacts changed
- research-vault/ops/praxis-learning-reports.json
- research-vault/ops/praxis-learning-morning-report.json
- research-vault/ops/praxis-learning-morning-report.md
- research-vault/ops/praxis-learning-overnight-report.json
- research-vault/ops/praxis-learning-overnight-report.md
- research-vault/ops/skill-drafts/mobile-remote-agent-ops-bakeoff-current-termius-tmux-vs-c3-mock-hermes/SKILL.md
- research-vault/ops/skill-drafts/mobile-remote-agent-ops-bakeoff-current-termius-tmux-vs-c3-mock-openclaw/SKILL.md
- research-vault/ops/skill-drafts/n8n-style-multi-agent-research-flow-for-competitor-updates-mock-hermes/SKILL.md
- research-vault/ops/skill-drafts/n8n-style-multi-agent-research-flow-for-competitor-updates-mock-openclaw/SKILL.md
- research-vault/ops/skill-drafts/agentic-mcp-skill-mock-hermes/SKILL.md
- .radar/acp-log.jsonl

## Real runtime blockers
- hermes: HERMES_LEARNER_COMMAND is not configured. Use mock-hermes for local safe learning or configure an approved runtime bridge.
- openclaw: OPENCLAW_LEARNER_COMMAND is not configured. Use mock-openclaw for local safe learning or configure an approved runtime bridge.

