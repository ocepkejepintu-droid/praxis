# Praxis Learning SaaS Current Status

Updated: 2026-05-19

## Verdict

Praxis Learning is now a **SaaS alpha skeleton**, not full production yet.

```text
SaaS alpha skeleton ✅
Safe mock product loop ✅
Real paid production system ❌
```

## What Works Now

- Praxis quality gate
- Nightly/batch Praxis learning loop
- Mock Hermes learner
- Mock OpenClaw learner
- Morning report JSON/MD
- Skill draft generation
- Dashboard Praxis learning panel
- Per-user/tenant-safe file-backed storage
- Jobs API skeleton
- $100/mo Praxis Pro plan skeleton
- Plan limit enforcement
- Runtime sandbox boundary
- Real Hermes/OpenClaw blocked by default
- Usage counters
- Notification config skeleton
- Ultra QA artifact

## QA Status

Approved for alpha onboarding with accounts, tenant-safe reports/jobs, plan limits, mock safe learning, and blocked real runtimes.

QA artifact:

```text
research-vault/ops/qa/praxis-saas-alpha-ultraqa-report.json
```

## Tests Passed

```bash
npm run test:praxis-saas
npm run test:praxis-learning
npm run test:praxis-quality-gate
npm run test:praxis-learning-loop
npm run test:hermes-acp
npm run test:school-acp
npm run test:auth-acp
npm run test:user-sessions
npm run test:security-hardening
npm run lint
npm run build
```

Extra QA passed:

- tenant isolation
- job lifecycle
- plan limits
- real runner blocked by default
- no secrets found
- no x_search quota leak
- skill draft path safe
- public status sanitized
- API smoke
- dashboard surface

## Main Remaining Gaps

### 1. Real Agent Runtime

Current:

```text
mock-hermes ✅
mock-openclaw ✅
real hermes ❌ blocked
real openclaw ❌ blocked
```

Need safe RuntimeRunner bridge for real Hermes/OpenClaw.

RuntimeRunner must handle:

- approved command/API only
- tenant workspace
- timeout
- allowlist
- no arbitrary command execution
- log capture
- output validation
- no secrets leak

### 2. Production Job Queue

Current job runner is file-backed/dev-alpha mode.

Need:

- durable queue
- worker process
- retry/cancel
- status tracking
- per-user scheduling

### 3. Payments

Current:

```text
Praxis Pro $100/mo plan skeleton ✅
Stripe checkout ❌
real subscription billing ❌
```

Need Stripe or equivalent.

### 4. Production Storage

Current tenant isolation is file-backed.

Need production DB/storage for real users.

### 5. Notifications

Current:

- morning report created
- notification target config skeleton exists

Need real delivery:

- email
- Telegram
- WhatsApp
- Slack/Discord optional

### 6. Deployment

Current:

- local build passes
- no production deploy/infra confirmed

Need:

- hosting
- env management
- DB
- worker
- monitoring
- backups

### 7. Real x_search Budget

Current:

- x_search disabled/budget-gated
- no quota leak

Need if enabled:

- per-user xAI quota tracking
- call budget
- cost reporting
- stop-on-quota-error

## Best Next Milestone

Build real RuntimeRunner + production job queue.

Recommended order:

1. Define Hermes CLI/API contract.
2. Define OpenClaw CLI/API contract.
3. Implement safe RuntimeRunner interface.
4. Add tenant sandbox workspace.
5. Add job worker.
6. Persist jobs/reports to DB.
7. Add Stripe.
8. Add morning notification delivery.

## Product Positioning

Sell as:

> Your agents study real-world agent workflows overnight, test what works, and turn lessons into reusable skills.

## Current Sellability

Good for:

- private alpha
- founder demo
- design partners
- internal dogfooding
- waitlist demo

Not yet ready for:

- open public signups
- unsupervised real agent execution
- production paid strangers at scale
