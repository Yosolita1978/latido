# LATIDO — Project Guide

AI-powered daily planner for solopreneurs. Three AI agents (Capture, Day Architect, Accountability) coordinate through a FastMCP server connected to Supabase with pgvector. Talavera-inspired dark theme, mobile-first, Spanish-first UI.

**Core differentiator:** closed feedback loop. Plan → execute → compare → extract patterns → improve next plan. The Accountability Agent writes behavioral observations to `user_patterns` with vector embeddings; the Day Architect reads them before generating each plan.

## Tech Stack

- **Frontend:** Next.js 16 (App Router, Server Components by default), TypeScript strict, Tailwind CSS v4, React 19
- **Database:** Supabase (PostgreSQL + pgvector + RLS on every table)
- **Auth:** Supabase Auth (magic link, email-based) via `@supabase/ssr`
- **AI:** OpenAI (GPT for agents, text-embedding for embeddings)
- **MCP Server:** FastMCP (Python) with 14 tools, runs on port 8080, protected by API key middleware
- **Automation:** n8n Cloud (CRON workflows) + Telegram Bot (notifications)
- **Hosting:** Vercel (frontend) + Render (MCP server) — deployed and live at milatido.vercel.app

## Security

- **MCP API key:** Shared `MCP_API_KEY` between frontend and MCP server. All requests require `Authorization: Bearer <key>`. Middleware in `mcp-server/main.py` rejects unauthorized calls with 401.
- **Auth:** Supabase Auth with magic link. `proxy.ts` refreshes sessions and redirects unauthenticated users to `/login`. Auth callback at `/auth/callback`.
- **user_id:** Never trusted from the client. All API routes extract `user_id` from the Supabase session via `requireUser()` in `src/lib/auth.ts`. Client components receive `userId` via React context (`AuthProvider`).
- **Admin client:** `createAdminClient()` in `src/lib/supabase.ts` uses `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS). Used only in server-side code for operations that need cross-user access or realtime subscriptions.

## Code Principles

- No `any` types in TypeScript
- No fallback mechanisms — they hide real failures
- Rewrite existing components instead of adding new ones
- RLS with `user_id` on every table, no exceptions
- Server components by default, client only when interactive
- Mobile-first (320px minimum viewport)
- Spanish-first UI
- Full file outputs, never partial snippets

## Project Structure

```
frontend/           Next.js app
  src/app/          App Router pages and API routes
  src/app/login/    Magic link login page
  src/app/auth/     Auth callback route
  src/app/api/cron/ CRON endpoints for n8n (plan, reflect, morning-status, chronic-deferrals)
  src/components/   React components by feature
  src/lib/          Shared utilities (mcp-client, supabase, auth, openai, enfoque, dates)
  src/lib/agents/   AI agent logic (plan.ts with generatePlan + regeneratePlan, accountability.ts)
  src/proxy.ts      Auth proxy (Next.js 16 — replaces middleware.ts)
  src/styles/       Talavera design tokens
mcp-server/         Python FastMCP server (main.py, 14 tools)
supabase/           Database migrations (001-004)
docs/               Architecture and workflow documentation
```

## Data Flow

```
Frontend (Next.js) → HTTP → Python MCP Server (FastMCP :8080) → Supabase PostgreSQL
                                                                → OpenAI API (embeddings, LLM)
