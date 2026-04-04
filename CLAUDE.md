# LATIDO — Project Guide

AI-powered daily planner for solopreneurs. Three AI agents (Capture, Day Architect, Accountability) coordinate through a FastMCP server connected to Supabase with pgvector. Talavera-inspired dark theme, mobile-first, Spanish-first UI.

**Core differentiator:** closed feedback loop. Plan → execute → compare → extract patterns → improve next plan. The Accountability Agent writes behavioral observations to `user_patterns` with vector embeddings; the Day Architect reads them before generating each plan.

## Tech Stack

- **Frontend:** Next.js 16 (App Router, Server Components by default), TypeScript strict, Tailwind CSS v4, React 19
- **Database:** Supabase (PostgreSQL + pgvector + RLS on every table)
- **Auth:** Supabase Auth (magic link, email-based) — not yet implemented
- **AI:** OpenAI (GPT for agents, text-embedding for embeddings)
- **MCP Server:** FastMCP (Python) with 12 tools, runs on port 8080
- **Hosting:** Vercel (frontend) + Railway (MCP server) — not yet deployed

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
  src/components/   React components by feature
  src/lib/          Shared utilities (mcp-client, supabase, openai, enfoque)
  src/styles/       Talavera design tokens
mcp-server/         Python FastMCP server (main.py, 12 tools)
supabase/           Database migrations (001-004)
```

## Data Flow

```
Frontend (Next.js) → HTTP → Python MCP Server (FastMCP :8080) → Supabase PostgreSQL
                                                                → OpenAI API (embeddings, LLM)
```

All frontend API routes call MCP tools via `src/lib/mcp-client.ts`. No direct Supabase queries from the frontend except for auth and realtime subscriptions.

## Three AI Agents

1. **Capture** (`/api/agents/capture`) — extracts structured tasks from natural language, hybrid search for deduplication
2. **Day Architect** (`/api/agents/plan`) — generates daily plan with TOP 3 priorities, energy-aware scheduling, reads user patterns
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

## MCP Tools (12)

`get_unscheduled_tasks`, `get_active_commitments`, `get_user_patterns`, `get_user_settings`, `write_daily_plan`, `update_task_status`, `capture_task`, `search_tasks_hybrid`, `write_pattern`, `get_todays_plan`, `get_projects`, `defer_to_tomorrow`

## Design System (Talavera)

Dark theme with Mexican ceramic tile aesthetic. Color tokens defined in `frontend/src/styles/talavera.css`:
- `--azul` (primary blue), `--rojo` (red/high energy), `--amarillo` (yellow/medium energy)
- `--terracotta` (accent), `--crema` (light text), `--gris` (muted)
- `--fondo` (dark background), `--superficie` (card surface)

## Environment Variables

Frontend needs: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `MCP_SERVER_URL`

MCP server needs: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

## Known Issues

- SSE reconnection doesn't handle MCP server restarts (needs exponential backoff)
- Energy badge "baja" shows blue at night — should be muted gray-blue
- `TEMP_USER_ID` hardcoded in `frontend/src/lib/constants.ts` — replace with real auth
- No Supabase Auth yet (magic link planned)

## Not Yet Built

- User settings screen (`/settings`)
- Calendar integration (Google Calendar, Gmail, Slack, Discord)
- n8n CRON workflows (blocked until deploy)
- End-of-day reflection modal
- Supabase Auth (magic link)
