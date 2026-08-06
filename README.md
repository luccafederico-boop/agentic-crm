# Agentic CRM

An agent-first CRM, built as a portfolio project. Inspired by
[trycompai/crm](https://github.com/trycompai/crm) (MIT), rebuilt from scratch
with a deliberately simpler stack.

The differentiator is not the CRUD — it's the **research agent with an
evidence ledger**: every fact the agent finds carries weighted evidence.
Strong evidence auto-applies to the record; weak evidence becomes a suggestion
a human reviews. Nothing about a person is guessed.

## Stack

| Layer | Choice |
|---|---|
| App | Next.js (App Router) — single app, Server Actions, no separate backend |
| Database | Supabase Postgres + Drizzle ORM (checked-in SQL migrations) |
| Auth | Supabase Auth (Google + email/password) |
| Storage | Supabase Storage (company logos) |
| Agent | Vercel AI SDK + Anthropic Claude, DB-backed task queue (`FOR UPDATE SKIP LOCKED`) |
| UI | shadcn/ui + Tailwind, recharts, cmdk |
| Tooling | pnpm, Biome, Vitest, GitHub Actions |

## Getting started

1. Create a [Supabase](https://supabase.com) project. Enable the **Email** and
   **Google** auth providers (Authentication → Providers).
2. `cp .env.example .env` and fill in the Supabase keys and `DATABASE_URL`.
3. Install and migrate:

   ```sh
   pnpm install
   pnpm db:migrate
   ```

4. `pnpm dev` and open http://localhost:3000.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | What CI runs |
| `pnpm db:generate` | Generate a migration from `lib/db/schema.ts` |
| `pnpm db:migrate` | Apply migrations to `DATABASE_URL` |
| `pnpm seed` | Seed demo data (Phase 1) |

## Roadmap

- [x] Phase 0 — Scaffold, auth, workspace bootstrap, CI
- [x] Phase 1 — Core CRM: companies, contacts, deals, activities timeline
- [x] Phase 2 — Research agent + evidence ledger + review UI + record chat
- [ ] Phase 3 — Dashboards, quick switcher, logo mirroring
- [ ] Phase 4 — Multi-currency deals
- [ ] Phase 5 — Gmail + Calendar sync