```

All frontend API routes call MCP tools via `src/lib/mcp-client.ts`. No direct Supabase queries from the frontend except for auth and realtime subscriptions.

## Three AI Agents

1. **Capture** (`/api/agents/capture`) — extracts structured tasks from natural language, hybrid search for deduplication, auto-regenerates today's plan in background via `after()`
2. **Day Architect** (`/api/agents/plan`) — generates daily plan with TOP 3 priorities, energy-aware scheduling, reads user patterns. `regeneratePlan()` resets scheduled tasks to inbox before replanning.
3. **Accountability** (`/api/agents/accountability`) — generates Spanish reflection, extracts behavioral patterns, stores with embeddings

## Enfoque Score (0–5)

Composite focus metric, NOT a completion rate:
- **Alignment (40%)** — doing planned tasks in the right time window (±1 hour)
- **Energy match (30%)** — high-energy tasks during peak window, low-energy outside
- **Priority integrity (30%)** — TOP 3 tasks completed

Implementation: `frontend/src/lib/enfoque.ts`

## Key Database Tables

- `tasks` — with `title_search` TSVECTOR and `embedding` VECTOR(768)
- `daily_plans` — `time_blocks` JSONB array of TimeBlock objects
- `user_patterns` — behavioral patterns with vector embeddings and confidence scores
- `projects` — user projects with status (active/paused/wishlist)
- `user_settings` — timezone, work hours, preferences
- `commitments` — recurring obligations

## MCP Tools (14)

`get_unscheduled_tasks`, `get_active_commitments`, `get_user_patterns`, `get_user_settings`, `write_daily_plan`, `update_task_status`, `capture_task`, `search_tasks_hybrid`, `write_pattern`, `get_todays_plan`, `get_projects`, `defer_to_tomorrow`, `update_user_settings`, `get_chronic_deferrals`

## Design System (Talavera)

Dark theme with Mexican ceramic tile aesthetic. Color tokens defined in `frontend/src/styles/talavera.css`:
- `--azul` (primary blue), `--rojo` (red/high energy), `--amarillo` (yellow/medium energy)
- `--terracotta` (accent), `--crema` (light text), `--gris` (muted)
- `--fondo` (dark background), `--superficie` (card surface)

## Environment Variables

Frontend needs: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `MCP_SERVER_URL`, `MCP_API_KEY`, `CRON_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`

MCP server needs: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MCP_API_KEY`

n8n needs: `CRON_API_KEY` (as Header Auth credential), Telegram Bot Token, Chat ID

## Timezone Handling

All date calculations use `src/lib/dates.ts` with the user's IANA timezone from `user_settings`. Never use `new Date().toISOString().split("T")[0]` — it returns UTC which is wrong after 5 PM PDT. The MCP server also avoids `date.today()` for the same reason; dates are passed from the frontend.

## Google Calendar Integration

Connected via OAuth2. Tokens stored in `google_oauth_tokens` table. `getTodayEvents(userId, timezone, targetDate?)` in `src/lib/google-calendar.ts` fetches events for any date. Calendar events are shown in /hoy, /manana, and included in n8n Telegram messages.

## n8n Automation (Daily Loop)

| Workflow | Schedule | What it does |
|----------|----------|-------------|
| W1 Evening Plan | 8 PM PST | Generates/regenerates tomorrow's plan, sends Telegram with TOP 3 + calendar |
| W2 Nightly Reflection | 9:30 PM PST | Runs accountability agent, sends reflection + patterns learned |
| W4 Morning Nudge | 7:30 AM PST | Auto-generates plan if none exists, sends Telegram with tasks + calendar |
| W5 Health Monitor | 7:00, 13:00, 19:30 PST | Checks Vercel + Render health, alerts on 2 consecutive failures |

All workflows use `Latido Cron Auth` (Header Auth with `CRON_API_KEY`) and send via Telegram Bot. See `docs/n8n-workflows-plan.md` for full details.

## Task Status Lifecycle

```
inbox → scheduled (by generatePlan/write_daily_plan)
      → completed (by user action, sets completed_at)
      → deferred  (by user action, increments deferred_count, removes from plan)
```

`get_unscheduled_tasks` returns tasks with status `inbox`, `deferred`, or `scheduled` (with `completed_at IS NULL`). This ensures tasks stuck as `scheduled` from old plans are always picked up for replanning.

## Auto-Regeneration

When a new task is captured, the plan auto-regenerates in the background via `after()` (Next.js). The `regeneratePlan()` function resets `scheduled` tasks to `inbox` first, then calls `generatePlan()` so all available tasks are considered.

## Known Issues

- SSE reconnection doesn't handle MCP server restarts (needs exponential backoff)
- Energy badge "baja" shows blue at night — should be muted gray-blue

## Not Yet Built

- Gmail, Slack, Discord integrations
- W6 Deferred Task Escalation (noon nudge — waiting for enough data)
- End-of-day reflection modal
