# Agent Radar Dashboard Plan

Status: Draft v1
Created: 2026-05-14
Owner: Yoseph

## 1. One-line idea

Use Obsidian-style Markdown files as the durable backend, then build a visual local dashboard on top that turns X/GitHub/AI-agent research into actionable product and business decisions.

The dashboard is not a replacement for Obsidian.
It is the decision cockpit for the Markdown knowledge base.

---

## 2. Core philosophy

### Markdown is the backend

The `.md` files are the source of truth:

- human-readable
- portable
- versionable with Git
- editable in Obsidian
- easy for agents to read/write
- durable even if the frontend changes

The frontend should treat the Markdown vault like a database.

### Dashboard is the frontend

The dashboard should answer:

- What is new?
- What is repeating?
- What is worth testing?
- What should Scorio / Hermes / OMX do next?
- Which repos are real opportunities?
- Which signals are just hype/noise?

### Hermes / Rowboat is the engine

The agent layer should:

- browse X via Kimi WebBridge
- extract tweets, repos, products, use cases
- resolve links
- verify GitHub metadata
- write structured Markdown notes
- generate weekly synthesis
- promote strong signals into action items

### GitHub / X are raw inputs

They are not the knowledge base.
They are feeds.

Raw feed data becomes valuable only after:

1. capture
2. verification
3. distillation
4. connection
5. action

---

## 3. Target outcome

Build a local-first research intelligence system for AI agents, AI tools, GitHub repos, and Scorio/Hermes opportunities.

The system should compound knowledge over time instead of producing one-off summaries.

Expected result:

- Every useful X discovery becomes structured knowledge.
- Every interesting repo gets a durable repo card.
- Repeated patterns become use-case notes.
- Use cases become Scorio/Hermes experiments.
- Weekly synthesis turns browsing into product direction.

---

## 4. Product name options

Working name:

- Agent Radar Dashboard

Other possible names:

- AI Agent Radar
- Founder Signal Board
- Agent Intel Dashboard
- Repo Radar
- Scorio Intelligence OS
- AgentOps Radar

Recommended name for now:

**Agent Radar Dashboard**

Clear, simple, not overbranded.

---

## 5. System architecture

```text
X / GitHub / blogs / docs
        ↓
Kimi WebBridge + Hermes/Rowboat collector
        ↓
Raw captures as Markdown
        ↓
Verification layer
        ↓
Structured repo/use-case/action notes
        ↓
Markdown vault = backend
        ↓
Local dashboard frontend
        ↓
Decisions / experiments / GitHub issues / Scorio actions
```

---

## 6. Recommended stack

### Phase 1: simplest useful version

Use a local static app that reads Markdown files directly.

Recommended stack:

- Next.js or Astro
- TypeScript
- React
- `gray-matter` for YAML frontmatter parsing
- `remark` / `markdown-it` for Markdown rendering
- Recharts or D3 for charts
- React Flow for graph visualization
- Tailwind or plain CSS tokens

Preferred for speed:

- Next.js + TypeScript + Tailwind + gray-matter

Why:

- easy to build dashboards
- easy to add API routes later
- can read files from local filesystem during dev
- straightforward React component model

### Phase 2: indexed version

Add a local SQLite index if Markdown parsing becomes slow.

Flow:

```text
Markdown files → indexing script → SQLite → dashboard
```

Use SQLite for:

- fast filtering
- graph edges
- search
- historical metrics
- repo metadata cache
- duplicate detection

Do not start with SQLite unless Markdown-only becomes painful.

---

## 7. Folder structure

Current suggested knowledge base root:

```text
/Users/yoseph/Documents/AI-Agent-Radar/
```

Recommended vault structure:

```text
AI-Agent-Radar/
  Inbox/
    2026-05-14 X 24h Capture.md
    2026-05-15 X 24h Capture.md

  Repos/
    OpenHands.md
    Dulus.md
    Scenema Audio.md
    Superserve.md
    Mini Browser.md
    html-anything.md

  Use Cases/
    Agent-operated SaaS.md
    Agent-first CLI MCP.md
    AI Engineering Team as a Service.md
    Persistent Agent Runtime.md
    Agent Commerce.md
    Browser-to-API Workflow.md
    Mobile Device Agent.md
    Content Automation Agent.md

  Products/
    Public.com API.md
    Hyperagent Founding 500.md
    NEAR AI Agent Market.md
    Zerion Agent CLI.md

  Models/
    Ring-2.6-1T.md

  Weekly Syntheses/
    2026-W20.md
    2026-W21.md

  Scorio Ideas/
    Scorio Admin Agent.md
    Tournament Recap Agent.md
    Scorio CLI MCP.md
    Sponsor Outreach Agent.md
    Mobile QA Agent.md

  Experiments/
    2026-05-XX Kimi WebBridge Scorio Admin Flow.md
    2026-05-XX Browser-to-API Spike.md

  Meta/
    Dashboard Schema.md
    Collection Queries.md
    Scoring Rubric.md
```

