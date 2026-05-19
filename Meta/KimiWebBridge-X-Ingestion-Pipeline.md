---
type: pipeline
status: adopted
category: ingestion
confidence: high
---

# Kimi WebBridge X Ingestion Pipeline

Purpose: turn logged-in X browsing into short, usable Agent Radar cards. Do not create another long capture. The output should feed the dashboard, the idea slicer, and the experiment board.


## Local runner

```bash
npm run ingest:x -- --health   # verifies daemon + extension readiness
npm run ingest:x -- --dry-run  # writes preview cards/status under .omx/ingestion-runs/
npm run ingest:x              # live X crawl; writes cards into Inbox/, Repos/, Use Cases/, Scorio Ideas/, Experiments/
```

The live runner exits with code `2` when Kimi WebBridge is installed but the browser extension is not connected. When connected, it opens X search, extracts visible post text/links, classifies signals, and writes Markdown cards into the real operating folders instead of only a report. Each run is also written to `.omx/ingestion-runs/<run-id>.json`, the latest copy is written to `.omx/ingestion-runs/latest.json`, and `/ingestion` shows both latest status and recent local run history.

## Run command prompt

```text
$kimi-webbridge
Crawl logged-in X for the last 24 hours of AI-agent signals. Focus only on agentic coding, browser agents, MCP/CLI surfaces, local runtimes, open-source repos, productized AI ops, and Scorio-relevant automation.

Hard limits:
- Max 30 raw posts inspected.
- Max 10 final cards written.
- Max 5 repo cards.
- Max 5 action items.
- Reject engagement bait, duplicate posts, vague launch posts, and claims without a source link.
- Resolve t.co links before writing a card.
- Prefer primary links: GitHub, docs, release notes, product pages, demos.

Write Markdown files using the schemas below:
- Inbox/YYYY-MM-DD X Capture.md for the raw shortlist.
- Repos/<repo-or-project>.md for verified repo/project leads.
- Use Cases/<use-case>.md for reusable patterns.
- Scorio Ideas/<idea>.md for Scorio/Hermes opportunities.
- Experiments/<experiment>.md for any idea worth testing.
- Weekly Syntheses/YYYY-WW.md only when asked to summarize the week.

Return a short founder summary:
1. Top 3 signals.
2. Act-now items.
3. Worth-trying experiments.
4. Watch/ignore list.
5. Verification gaps.
```

## Card schema

Every written card should include frontmatter:

```yaml
---
type: repo | use_case | scorio_idea | experiment | capture
status: inbox | verify | test | adopt | watch | ignore
category: browser-agent | mcp-cli | agent-runtime | content-agent | model | scorio | commerce | coding-agent
risk: low | medium | high
strategic_relevance: 1-5
actionability: 1-5
confidence: low | medium | high
source_urls:
  - https://...
last_checked: YYYY-MM-DD
---
```

## Promotion rules

- Promote to `Experiments/` only if it has a falsifiable hypothesis, a first test under one day, and a success signal.
- Promote to `Scorio Ideas/` only if it improves tournament operations, content, sales, support, QA, or agentic internal tooling.
- Promote to `Repos/` only if a repo or product link was resolved and the risk is labeled.
- Keep in `Inbox/` if it is interesting but not verified.
- Mark `ignore` when the post is hype, duplicate, unclear, or not useful to Scorio/Hermes.

## Experiment template

```markdown
---
type: experiment
status: test
category: scorio
risk: low
strategic_relevance: 5
actionability: 5
confidence: medium
source_urls:
  - <source>
last_checked: YYYY-MM-DD
---

# <Experiment name>

## Hypothesis
<If we do X, then Y improves because Z.>

## First test
<One-day test.>

## Success signal
<Observable pass/fail evidence.>

## Kill criteria
<When to stop.>

## Next actions
- Test <specific smallest action>.
- Write <result artifact>.
```

## Quality gate

Before finishing a crawl, verify:

- No card is only a summary; every card has an action, experiment, or explicit watch/ignore reason.
- Links are resolved and source URLs are stored.
- Repo cards do not rely on X claims alone.
- Scorio ideas map to a concrete operational workflow.
- The final founder summary is under 400 words.
