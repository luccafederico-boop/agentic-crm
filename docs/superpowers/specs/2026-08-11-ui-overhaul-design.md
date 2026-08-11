# UI/UX Overhaul — Design

**Date:** 2026-08-11 · **Approved direction:** user picked every option below via
Q&A; approval gates waived ("apenas execute").

## Goal

Kill the "raw shadcn template" feel. Target: **Attio-style clean premium** —
light and airy, warm neutrals, one disciplined accent color, refined typography,
full-app consistency. Presentation-only: no behavior, data, or route changes.

## Decisions (user-confirmed)

| Decision | Choice |
|---|---|
| Visual direction | Attio/Notion clean premium |
| Themes | Light + dark with toggle (light/dark/system) |
| Scope | Full pass on every screen |
| Accent | Indigo/violet — reads "AI product" |
| Strategy | Option A: refine in place; shadcn `Sidebar` component for the shell |

## Design

### Theme tokens (`app/globals.css`)
- Accent: indigo — light `--primary` ≈ oklch(0.51 0.22 277), dark ≈ oklch(0.67 0.18 277).
- Neutrals: near-neutral warm grays (tiny chroma, stone-leaning hue) replacing
  the current pure-gray zero-chroma scale; dark mode gets true dark surfaces
  (not pure black) with slightly lighter cards.
- Charts: single-hue indigo steps for `--chart-1..5`, tuned per theme.
- Sidebar tokens: distinct surface (slightly tinted) in both themes.
- Typography stays Geist; headings get tighter tracking via utility classes.

### Dark mode
`next-themes` with `attribute="class"`, ThemeProvider in root layout,
`suppressHydrationWarning` on `<html>`, three-state toggle in the sidebar footer.

### Shell
shadcn `Sidebar` (Base UI variant): collapsible to icons, mobile sheet, groups
**Workspace** (Dashboard, Contacts, Companies, Deals) and **Agent** (Review with
pending-facts badge, Settings in footer area). Header: logo mark + workspace
name. Footer: user email, theme toggle, sign out. Active route highlighted via
`usePathname`. Slim topbar inside main: `SidebarTrigger`, page context, and a
search button that opens the existing QuickSwitcher (window CustomEvent) with a
⌘K hint.

### Dashboard
Same data, restructured presentation: refined stat cards (label, large number,
icon, subtext), charts recolored to accent ramp, recent-activity list with
per-type icons + relative time, agent queue tiles tightened.

### Pages pass
- Lists (contacts/companies): stronger rows — avatar/logo, hover, aligned meta.
- Deals kanban: column header with count pill + converted total; card with
  prominent amount, company logo.
- Detail pages/review/settings: inherit tokens; targeted spacing/hierarchy
  fixes via shared `PageHeader` and Card usage.
- Login: centered card, logo mark, accent button.

### Non-goals
No structural navigation changes (tabs, sliding panels), no table framework,
no new features. Behavior and Server Actions untouched.

### Verification
`pnpm lint/typecheck/test/build`; authed smoke against dev server for every
route (200 + key markers); deploy + prod smoke.