---

## 8. Dashboard app folder structure

Possible project path:

```text
/Users/yoseph/Documents/AI-Agent-Radar-App/
```

Suggested app structure:

```text
AI-Agent-Radar-App/
  package.json
  next.config.js
  tsconfig.json

  src/
    app/
      page.tsx
      repos/page.tsx
      use-cases/page.tsx
      graph/page.tsx
      weekly/page.tsx
      actions/page.tsx
      notes/[slug]/page.tsx

    components/
      Layout.tsx
      TopSignalStrip.tsx
      RadarMap.tsx
      RepoCard.tsx
      RepoTable.tsx
      UseCaseGraph.tsx
      WeeklyBoard.tsx
      ActionQueue.tsx
      NotePreview.tsx
      FilterBar.tsx
      ScoreBadge.tsx
      StatusPill.tsx
      RiskBadge.tsx

    lib/
      markdown.ts
      schema.ts
      scoring.ts
      graph.ts
      github.ts
      links.ts
      filters.ts

    styles/
      globals.css
      tokens.css
```

---

## 9. Markdown schema

The dashboard depends on structured frontmatter.

Every note should have:

```yaml
---
type: repo | use_case | product | model | synthesis | scorio_idea | experiment | capture
name: Example Name
status: inbox | verify | test | adopt | watch | ignore | promoted
category: coding-agent | browser-agent | agent-runtime | model | content-agent | mcp-cli | commerce | scorio
strategic_relevance: 1-5
actionability: 1-5
risk: low | medium | high
confidence: low | medium | high
source_urls:
  - https://x.com/...
tags:
  - agents
  - github
  - scorio
created: YYYY-MM-DD
updated: YYYY-MM-DD
last_checked: YYYY-MM-DD
---
```

Not every field is required for every note type, but the dashboard becomes much better when the core fields are present.

---

## 10. Repo note schema

Example:

```markdown
---
type: repo
name: OpenHands
repo: OpenHands/OpenHands
url: https://github.com/OpenHands/OpenHands
source_urls:
  - https://x.com/DeRonin_/status/2054889831809929357
category: coding-agent
status: verify
strategic_relevance: 5
actionability: 4
risk: medium
confidence: high
stars: 73513
forks:
last_commit: 2026-05-14
license:
language:
starred_by_yoseph: unknown
tags:
  - agents
  - coding
  - open-source
  - smb
related_use_cases:
  - AI Engineering Team as a Service
  - Persistent Agent Runtime
created: 2026-05-14
updated: 2026-05-14
last_checked: 2026-05-14
---

# OpenHands

## Why it matters

Open-source AI-driven development runtime that can be packaged as an AI engineering team.

## Claim from source

Runs Claude/GPT as software engineers over real codebases.

## Use cases

- SMB custom software
- internal tools
- maintenance
- bug fixing
- autonomous dev team packaging

## Relevance to Yoseph

High relevance to OMX/Hermes and potential service packaging for agencies/SMBs.

## Risks

- Need to inspect runtime complexity
- May overlap with existing OMX/Hermes stack
- Requires clear differentiation before adopting

## Next action

Inspect architecture and compare against Hermes/OMX.
```

---

## 11. Use-case note schema

Example:

```markdown
---
type: use_case
name: Agent-first CLI MCP
category: mcp-cli
status: watch
strategic_relevance: 5
actionability: 5
risk: low
confidence: high
source_urls:
  - https://public.com/api/docs
  - https://x.com/designertom/status/2054688170621706580
related_repos: []
related_products:
  - Public.com API
  - Notion CLI
related_scorio_ideas:
  - Scorio CLI MCP
created: 2026-05-14
updated: 2026-05-14
---

# Agent-first CLI MCP

## Durable insight

SaaS products should expose not just a human UI, but also an API, CLI, MCP server, and agent skill.

## Why now

Agents increasingly operate through terminal tools and MCP. Products that expose agent-native surfaces become easier to automate and integrate into workflows.

## Scorio implication

Scorio should eventually expose:

- CLI commands
- API endpoints
- MCP tools
- Hermes skills

## Possible Scorio tools

- `scorio tournaments.list`
- `scorio tournaments.create`
- `scorio players.import`
- `scorio brackets.seed`
- `scorio matches.updateScore`
- `scorio standings.publish`
- `scorio messages.send`

## Next action

Write a minimal Scorio CLI/MCP design note.
```

