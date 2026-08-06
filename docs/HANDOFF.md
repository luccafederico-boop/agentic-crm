# Handoff — resume point

> Snapshot written 2026-08-06 at the end of Phase 2. Read `AGENTS.md` first for
> architecture and gotchas; this file is the "where exactly did we stop" note.

## State

| Item | Status |
|---|---|
| Production | https://agentic-crm-delta.vercel.app — live, login working |
| Phases 0–2 | ✅ complete, deployed, CI green |
| Tests | 13 passing (9 evidence unit + 4 queue integration) |
| Agent E2E | Verified live: ambiguous person → 0 facts saved; real public person → 3 `verified` facts auto-applied with cited sources |

## Pending checklist (start here)

- [ ] **Manual QA of Phase 2 in production**: Research button on a contact, live task trace, `/review` approve/dismiss flow, evidence popovers
- [ ] **"Ask agent" chat**: typechecks and builds but was **never exercised at runtime** — open a contact, ask something, watch for errors (`/api/agent/chat`)
- [ ] Collect user feedback on Phase 2 UX before building Phase 3
- [ ] Deals kanban sums stage totals assuming USD (fine until Phase 4 fixes it properly)
- [ ] Investigate why `push` doesn't auto-trigger GitHub Actions (manual `gh workflow run CI` works)
- [ ] Rotate/revoke the Supabase personal access token once infra automation is no longer needed
- [ ] Next feature work: **Phase 3** (see roadmap in `AGENTS.md`)

## Laptop setup

1. Install Node 24+, then `npm i -g pnpm`
2. `git clone https://github.com/luccafederico-boop/agentic-crm && cd agentic-crm`
3. Copy the **`.env`** file into the repo root — it is the ONLY artifact that does
   not travel via git. Bring it over a private channel (password manager, USB);
   never commit it. It also contains the demo login and infra refs as comments.
4. `pnpm install` → `pnpm dev` → http://localhost:3000
5. The database is remote (Supabase) — data, seed and migrations are already
   there; nothing to migrate unless the schema changed.
6. Optional for automation parity: `gh` CLI (logged in) and `vercel` CLI
   (`vercel link --yes --project agentic-crm`).

## Useful endpoints

- `POST /api/agent/drain?s=<AGENT_DRAIN_SECRET>` — drain the agent queue manually (also accepts GET for external pingers)
- `GET /api/cron/daily` — Vercel cron backstop (requeues stale leases + drains); needs Bearer secret
