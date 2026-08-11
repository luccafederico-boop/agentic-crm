# Handoff — resume point

> Snapshot updated 2026-08-11 at the end of Phase 4. Read `AGENTS.md` first for
> architecture and gotchas; this file is the "where exactly did we stop" note.

## State

| Item | Status |
|---|---|
| Production | https://agentic-crm-delta.vercel.app — live, login working (runtime on the transaction pooler after the `EMAXCONNSESSION` incident) |
| Phases 0–4 | ✅ complete, deployed, CI green |
| Tests | 22 passing (9 evidence unit + 4 queue integration + 9 currency) |
| Agent E2E | Verified live: ambiguous person → 0 facts saved; real public person → 3 `verified` facts auto-applied with cited sources; research also executed on Vercel prod |
| Chat | ✅ runtime-tested (streams, runs tools, persists transcript). Fixed: tool outputs must be plain JSON — Date objects break streamText step 2 |
| Visible lane | ✅ `mirror_logo` live — 10/10 seed logos mirrored to Supabase Storage |
| Multi-currency | ✅ deals keep native currency; totals convert at aggregation time to the workspace base currency (editable in Settings) via lazily-cached daily frankfurter.app rates (`exchange_rates` table, 24h TTL, stale-on-API-failure) |

## Pending checklist (start here)

- [ ] User manual QA in production: Research button, task trace, `/review`, chat panel, dashboard, Ctrl+K, Settings → base currency
- [ ] Investigate why `push` doesn't auto-trigger GitHub Actions (manual `gh workflow run CI` works)
- [ ] Rotate/revoke the Supabase personal access token once infra automation is no longer needed
- [ ] Next feature work: **Phase 5 — Gmail + Calendar sync** (needs the user to create a Google Cloud OAuth client — Testing mode)

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