---

## 12. Scorio idea note schema

Example:

```markdown
---
type: scorio_idea
name: Scorio Admin Agent
status: test
category: scorio
strategic_relevance: 5
actionability: 5
risk: medium
confidence: high
source_urls:
  - https://x.com/Kimi_Moonshot/status/2054918374837322140
related_use_cases:
  - Agent-operated SaaS
  - Agent-first CLI MCP
related_repos:
  - OpenHands
created: 2026-05-14
updated: 2026-05-14
---

# Scorio Admin Agent

## Problem

Tournament organizers spend too much time doing repetitive admin work.

## Agent job

Operate Scorio like staff:

- create tournament
- import players
- seed bracket
- update schedule
- message players
- publish standings
- create recap

## Why this matters

This converts Scorio from tournament software into an operations assistant.

## First experiment

Use Kimi WebBridge to operate one Scorio admin workflow through Chrome and document friction.
```

---

## 13. Main dashboard screens

## 13.1 Home / Today screen

Purpose:
Give Yoseph the answer in 30 seconds.

Sections:

1. Top signals today
2. Repeated patterns
3. Repos to verify
4. Scorio/Hermes actions
5. Ignore/noise list

Layout:

```text
┌─────────────────────────────────────────────┐
│ Agent Radar                                 │
│ Today: 7 signals, 3 repos, 2 actions         │
├─────────────────────────────────────────────┤
│ Top 5 Signals                               │
│ 1. Public API/CLI/MCP pattern                │
│ 2. Ring-2.6-1T agent execution model         │
│ 3. Hyperagent agent-first funding            │
│ 4. Superserve persistent microVM agents      │
│ 5. Dulus OpenClaw-inspired repo              │
├─────────────────────────────────────────────┤
│ Action Queue                                │
│ - Design Scorio CLI/MCP                      │
│ - Inspect Dulus in sandbox                   │
│ - Resolve Superserve repo                    │
└─────────────────────────────────────────────┘
```

This screen should be sparse and action-first.

---

## 13.2 Radar Map

Purpose:
Show what is strategically important and actionable.

Visualization:
Bubble chart.

Axes:

- X-axis: actionability now
- Y-axis: strategic relevance

Bubble size:

- traction score
- GitHub stars
- tweet engagement
- recurrence count

Bubble color:

- category

Quadrants:

1. High relevance + high actionability
   - Act now

2. High relevance + low actionability
   - Watch / research

3. Low relevance + high actionability
   - Quick experiments only

4. Low relevance + low actionability
   - Ignore

Examples:

- Public.com API/CLI/MCP = high relevance, high actionability
- Ring-2.6-1T = high relevance, medium actionability
- NEAR agent commerce = medium relevance, low immediate action
- Dulus = medium relevance, medium actionability, high risk

Card hover should show:

- name
- category
- why it matters
- next action
- links

---

## 13.3 Repo Watchlist

Purpose:
Manage interesting repos from X/GitHub.

Views:

- Cards
- Table
- Kanban by status

Fields:

- name
- repo URL
- stars
- last commit
- category
- status
- risk
- confidence
- starred by Yoseph
- source tweet
- next action

Statuses:

- inbox
- verify
- test
- adopt
- watch
- ignore

Card design:

```text
┌──────────────────────────────┐
│ OpenHands              73.5k │
│ coding-agent                 │
│ Status: verify               │
│ Risk: medium                 │
│                              │
│ Why: open AI dev runtime      │
│ Next: compare with OMX        │
│                              │
│ [GitHub] [Source] [Open Note] │
└──────────────────────────────┘
```

Action buttons:

- Open GitHub
- Open source tweet
- Open note
- Mark verify/test/adopt/ignore
- Create Scorio idea
- Refresh metadata

---

## 13.4 Use Case Graph

Purpose:
Show how raw signals connect into durable ideas.

Nodes:

- repo
- product
- model
- use case
- Scorio idea
- experiment
- synthesis

Edges:

- supports
- inspires
- competes_with
- source_of
- should_test
- related_to

Example graph:

