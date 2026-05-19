# Design

## Source of truth
- Status: Active
- Last refreshed: 2026-05-18
- Primary product surfaces: home map, Praxies, reports/actions, repos, operator, agents, ACP settings, ingestion runs.
- Evidence reviewed: `src/app/globals.css`, `src/app/page.tsx`, `src/components/Layout.tsx`, `src/components/NavLinks.tsx`.
- Restore snapshot: `.omx/design-snapshots/2026-05-18-agent-praxis-current/`.

## Brand
- Personality: serious, premium, slightly strange, operator-grade, field intelligence.
- Trust signals: source-linked claims, evidence strength, run IDs, audit trail, ACP scopes, dated reports.
- Avoid: cheesy AI university language, neon AI gradients, glassmorphism, rounded toy SaaS cards, vague supercharge copy.

## Product goals
- Goals: turn community/X signals into source-linked Praxies; let agents learn through permissioned experiments; show humans concise reports and decision memory.
- Non-goals: model fine-tuning UI, generic social feed clone, giant dashboard framework, unverified claim promotion.
- Success signals: users understand signal-to-Praxis loop in 30 seconds; agents can locate materials and report learning; weak evidence stays verify/watch.

## Personas and jobs
- Primary personas: founder/operator reviewing agentic opportunities; Hermes/OpenClaw-like agents consuming Praxies; builder deciding what to test next.
- User jobs: know what happened, why it matters, what agent should test, what evidence supports it, what changed since latest run.
- Key contexts of use: desktop review, mobile skim, agent-readable API/MCP/ACP flows.

## Information architecture
- Primary navigation: Map, Lists, Praxies, Repos, Reports, Radar, Operator, Agents, ACP, Source.
- Core routes/screens: `/`, `/praxies`, `/actions`, `/operator`, `/agents`, `/acp/settings`, `/ingestion`, `/radar/runs`.
- Content hierarchy: executive thesis → stats/run state → Praxis loop → field brief → evidence/dispatch → source/repo cuts.

## Design principles
- Principle 1: Brief before feed. Summarize chaos first, hide long text behind detail paths.
- Principle 2: Evidence is UI. Source URLs, confidence, status, and owner are visible, not buried.
- Principle 3: Agents and humans share same map. Human pages explain what agent APIs will consume.
- Tradeoffs: dense enough for operators, but never text-bleed; use rows and clipped cards over endless paragraphs.

## Visual language
- Color: paper `#F3EEE3`, paper alt `#EBE4D6`, white card `#FFFDFA`, ink `#181612`, muted `#756E62`, line `#CFC6B5`, gold `#A26A1E`.
- Typography: huge tight Arial/Helvetica editorial headlines; monospace body/meta labels.
- Spacing/layout rhythm: full-width editorial sections, hard grid dividers, stat strips, row directories.
- Shape/radius/elevation: square corners, 1px borders, no shadows by default.
- Motion: minimal hover background only; no ornamental animation.
- Imagery/iconography: text-first, section marks, run/status glyphs; avoid generic AI icons.

## Components
- Existing components to reuse: atlas topbar, stat strip, report headlines, overviewMeta pills, loop cards, source rows.
- New/changed components: OpenDesign homepage composition can add mission strip, signal board, agent lane cards.
- Variants and states: high/medium/low confidence, verify/watch/buildroom lanes, empty ingestion state, ACP key reveal.
- Token/component ownership: tokens live in `src/app/globals.css`; route composition in `src/app/page.tsx`.

## Accessibility
- Target standard: pragmatic WCAG AA for contrast, keyboard navigation, semantic sections.
- Keyboard/focus behavior: all cards linking to details must be focusable; active nav centered on mobile.
- Contrast/readability: ink on paper, muted text only for secondary metadata.
- Screen-reader semantics: section labels and headings must describe purpose.
- Reduced motion and sensory considerations: no required animation.

## Responsive behavior
- Supported breakpoints/devices: desktop operator board, tablet stacked dashboard, mobile bottom nav and single-column cards.
- Layout adaptations: hard grids collapse to 1-2 columns; long rows become stacked cards; nav becomes bottom scroll rail.
- Touch/hover differences: hover not required for discovery; all detail paths visible.

## Interaction states
- Loading: keep static shell readable; show empty-state copy if no runs/cards.
- Empty: explain next command or ingestion path.
- Error: show exact failing run/stage and route to Source/Operator.
- Success: show counts, latest run, artifacts written, agent_ready.
- Disabled: muted controls with reason.
- Offline/slow network: local markdown remains primary source of truth.

## Content voice
- Tone: direct, operational, premium, not dystopian.
- Terminology: Praxis, field training, source-linked, decision memory, learning report, operator brief, ACP adapter.
- Microcopy rules: short sentences; no hype verbs; every claim needs action/evidence/status.

## Implementation constraints
- Framework/styling system: Next.js app router with global CSS, no new dependency for v1 redesign.
- Design-token constraints: preserve Atlas paper/ink/gold tokens; add overrides at bottom of `globals.css` when experimenting.
- Performance constraints: static file-backed UI should stay fast; avoid client-heavy homepage.
- Compatibility constraints: preserve markdown source-of-truth and existing routes.
- Test/screenshot expectations: run lint/build after UI edits; browser QA if local server is available.

## Open questions
- [ ] OpenDesign reference: exact external opendesign tool not installed in current shell; use repo-local design harness until available.
