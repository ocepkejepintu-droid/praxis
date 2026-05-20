# Praxis SaaS – Next Milestone Guide  
**Safe Real RuntimeRunner + Production Job Queue**  
*Version: 2026-05-19 (Alpha → Closed Beta)*  
**Target CLIs:** Hermes + OMX (OpenClaw)  

---

## 1. Goal of This Milestone (READ THIS FIRST)

Turn the current **mock-only** learning loop into a **real, production-safe** execution engine.

**High-reward outcome**  
Agents will now study *real* Hermes/OpenClaw workflows overnight → generate real skill drafts → deliver real morning reports.

**High-risk reality**  
Real execution = potential RCE, cost explosion, secret leaks, or tenant cross-contamination.

**Our unbreakable rule**  
**Real runtime stays TURNED OFF by default for ALL users.**  
We start with **Read-Only** mode only.

---

## 2. Risk-Mitigation Strategy (MANDATORY)

We adopt a **Read-First + Explicit Permission** model:

| Phase | Mode                | What it does                                      | Risk | When to enable |
|-------|---------------------|---------------------------------------------------|------|----------------|
| 0     | Mock (current)      | Everything mocked                                 | None | Already live   |
| 1     | **Read-Only**       | Fetch workflows/logs/state **without running**    | Very Low | **This milestone** |
| 2     | Permissioned Run    | User must approve **each** real run               | Low  | After 2 weeks of Phase 1 |
| 3     | Full Autonomous     | Nightly runs with hard limits (future)            | Medium | After 1 month live data |

**Do not skip this.**  
Keep real execution blocked until Phase 2 is fully tested with design partners.

---

## 3. High-Level Architecture

```mermaid
graph TD
    A[Job Queue (BullMQ + Redis)] --> B[Job Worker]
    B --> C[RuntimeRunner Service]
    C --> D[Hermes Contract]
    C --> E[OMX / OpenClaw Contract]
    C --> F[Tenant Sandbox Workspace]
    F --> G[Docker / Firecracker Sandbox]
    G --> H[Approved CLI/API only]
    H --> I[Output Validator + Log Capturer]
```

**Core new component:** `RuntimeRunner`

---

## 4. Step-by-Step Implementation Plan (2–3 weeks)

### Week 1 – Contracts & Read-Only Mode (Safe & Fast)

1. Define formal contracts  
   Create:  
   - `packages/runtime/contracts/hermes-contract.ts`  
   - `packages/runtime/contracts/omx-contract.ts` (or openclaw-contract.ts)

2. Implement **Read-Only RuntimeRunner**  
   - Use only read APIs / `--dry-run` flags from Hermes and OMX.  
   - Store results in tenant-scoped folder: `./storage/tenants/{tenantId}/workspaces/`  
   - Default runtime mode in tenant config = `'read-only'`

3. Update Learning Loop & Quality Gate  
   - Morning report must say: “Read-only analysis complete (X workflows scanned)”

4. Update Dashboard  
   - Show “Runtime Status: Read-Only • Real execution disabled”  
   - Add “Request Execution Permission” button

### Week 2 – Safe Execution Path (Permissioned Mode)

5. Build Sandbox Layer  
   - Use Docker + gVisor (or Firecracker for stronger isolation)  
   - Create `RuntimeRunner.executeSafe()` with:  
     • Strict command allowlist  
     • Tenant-specific workspace  
     • Hard timeout + resource limits  
     • Output validation + secret scanning

6. Permission System  
   - Generate one-time approval token (JWT, 15 min expiry)  
   - User must click “Approve this run” in dashboard  
   - Log every approval for audit

7. Switch to Production Job Queue  
   - Use BullMQ + Redis  
   - Add status tracking, retry, cancel, per-tenant limits

### Week 3 – Production Polish

8. Migrate storage to PostgreSQL (tenant-isolated)  
9. Add Stripe for real billing  
10. Add email + Telegram notifications  
11. Add monitoring & quota alerts

---

## 5. Security Checklist (NON-NEGOTIABLE – CHECK ALL)

- [ ] All commands go through strict allowlist  
- [ ] No arbitrary `child_process.exec` or `eval`  
- [ ] Tenant workspace fully isolated (Docker volume)  
- [ ] Secrets scanning on every log/output  
- [ ] Hard timeout + memory/CPU limits  
- [ ] Real runtime blocked by default in config + DB  
- [ ] Full audit log for every runtime call  
- [ ] Rate limiting per tenant  

---

## 6. Rollout Plan for Design Partners

1. Invite 3–5 trusted partners this week (still on mocks).  
2. After Week 1 → enable **Read-Only** for them.  
3. After Week 2 → give them the “Approve Run” button.  
4. Monitor everything for 2 weeks before expanding.

---

## 7. Success Criteria (when milestone is complete)

- Hermes and OMX can run safely in **Read-Only** mode today.  
- Permissioned real runs work only with explicit user approval.  
- Morning reports contain **real** insights.  
- Job queue is durable and observable.  
- System ready for closed-beta paid users.

---

**Next immediate actions for you (Hermes + OMX team):**

1. Create the two contract files **today**.  
2. Start with **Hermes only** for Read-Only mode.  
3. Once contracts are ready, reply with “CONTRACTS READY” and we will give you the exact RuntimeRunner skeleton.

**Safety first. Speed second.**  
This turns the alpha skeleton into a real product.