```text
Public.com API/CLI/MCP
        ↓ supports
Agent-first CLI MCP
        ↓ inspires
Scorio CLI MCP
        ↓ promotes
Scorio Admin Agent
```

Rules:

- Do not show a huge random graph by default.
- Start with curated graph around selected node.
- Allow filters by category/status.

Graph should answer:

- Why does this repo matter?
- Which use case does it support?
- Which Scorio idea does it influence?
- What action came from it?

---

## 13.5 Weekly Synthesis Board

Purpose:
Turn repeated signals into decisions.

Kanban columns:

1. New Signals
2. Repeated Patterns
3. Worth Testing
4. Promoted to Project
5. Ignore / Noise

Example:

```text
New Signals:
- Ring-2.6-1T
- Dulus
- Scenema Audio

Repeated Patterns:
- Agent-first CLI/MCP
- Browser-operating agents
- Persistent agent runtime

Worth Testing:
- Scorio Admin Agent via Kimi WebBridge
- Browser-to-API workflow

Promoted:
- Scorio CLI/MCP plan

Ignore / Noise:
- token-pumped agent repos without code quality
```

---

## 13.6 Scorio Opportunity Board

Purpose:
Translate AI-agent research into Scorio/Hermes product direction.

Cards:

- Scorio Admin Agent
- Tournament Recap Agent
- Scorio CLI/MCP
- Sponsor Outreach Agent
- Player Comms Agent
- Browser-to-API Workflow
- Mobile QA Agent
- SMB AI Engineering Team Package

Each card:

- problem
- target user
- source signals
- leverage
- complexity
- next experiment
- status

Scoring:

- business value: 1-5
- build complexity: 1-5
- confidence: low/medium/high
- urgency: 1-5

---

## 13.7 Note Detail View

Purpose:
Show original Markdown note with metadata and actions.

Components:

- frontmatter summary
- rendered Markdown body
- source links
- related notes
- graph neighborhood
- action buttons

Should support Obsidian deep link if possible:

```text
obsidian://open?vault=...&file=...
```

---

## 14. Scoring model

### Strategic relevance

Score 1-5.

Ask:

- Does this matter to Scorio?
- Does this matter to Hermes/OMX?
- Does this reveal a durable market direction?
- Does this compound over time?

Guide:

- 1 = curiosity only
- 2 = mildly interesting
- 3 = useful signal
- 4 = strong relevance
- 5 = directly shapes strategy

### Actionability

Score 1-5.

Ask:

- Can we test it this week?
- Is there a clear next action?
- Do we have access/tools?
- Does it require huge setup?

Guide:

- 1 = cannot act now
- 2 = watch only
- 3 = investigate
- 4 = test soon
- 5 = act now

### Risk

Low / medium / high.

Risk factors:

- untrusted install scripts
- credential access
- crypto/token hype
- legal/compliance issue
- voice cloning risk
- unclear license
- stale repo
- fake stars/hype

### Confidence

Low / medium / high.

Confidence depends on:

- source quality
- repo metadata
- documentation quality
- repeated mentions
- working demo
- known team

### Traction score

Possible formula:

```text
traction = log10(stars + 1) + log10(tweet_views + 1) + recurrence_count
```

Use approximate score only.
Do not overfit.

---

## 15. Collection pipeline

## 15.1 Daily capture

Input queries:

```text
(agent OR agents OR "AI agent" OR "coding agent" OR Codex OR Claude OR Kimi OR Hermes) min_faves:20 -filter:replies

(github.com OR GitHub OR repo OR "open source") (agent OR AI OR Claude OR Codex OR browser) min_faves:10 -filter:replies

("browser agent" OR "browser automation" OR MCP OR "AI workflow" OR "agent-first") min_faves:5 -filter:replies
```

Also browse:

- home feed
- following feed if useful
- bookmarks if user wants
- specific accounts later

## 15.2 Extraction

For each tweet/post:

- tweet URL
- author
- timestamp
- text
- visible metrics
- external links
- GitHub links
- product links
- mentioned repo names
- categories

## 15.3 Link resolution

Resolve:

- `t.co` links
- GitHub repo URLs
- product docs
- ModelScope/HuggingFace links
- npm package links

## 15.4 Verification

For GitHub repos:

- repo exists
- stars
- forks
- last pushed date
- primary language
- license
- README exists
- release activity
- issues activity
- owner credibility
- whether Yoseph starred it

For npm packages:

- package exists
- version
- publish date
- maintainer
- install scripts
- dependency risk
- repo link

For models:

