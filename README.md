# Agent Radar Dashboard

Local-first **one-person company OS** for turning AI-agent Markdown feeds into decisions, experiments, and follow-up work.

## V1 surfaces

- **CEO desk** (`/`) — command prompts, act-now ideas, clean actions, risky repo leads.
- **Ideas** (`/ideas`) — slices long captures into `act now`, `worth trying`, `watch`, and `ignore` lanes.
- **Experiments** (`/experiments`) — Kanban board for `worth trying`, `queued`, `tried`, `adopted`, and `killed` tests.
- **Ingestion** (`/ingestion`) — Kimi WebBridge → X → Markdown pipeline prompt and output contract.
- **Repos** (`/repos`) — verified/unverified repo leads with status, risk, category, and source note.
- **Actions** (`/actions`) — concrete imperative next actions only, filtered out from noisy prose.
- **Radar** (`/radar`) — relevance/actionability map.
- **Notes** (`/notes/[slug]`) — source Markdown detail.

## Kimi WebBridge X ingestion

Manual ingestion command:

```bash
npm run ingest:x -- --health   # checks daemon + browser extension readiness
npm run ingest:x -- --dry-run  # preview cards under .omx/ingestion-runs/
npm run ingest:x              # live crawl; writes structured cards into Inbox/, Repos/, Use Cases/, Scorio Ideas/, Experiments/
```

The `/ingestion` page shows the latest run status, card count, blocked/failed state, files, verification gaps, and recent local run history.


The reusable crawl prompt lives at:

- `Meta/KimiWebBridge-X-Ingestion-Pipeline.md`
- `prompts/kimiwebbridge-x-ingestion.md`

Output folders are pre-created:

- `Inbox/`
- `Repos/`
- `Use Cases/`
- `Scorio Ideas/`
- `Experiments/`
- `Weekly Syntheses/`


## Hermes ingestion API

Hermes can trigger or inspect ingestion through the local app server. Optional auth is controlled by `HERMES_INGEST_TOKEN`; when set, send `Authorization: Bearer <token>`.

```bash
# status / latest run
curl http://127.0.0.1:3000/api/hermes/ingest

# scheduled deep crawl
curl -X POST http://127.0.0.1:3000/api/hermes/ingest \
  -H "Content-Type: application/json" \
  -d '{"mode":"live","maxScrolls":24,"maxCards":60,"source":"home"}'
```

The endpoint only runs the pinned local script (`scripts/ingest-x.ts`); it does not accept arbitrary shell commands.

## Run

```bash
npm install --ignore-scripts --no-audit --no-fund
npm run dev
```

Open <http://localhost:3000>.

## Verify

```bash
npm run test:parser
npm run lint
npm run build
```

Optional production smoke:

```bash
npm run start -- -p 3100
```
