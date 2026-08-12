# Handoff — resume point

> Snapshot updated 2026-08-11 at the end of Phase 5. Read `AGENTS.md` first for
> architecture and gotchas; this file is the "where exactly did we stop" note.

## State

| Item | Status |
|---|---|
| Production | https://agentic-crm-delta.vercel.app — live, login working (runtime on the transaction pooler after the `EMAXCONNSESSION` incident) |
| Phases 0–5 | ✅ complete, deployed, CI green |
| Tests | 27 passing (9 evidence + 4 queue + 9 currency + 5 google) |
| Agent E2E | Verified live: ambiguous person → 0 facts saved; real public person → 3 `verified` facts auto-applied with cited sources; research also executed on Vercel prod |
| Chat | ✅ runtime-tested (streams, runs tools, persists transcript). Fixed: tool outputs must be plain JSON — Date objects break streamText step 2 |
| Visible lane | ✅ `mirror_logo` live — 10/10 seed logos mirrored to Supabase Storage |
| Multi-currency | ✅ deals keep native currency; totals convert at aggregation time to the workspace base currency (editable in Settings) via lazily-cached daily frankfurter.app rates (`exchange_rates` table, 24h TTL, stale-on-API-failure) |
| Google sync | ✅ OAuth flow live (Testing-mode Google app, read-only Gmail/Calendar scopes). Refresh token AES-256-GCM encrypted in `google_accounts`. `google_sync` task (visible lane) matches messages/events to contacts by email → deduped timeline activities (`activities.external_id`). Enqueued on connect, "Sync now", and the daily cron |

## Portfolio mode (2026-08-11)

- Open signup: every new user gets an auto-seeded workspace (`lib/demo-data.ts`) with logo mirroring queued.
- Daily per-workspace caps on paid features (`lib/limits.ts`): research runs and chat messages (env-overridable `RESEARCH_DAILY_LIMIT` / `CHAT_DAILY_LIMIT`).
- Credentials rotated on 2026-08-11: DB password, `AGENT_DRAIN_SECRET`, `APP_ENCRYPTION_KEY` (old Google connection wiped — reconnect in Settings).

## Pending checklist (start here)

- [ ] User: rotate Anthropic API key + Google OAuth client secret; revoke the Supabase personal access token (see chat checklist 2026-08-11)
- [ ] User: reconnect Google in Settings (encryption key rotation invalidated the stored token)
- [ ] `push` auto-trigger on GitHub Actions started working on 2026-08-11 — keep an eye; `gh workflow run CI` still available
- [ ] Optional polish: Gmail sync uses a 50-message window per run; consider Gmail `historyId` incremental sync if volume grows

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