- weights availability
- license
- serving path
- hardware requirements
- benchmark claims

## 15.5 Distillation

Classify into:

- repo
- product
- model
- use case
- market signal
- Scorio idea
- experiment
- noise

Each item gets:

- why it matters
- use case
- relevance
- actionability
- risk
- next action

## 15.6 Promotion

Promotion rules:

Promote from inbox to repo/use-case note if:

- repeated signal
- high strategic relevance
- credible repo/product
- actionable experiment exists
- directly relates to Scorio/Hermes/OMX

Ignore if:

- pure engagement bait
- no repo/docs
- crypto pump with weak substance
- impossible to verify
- unrelated to current strategy

---

## 16. Agent job design

Job name:

```text
ai-agent-radar-x-24h
```

Frequency:

- daily if useful
- otherwise 3x/week

Prompt shape:

```text
Browse Yoseph's logged-in X feed via Kimi WebBridge for the last 24h AI-agent/GitHub/use-case signals.
Extract posts about AI agents, coding agents, browser agents, MCP/CLI, open-source repos, model releases, and practical use cases.
Resolve links, verify GitHub metadata when possible, classify items, and write structured Markdown notes into /Users/yoseph/Documents/AI-Agent-Radar.
Output a concise founder-level summary: top signals, repos to inspect, Scorio/Hermes actions, and noise to ignore.
```

Output files:

```text
Inbox/YYYY-MM-DD X 24h Capture.md
Weekly Syntheses/YYYY-WW.md
Repos/<Repo>.md
Use Cases/<Use Case>.md
Scorio Ideas/<Idea>.md
```

---

## 17. Frontend MVP requirements

MVP should do only what matters.

### MVP features

1. Read Markdown files from `AI-Agent-Radar` folder.
2. Parse YAML frontmatter.
3. Show Home dashboard.
4. Show Radar Map.
5. Show Repo Watchlist.
6. Show Action Queue.
7. Show Note Detail view.
8. Filter by category/status/risk.
9. Open source links and local note paths.

### MVP non-goals

Do not build yet:

- user accounts
- cloud sync
- complex permissions
- real-time collaboration
- fancy AI chat inside dashboard
- full Obsidian replacement
- database unless needed

---

## 18. Design direction

Visual style:

- founder cockpit
- dense but calm
- terminal/productivity feel
- not flashy SaaS gradient sludge
- readable in long work sessions
- dark mode first, light mode later

Personality:

- intelligence dashboard
- decision board
- research cockpit
- action-first

Avoid:

- random graph spaghetti
- fake metrics
- overdecorated cards
- excessive icons
- rainbow colors
- vague “insights” sections

Use:

- strong typography
- compact cards
- clear status pills
- subtle color coding
- good filters
- keyboard-friendly layout

Possible color system:

```text
Background: near-black / dark slate
Surface: slightly lighter slate
Text: off-white
Muted: gray
Accent: electric blue or green
Risk high: red/orange
Risk medium: amber
Risk low: green
Action: blue
Watch: purple
Ignore: gray
```

---

## 19. Dashboard information hierarchy

Top-level priority:

1. Actions
2. High-signal discoveries
3. Repeated patterns
4. Repos to verify
5. Supporting evidence
6. Raw captures

The UI should not start with raw notes.
It should start with decisions.

---

## 20. Example home dashboard content

```text
Agent Radar — Today

Top Signals
1. Public.com shows SaaS → API + CLI + MCP + skills pattern
2. Ring-2.6-1T positions open models around agent execution
3. Hyperagent funds agent-first companies
4. Superserve points toward isolated persistent agent runtimes
5. Dulus shows OpenClaw-inspired cost-reduction hype

Repeated Patterns
- Agent-first CLI/MCP
- Browser-operated SaaS
- Persistent agent runtimes
- Open-source coding agents

Repos to Verify
- KevRojo/Dulus
- ScenemaAI/scenema-audio
- Superserve exact repo
- freebuff package/repo

Actions
- Design Scorio CLI/MCP interface
- Run Scorio Admin Agent browser experiment
- Create repo cards for Dulus and Scenema Audio
- Resolve Superserve/freebuff repos

Ignore / Caution
- Token-pumped agent projects
- Free unlimited coding agent claims until sandbox verified
```

---

## 21. How this compounds

### Day 1

Capture interesting posts.

### Week 1

Patterns emerge:

- browser agents
- agent-first CLIs
- coding agent runtimes
- local persistent agents

### Week 2

Scorio ideas emerge:

- Scorio Admin Agent
- Scorio CLI/MCP
- Tournament Recap Agent

### Month 1

Experiments create evidence:

- browser agent can/cannot operate admin workflows
- CLI/MCP surface is/is not worth building
- content agent saves/does not save time

### Month 2

Decisions become product roadmap:

- build Scorio agent interface
- package AI engineering team offer
- ignore noisy agent-commerce category for now

The point is not collecting links.
The point is making better product decisions faster.

---

## 22. Integration with GitHub stars

GitHub stars should be treated as a lightweight bookmark layer.

The real knowledge remains in Markdown.

Dashboard should show:

- starred by Yoseph: yes/no/unknown
- star action available if GitHub auth exists
- repo already in vault: yes/no
- note status: inbox/verify/test/adopt/ignore

GitHub auth requirement:

- `gh auth login` or active `GITHUB_TOKEN`

Without auth:

- dashboard can still show repo metadata
- starred status remains unknown

---

## 23. Integration with Obsidian

Obsidian remains useful for:

- editing notes
- backlinks
- manual thinking
- long-form writing
- graph exploration
- mobile reading if synced

Dashboard adds:

- structured views
- scoring
- filters
- action queues
- radar maps
- repo metadata
- weekly synthesis

Obsidian is the backend and editor.
Dashboard is the operating cockpit.

---

## 24. Integration with Scorio/Hermes/OMX

The dashboard should create a direct bridge from research to execution.

Possible promotion actions:

- Create Scorio idea note
- Create experiment note
- Create GitHub issue
- Send task to OMX/Codex
- Add to weekly synthesis
- Mark as ignored

Eventually:

```text
Signal → Use Case → Scorio Idea → GitHub Issue → OMX execution
```

Example:

```text
Public.com MCP signal
  → Agent-first CLI MCP use case
  → Scorio CLI/MCP idea
  → GitHub issue: Design minimal Scorio agent API
  → OMX worker implements spike
```

---

## 25. First implementation plan

### Step 1: Normalize Markdown schema

Create templates:

- repo template
- use-case template
- product template
- model template
- Scorio idea template
- synthesis template

### Step 2: Convert existing notes

Convert current files into structured frontmatter:

- `2026-05-14-24h-x-agent-intel.md`
- `2026-05-14-x-feed-ai-agent-repos.md`

Extract repo cards:

- OpenHands
- Dulus
- Scenema Audio
- scrcpy
- Public.com API
- Hyperagent
- Ring-2.6-1T

### Step 3: Build dashboard MVP

Create local Next.js app:

- parse Markdown
- show Home
- show Repo Watchlist
- show Radar Map
- show Action Queue
- note detail view

### Step 4: Add GitHub metadata refresh

Script:

- input repo URLs from Markdown
- fetch GitHub API
- update frontmatter or metadata cache

### Step 5: Add Kimi WebBridge capture job

Manual first.
Then scheduled.

### Step 6: Add weekly synthesis

Generate a weekly note from captured items.

---

## 26. MVP acceptance criteria

The MVP is successful if Yoseph can open one local page and answer:

1. What are the top 5 AI-agent signals this week?
2. Which repos should I inspect/star/test?
3. What use cases are repeating?
4. Which Scorio/Hermes ideas should I act on?
5. What should I ignore?

If it cannot answer those, it is just a prettier note browser and not good enough.

---

## 27. Long-term vision

This can become a personal founder intelligence OS.

Inputs:

- X feed
- GitHub trending/repos
- Hacker News
- arXiv
- blog/RSS feeds
- Discord/Telegram groups
- customer calls
- Scorio usage data

Backend:

- Markdown vault
- optional SQLite index
- Git history

Agent layer:

- collectors
- verifiers
- summarizers
- synthesis jobs
- experiment promoters

Frontend:

- Radar dashboard
- repo watchlist
- use-case graph
- Scorio opportunity board
- weekly synthesis
- action queue

Outputs:

- GitHub issues
- Scorio experiments
- OMX execution tasks
- investor/founder memos
- product roadmap changes

The durable advantage is not more information.
It is faster compounding from signal → action.

---

## 28. Recommended next task

Build the first dashboard prototype against the existing Markdown folder.

Scope:

- local Next.js app
- read `/Users/yoseph/Documents/AI-Agent-Radar`
- parse frontmatter
- render Home, Repo Watchlist, Radar Map, Action Queue
- use current notes as seed data

Keep it local.
Keep it simple.
Make it useful before making it beautiful.
