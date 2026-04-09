# Latido — Development Architecture

**Last updated:** 2026-04-09

## System Overview

Latido is an AI-powered daily planner for solopreneurs. It runs a closed feedback loop: Plan → Execute → Reflect → Learn → Improve next plan.

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER (Mobile)                            │
│                   milatido.vercel.app                            │
└──────────┬──────────────────────────────────────┬───────────────┘
           │                                      │
           ▼                                      ▼
┌─────────────────────┐              ┌─────────────────────────┐
│   Next.js Frontend  │              │    Telegram Bot          │
│   (Vercel)          │              │    (via n8n Cloud)       │
│                     │              │                          │
│  /hoy   /manana     │              │  Morning nudge (7:30AM)  │
│  /patrones          │              │  Evening plan  (8:00PM)  │
│  /settings          │              │  Reflection   (9:30PM)   │
│                     │              │  Health alerts            │
│  API Routes:        │              └──────────┬──────────────┘
│  /api/agents/*      │                         │
│  /api/cron/*        │◄────────────────────────┘
│  /api/tasks/*       │        (HTTP POST with CRON_API_KEY)
│  /api/stream/*      │
└──────────┬──────────┘
           │ HTTP (MCP_API_KEY)
           ▼
┌─────────────────────┐       ┌──────────────────────┐
│  Python MCP Server  │──────▶│   Supabase           │
│  (Render)           │       │   PostgreSQL          │
│                     │       │   + pgvector          │
│  FastMCP :8080      │       │   + RLS               │
│  14 tools           │       └──────────────────────┘
│                     │
│                     │──────▶ OpenAI API
│                     │        (GPT-4o, text-embedding)
└─────────────────────┘

┌─────────────────────┐
│  Google Calendar    │◄────── OAuth2 (frontend server-side)
│  API                │        Tokens in google_oauth_tokens table
└─────────────────────┘
```

## Frontend Architecture (Next.js 16)

### Pages (App Router)

| Route | Type | Purpose |
|-------|------|---------|
| `/hoy` | Server + Client | Today's plan with DayView (interactive) |
| `/manana` | Server | Tomorrow's preview: calendar events + unscheduled tasks |
| `/reflexion/patrones` | Server | Reflection + learned behavioral patterns |
| `/settings` | Server + Client | User settings, onboarding, Google Calendar connection |
| `/login` | Server | Magic link auth |

### API Routes

| Route | Auth | Purpose |
|-------|------|---------|
| `POST /api/agents/capture` | Supabase session | Capture task from natural language, auto-regenerate plan |
| `POST /api/agents/plan` | Supabase session | Generate/regenerate today's plan (user-initiated) |
| `POST /api/agents/accountability` | Supabase session | Run end-of-day reflection |
| `POST /api/tasks/status` | Supabase session | Complete/defer/cancel a task |
| `GET /api/stream/day` | Supabase session | SSE stream for real-time task updates |
| `POST /api/cron/plan` | CRON_API_KEY | n8n: generate tomorrow's plan (evening) |
| `POST /api/cron/morning-status` | CRON_API_KEY | n8n: today's plan summary for morning nudge |
| `POST /api/cron/reflect` | CRON_API_KEY | n8n: run accountability agent |
| `POST /api/cron/chronic-deferrals` | CRON_API_KEY | n8n: tasks deferred 3+ times |
| `GET /api/health` | Public | Health check (Supabase connection) |

### Key Libraries

| File | Purpose |
|------|---------|
| `src/lib/dates.ts` | Timezone-aware `getTodayDate(tz)` and `getTomorrowDate(tz)` |
| `src/lib/mcp-client.ts` | HTTP client for MCP server tools |
| `src/lib/google-calendar.ts` | Google Calendar OAuth2 + event fetching for any date |
| `src/lib/enfoque.ts` | Enfoque score calculation (alignment, energy, priority) |
| `src/lib/agents/plan.ts` | `generatePlan()` + `regeneratePlan()` |
| `src/lib/auth.ts` | `requireUser()` — extracts user from Supabase session |
| `src/lib/cron-auth.ts` | `validateCronAuth()` — validates CRON_API_KEY header |

## MCP Server (Python FastMCP)

14 tools exposed via HTTP on port 8080. All requests require `Authorization: Bearer <MCP_API_KEY>`.

| Tool | Purpose |
|------|---------|
| `get_unscheduled_tasks` | Tasks with status inbox/deferred/scheduled (not completed) |
| `get_active_commitments` | Recurring obligations with hours/week |
| `get_user_patterns` | Behavioral patterns via vector similarity search |
| `get_user_settings` | Timezone, work hours, preferences |
| `write_daily_plan` | Upsert plan + mark tasks as "scheduled" |
| `update_task_status` | Change status, set completed_at, increment deferred_count |
| `capture_task` | Create task with embedding |
| `search_tasks_hybrid` | Full-text + vector search for deduplication |
| `write_pattern` | Store behavioral pattern with embedding |
| `get_todays_plan` | Fetch plan with enriched task data (live status) |
| `get_projects` | Active/blocked projects by priority |
| `defer_to_tomorrow` | Remove from today's plan, optionally append to tomorrow's |
| `update_user_settings` | Update timezone, work hours, etc. |
| `get_chronic_deferrals` | Tasks with deferred_count >= 3 |

## Database Schema (Supabase)

### Core Tables

| Table | Key Columns | RLS |
|-------|------------|-----|
| `tasks` | id, user_id, title, status, category, energy_level, estimated_minutes, project_id, deferred_count, completed_at, title_search (TSVECTOR), embedding (VECTOR 768), scheduled_at | Yes |
| `daily_plans` | id, user_id, plan_date, time_blocks (JSONB), total_planned_minutes, completion_rate, reflection, mood | Yes |
| `user_patterns` | id, user_id, pattern_key, pattern_value (JSONB), confidence, embedding (VECTOR 768) | Yes |
| `projects` | id, user_id, name, status, priority, hours_per_week_needed | Yes |
| `user_settings` | user_id, timezone, work_hours_start, work_hours_end, max_daily_tasks, planning_time | Yes |
| `commitments` | id, user_id, name, hours_per_week, category, project_id | Yes |
| `google_oauth_tokens` | user_id, access_token, refresh_token, expiry_date, email | Yes |

### Task Status Lifecycle

```
    ┌──────┐
    │ inbox │◄─────────────────────────┐
    └──┬───┘                           │
       │ generatePlan()                │ cancel (user)
       ▼                               │
  ┌──────────┐                    ┌────┴────┐
  │ scheduled │───────────────────▶│  inbox  │
  └──┬────┬──┘                    └─────────┘
     │    │
     │    │ defer (user)
     │    ▼
     │  ┌──────────┐
     │  │ deferred  │ (deferred_count++)
     │  └──────────┘ (removed from today's plan)
     │
     │ complete (user)
     ▼
  ┌───────────┐
  │ completed  │ (completed_at set)
  └───────────┘
```

`get_unscheduled_tasks` returns: `inbox` + `deferred` + `scheduled` (where `completed_at IS NULL`). This prevents tasks from getting stuck as "scheduled" from old plans.

## n8n Automation Layer

### Daily Loop

```
7:30 AM ──▶ W4 Morning Nudge
            │ POST /api/cron/morning-status
            │ Auto-generates plan if none exists
            │ Sends: tasks + TOP 3 + calendar events
            ▼
  [User works through the day, captures tasks]
            │
            │ Each capture → auto-regenerates plan (background)
            ▼
8:00 PM ──▶ W1 Evening Plan
            │ POST /api/cron/plan (tomorrow's date)
            │ Generates new plan or regenerates if new tasks exist
            │ Sends: plan summary + calendar events
            ▼
9:30 PM ──▶ W2 Nightly Reflection
            │ POST /api/cron/reflect
            │ Runs accountability agent
            │ Sends: completion %, reflection, patterns learned
            ▼
  [Patterns stored → Day Architect reads them tomorrow]
```

### Health Monitoring

W5 runs at 7:00, 13:00, 19:30 PST. Checks both Vercel (`/api/health`) and Render (`/health`). Alerts on 2 consecutive failures to avoid false alarms from cold starts.

### Workflow Details

See `docs/n8n-workflows-plan.md` for CRON expressions, code snippets, and credential setup.

## Auto-Regeneration Flow

When a task is captured, the plan auto-updates:

```
User captures task
  → POST /api/agents/capture
    → AI extracts structured task
    → capture_task (MCP) saves to DB
    → after() callback (non-blocking):
        → regeneratePlan(user_id, today)
          → get_todays_plan (check if plan exists)
          → reset "scheduled" tasks → "inbox"
          → generatePlan() (includes new task)
          → write_daily_plan (new plan saved)
  ← Response returned immediately (capture is fast)
```

## Timezone Strategy

All servers run in UTC. The user's timezone comes from `user_settings.timezone` (e.g., `America/Los_Angeles`).

- **Frontend:** `src/lib/dates.ts` uses `toLocaleDateString("en-CA", { timeZone })` for correct local dates
- **MCP Server:** Dates are always passed from the frontend; never computed server-side with `date.today()`
- **n8n:** Code nodes compute dates using `Intl.DateTimeFormat` with `America/Los_Angeles`

## Environment Variables

| Where | Variable | Purpose |
|-------|----------|---------|
| Vercel | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| Vercel | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (client-side) |
| Vercel | `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin access (server-side) |
| Vercel | `OPENAI_API_KEY` | GPT + embeddings |
| Vercel | `MCP_SERVER_URL` | Render MCP server URL |
| Vercel | `MCP_API_KEY` | Shared key for MCP auth |
| Vercel | `CRON_API_KEY` | n8n CRON authentication |
| Vercel | `GOOGLE_CLIENT_ID` | Google OAuth2 |
| Vercel | `GOOGLE_CLIENT_SECRET` | Google OAuth2 |
| Vercel | `GOOGLE_REDIRECT_URI` | Google OAuth2 callback |
| Render | `SUPABASE_URL` | Supabase project URL |
| Render | `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin access |
| Render | `MCP_API_KEY` | Shared key for MCP auth |
| n8n | `Latido Cron Auth` | Header Auth credential (CRON_API_KEY) |
| n8n | Telegram Bot Token | From @BotFather (Latido Bot) |
| n8n | Telegram Chat ID | From @userinfobot |

## Design System

Talavera-inspired dark theme. Color tokens in `frontend/src/styles/talavera.css`:

| Token | Color | Usage |
|-------|-------|-------|
| `--azul` | Blue | Primary actions, links |
| `--rojo` | Red | High energy tasks |
| `--amarillo` | Yellow | Medium energy tasks |
| `--terracotta` | Terracotta | Accent, reflection |
| `--crema` | Cream | Light text |
| `--gris` | Gray | Muted text, secondary |
| `--fondo` | Dark | Background |
| `--superficie` | Slightly lighter | Card surfaces |

Mobile-first (320px minimum). Spanish-first UI.
