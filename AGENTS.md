<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Agentic CRM — Project Context

Portfolio project: an **agent-first CRM** inspired by [trycompai/crm](https://github.com/trycompai/crm) (MIT), rebuilt from scratch with a deliberately simpler stack. The differentiator is the **research agent + evidence ledger**: every fact the agent finds carries weighted evidence; strong primary evidence auto-applies to the record, weak evidence becomes a human-reviewed proposal. Core rule: *nothing about a person is guessed* — see `lib/agent/evidence.ts` and `lib/agent/prompts.ts`.

Current state and pending work: see `docs/HANDOFF.md`. UI, code, and commits are in **English**; conversation with the user may be in Portuguese.

## Architecture

- **Single Next.js 16 app** (App Router, Server Actions) — no separate backend, no monorepo.
- **Supabase**: Postgres + Auth (email/password with autoconfirm; Google postponed to Phase 5) + Storage (Phase 3). DB access via **Drizzle ORM** over the session pooler (port 5432, `postgres-js` with `prepare: false`). Migrations are checked-in SQL in `drizzle/` (`pnpm db:generate` → hand-append RLS/functions when needed → `pnpm db:migrate`).
- **Agent**: Vercel AI SDK (`ai` v7) + `@ai-sdk/anthropic`, model `claude-sonnet-5` (env `AGENT_MODEL`). Native Anthropic **web search** tool (no Perplexity). DB-backed queue `agent_tasks` claimed via `claim_agent_task()` SQL function (`FOR UPDATE SKIP LOCKED` + lease), two lanes (`visible` = no-LLM, `research` = LLM). Drain: `after()`-poke from Server Actions + secret-protected `POST /api/agent/drain` + daily Vercel cron backstop (`/api/cron/daily`). No per-minute cron (Vercel hobby limit).
- **Auth flow**: `proxy.ts` → `lib/supabase/middleware.ts` (session refresh + redirects); `lib/auth.ts` has `requireUser()` / `ensureWorkspace()` (one workspace per user, auto-created). Every domain table carries `workspace_id`.
- **Deploy**: Vercel (`vercel deploy --prod --yes`), project `agentic-crm`. Production: https://agentic-crm-delta.vercel.app

## Hard-won gotchas (do not rediscover these)

1. **shadcn now generates Base UI** (`@base-ui/react`), not Radix: composition is `render={<Element/>}`, **not** `asChild`. Triggers take `React.ReactElement`.
2. **Next 16 renamed middleware to `proxy.ts`** (default export `proxy`). `/api/*` routes are never redirected to the login page — each API route enforces its own auth (session or shared secret).
3. **`lib/db/index.ts` is a lazy Proxy singleton** — `next build` must succeed without `DATABASE_URL`. Never make DB creation eager at import time.
4. **pnpm 11 blocks postinstall scripts**: new native deps need an entry in `pnpm-workspace.yaml` `allowBuilds`, then `pnpm rebuild`.
5. **NEVER pipe secret values through PowerShell 5.1** (`"value" | some-cli`): it prepends an invisible U+FEFF BOM — this corrupted all Vercel env vars and broke production login once. Use Git Bash: `printf '%s' "$VALUE" | cli`.
6. **GitHub Actions on this repo does not auto-trigger on push** (account quirk). Run `gh workflow run CI --repo luccafederico-boop/agentic-crm` after pushing.
7. Supabase pooler host for this project is **aws-0**-ca-central-1 (aws-1 → "tenant not found").
   **Runtime must use the TRANSACTION pooler (port 6543)** — the session pooler's client cap gets exhausted by concurrent serverless lambdas (`EMAXCONNSESSION` 500s took prod down once). Session pooler (5432, `DATABASE_URL_SESSION`) is only for drizzle-kit migrations. Keep postgres-js at `max: 5` per instance.
8. Biome 2.5: folder ignores without `/**`; `components/ui`, `drizzle`, `public` are excluded; css `tailwindDirectives: true`.

## Commands

| Command | Purpose |
|---|---|
| `pnpm dev` / `pnpm build` | dev server / production build |
| `pnpm lint` · `pnpm typecheck` · `pnpm test` | what CI runs (Postgres service + `db:migrate` first) |
| `pnpm db:generate --name x` / `pnpm db:migrate` | create / apply migrations |
| `pnpm seed` | deterministic demo data into the FIRST workspace (log in once first) |
| `vercel deploy --prod --yes` | deploy production |

## Roadmap

- [x] Phase 0 — scaffold, Supabase auth, workspace bootstrap, CI
- [x] Phase 1 — core CRM (companies, contacts, deals kanban, activities timeline, seed)
- [x] Phase 2 — research agent + evidence ledger + review UI + record chat
- [x] Phase 3 — dashboards (recharts), cmdk quick switcher, logo mirror to Supabase Storage (`visible` lane), README polish
- [x] Phase 4 — multi-currency (frankfurter.app, lazy fetch, convert at aggregation time)
- [x] Phase 5 — Gmail + Calendar sync (separate OAuth flow, encrypted refresh tokens, Testing-mode Google app)
