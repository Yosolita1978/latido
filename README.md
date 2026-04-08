# Latido

**Tu planner diario con inteligencia artificial.**

Latido is an AI-powered daily planner for solopreneurs. It uses three coordinated AI agents to help you capture tasks, plan your day around your real energy and commitments, and learn from your patterns over time.

Built with a Talavera-inspired dark theme. Mobile-first. Spanish-first.

🌐 **Live:** https://milatido.vercel.app

---

## What makes Latido different

Most task apps are glorified to-do lists. Latido has a **closed feedback loop**:

```
Plan → Execute → Reflect → Learn → Plan better tomorrow
```

The system observes how you actually work — which tasks you defer, which time of day you complete deep work, how accurate your time estimates are — and uses those patterns to generate smarter plans.

You're not just scheduling tasks. You're training a planner that knows you.

---

## The three AI agents

| Agent | Triggered by | What it does |
|-------|--------------|--------------|
| **Capture** | You typing a task | Extracts a structured task from natural language ("Recordarme llamar a Mario sobre el contrato a las 3pm"), runs hybrid search to detect duplicates, and suggests existing tasks instead of creating duplicates. |
| **Day Architect** | "Generar plan" button | Reads your tasks, projects, commitments, calendar events, work hours, energy patterns, and historical behavior. Generates a daily plan with time blocks, marks the TOP 3 non-negotiable priorities, and respects your peak energy window. |
| **Accountability** | "Cerrar el día" button | Calculates completion stats, generates a Spanish reflection (warm, direct, concrete), extracts behavioral patterns, stores them with vector embeddings, and suggests TOP 3 priorities for tomorrow based on what was deferred. |

---

## The Enfoque Score

A composite focus metric (0–5) that measures **execution quality**, not just completion.

| Component | Weight | Measures |
|-----------|--------|----------|
| **Alignment** (Puntualidad) | 40% | Did you complete tasks within ±1 hour of when they were planned? |
| **Energy match** (Energía) | 30% | High-energy tasks during peak window, low-energy in the afternoon? |
| **Priority integrity** (Prioridades) | 30% | Did you complete the TOP 3 non-negotiable tasks? |

Updates live as you complete tasks. Tap the ring to see the breakdown by component.

---

## Features

### Capture
- Quick capture sheet with natural-language input
- Project chips, priority (Urgente/Normal/Puede esperar), energy level, time estimate, scheduled time
- Hybrid search (full-text + semantic) to detect duplicate tasks before creating
- AI infers what you didn't specify

### Hoy (Today)
- Energy prompt — log how you feel today (alta/media/baja)
- **Enfoque ring** with contextual labels and tap-to-reveal breakdown
- **TOP 3** non-negotiable tasks marked by the Day Architect
- **Capturadas hoy** — tasks captured today that aren't in the plan yet
- Calendar events from Google Calendar (read-only)
- Time-aware status: "Ahora", "Atrasada", "En 30 min", with auto-scroll to current task and a green glow on the active block
- Tap any task to mark it done, defer to tomorrow, or cancel

### Mañana (Tomorrow)
- All pending tasks (inbox + deferred from previous days)
- Visual indicator for chronically deferred tasks

### Proyectos (Projects)
- Active / Paused / Wishlist organization
- Per-project priority (Alta/Media/Baja) and weekly hours commitment
- **Hours summary card** — visual indicator of how much of your week is committed (e.g., 18/40h) with green/yellow/red status

### Patrones (Patterns)
- AI-extracted behavioral observations
- Confidence dots (1–5)
- Examples: "best day for deep work", "overestimation factor", "chronic deferrals"
- Patterns are persisted with vector embeddings for relevance retrieval during planning

### Reflexión (Reflection modal)
- One-tap end-of-day reflection
- Stats: completed, deferred, completion rate
- AI-generated Spanish reflection
- Suggested TOP 3 priorities for tomorrow based on what was missed
- Patterns automatically extracted and saved

### Settings (Ajustes)
- Timezone (Latin America + US options)
- Work hours
- Planning time (morning/evening)
- Max daily tasks
- Notification channel
- **Google Calendar integration** (OAuth)

---

## Tech stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 16 (App Router, Server Components, React 19) |
| **Styling** | Tailwind CSS v4, custom Talavera design tokens |
| **Auth** | Supabase Auth (magic link via `@supabase/ssr`) |
| **Database** | Supabase Postgres + pgvector (vector embeddings for patterns and tasks) |
| **AI** | OpenAI (GPT-4 for agents, `text-embedding-3-small` for embeddings) |
| **MCP server** | FastMCP (Python), 14 tools, API key middleware |
| **Calendar** | Google Calendar API (`googleapis`, OAuth 2.0) |
| **Email** | Resend (custom SMTP for Supabase Auth) |
| **Hosting** | Vercel (frontend) + Render (MCP server) |

---

## Architecture

```
                      ┌─────────────────────┐
                      │  Frontend (Vercel)  │
                      │  Next.js 16 + React │
                      └──────────┬──────────┘
                                 │
                ┌────────────────┼────────────────┐
                │                │                │
                ▼                ▼                ▼
       ┌──────────────┐  ┌─────────────┐  ┌────────────────┐
       │  Supabase    │  │  OpenAI API │  │  MCP Server    │
       │  - Auth      │  │  - Chat     │  │  (Render)      │
       │  - Postgres  │  │  - Embeds   │  │  - 14 tools    │
       │  - pgvector  │  └─────────────┘  │  - API key auth│
       │  - Realtime  │                   └────────┬───────┘
       └──────────────┘                            │
                ▲                                  │
                └──────────────────────────────────┘
                       (service-role queries)
```

**Data flow:**
- The frontend authenticates users via Supabase Auth
- API routes call MCP tools via `src/lib/mcp-client.ts` (with `MCP_API_KEY` bearer token)
- The MCP server uses the Supabase service role key to query the database
- All `user_id` values are extracted from the authenticated session — never trusted from the client

---

## Security

| Layer | Mechanism |
|-------|-----------|
| **MCP server** | Shared `MCP_API_KEY` middleware. All requests must include `Authorization: Bearer <key>` or get 401. |
| **Auth** | Supabase magic link via `@supabase/ssr`. Sessions persist in HttpOnly cookies. |
| **Server-side user_id** | The `requireUser()` helper extracts user ID from the cookie session. API routes never trust client-provided user IDs. |
| **RLS** | Every table has Row Level Security enabled with `auth.uid() = user_id` policies. |
| **Service role** | Used only for cross-cutting operations (realtime channels, agent writes) and always with explicit user_id filtering. |
| **Google OAuth** | Tokens stored encrypted in `google_oauth_tokens` with RLS. CSRF state validation on callback. |

---

## Project structure

```
latido/
├── frontend/                  Next.js app
│   ├── src/
│   │   ├── app/
│   │   │   ├── (app)/         Authenticated routes
│   │   │   │   ├── hoy/       Today's plan view
│   │   │   │   ├── manana/    Inbox + deferred
│   │   │   │   ├── proyectos/ Projects management
│   │   │   │   ├── reflexion/ Patterns + reflection
│   │   │   │   ├── settings/  User settings + integrations
│   │   │   │   └── layout.tsx Auth wrapper
│   │   │   ├── api/
│   │   │   │   ├── agents/    Capture, plan, accountability
│   │   │   │   ├── google/    OAuth flow + events
│   │   │   │   ├── projects/  CRUD
│   │   │   │   ├── settings/  CRUD
│   │   │   │   ├── stream/    SSE for realtime updates
│   │   │   │   └── ...
│   │   │   ├── auth/callback/ Supabase magic link callback
│   │   │   └── login/         Magic link form
│   │   ├── components/
│   │   │   ├── hoy/           DayView, ReflectionModal
│   │   │   ├── capture/       CaptureSheet
│   │   │   ├── proyectos/     ProjectsList
│   │   │   ├── reflexion/     PatternsView
│   │   │   ├── ui/            ProgressArc, TimeBlock, Badge, Toast, Button
│   │   │   └── AuthProvider.tsx
│   │   ├── lib/
│   │   │   ├── auth.ts          getUser(), requireUser()
│   │   │   ├── supabase.ts      Admin client (service role)
│   │   │   ├── supabase-browser.ts Browser client
│   │   │   ├── mcp-client.ts    HTTP client for MCP tools
│   │   │   ├── google-calendar.ts OAuth + calendar events
│   │   │   ├── openai.ts        Chat + embed helpers
│   │   │   └── enfoque.ts       Enfoque score calculation
│   │   ├── styles/talavera.css  Design tokens
│   │   └── proxy.ts             Auth proxy (Next.js 16)
│   └── package.json
│
├── mcp-server/                Python FastMCP server
│   ├── main.py                14 tools + API key middleware
│   ├── requirements.txt
│   └── seed_with_embeddings.py
│
├── supabase/migrations/       SQL migrations (001 → 006)
│
├── CLAUDE.md                  Internal project guide (for Claude Code)
└── README.md                  This file
```

---

## Local development

### Prerequisites

- Node.js 20+
- Python 3.11+
- A Supabase project
- An OpenAI API key
- (Optional) Google Cloud project for Calendar integration

### Setup

#### 1. Clone and install

```bash
git clone https://github.com/Yosolita1978/latido.git
cd latido

# Frontend
cd frontend
npm install

# MCP server
cd ../mcp-server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

#### 2. Run Supabase migrations

In your Supabase Dashboard → SQL Editor, run each file in `supabase/migrations/` in order (001 → 006).

#### 3. Set up environment variables

**`mcp-server/.env`:**
```env
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
MCP_API_KEY=<generate with: openssl rand -hex 32>
```

**`frontend/.env.local`:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
OPENAI_API_KEY=sk-proj-...
MCP_SERVER_URL=http://localhost:8080
MCP_API_KEY=<same as mcp-server/.env>
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google/callback
```

#### 4. Run both servers

In one terminal:
```bash
cd mcp-server
source .venv/bin/activate
python main.py
```

In another:
```bash
cd frontend
npm run dev
```

Open http://localhost:3000.

---

## Deployment

### MCP server (Render)

1. Create a new **Web Service** from the GitHub repo
2. **Root directory:** `mcp-server`
3. **Build:** `pip install -r requirements.txt`
4. **Start:** `python main.py`
5. Add env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MCP_API_KEY`
6. Render assigns a `PORT` automatically — `main.py` reads it

### Frontend (Vercel)

1. Import the GitHub repo
2. **Root directory:** `frontend`
3. **Framework:** Next.js (auto-detected)
4. Add env vars (all from `frontend/.env.local`, plus `MCP_SERVER_URL` pointing to your Render URL, and `GOOGLE_REDIRECT_URI` pointing to your production URL)
5. Deploy

### Post-deploy checklist

- [ ] Update Supabase **Site URL** and **Redirect URLs** to your Vercel domain
- [ ] Update Google Cloud **Authorized redirect URIs** to your Vercel domain + `/api/google/callback`
- [ ] Enable Google Calendar API in Google Cloud Console
- [ ] Add the `calendar.events.readonly` and `userinfo.email` scopes in OAuth consent screen
- [ ] Configure Resend SMTP in Supabase for production-grade email delivery
- [ ] Customize the magic link email template

---

## Database schema

Key tables:

| Table | Purpose |
|-------|---------|
| `tasks` | Tasks with `title_search` (TSVECTOR) and `embedding` (VECTOR(768)) for hybrid search |
| `daily_plans` | One row per user per day with `time_blocks` (JSONB), `mood`, `reflection`, `completion_rate` |
| `user_patterns` | Behavioral patterns with vector embeddings and confidence scores |
| `projects` | Active/paused/wishlist organization with priority and hours/week |
| `commitments` | Recurring obligations |
| `user_settings` | Timezone, work hours, preferences |
| `google_oauth_tokens` | Encrypted Google Calendar tokens with RLS |

All tables have RLS enabled with `auth.uid() = user_id`.

---

## MCP tools (14)

The MCP server exposes 14 tools used by the frontend agents and n8n workflows:

- `get_unscheduled_tasks` — inbox + deferred
- `get_active_commitments` — recurring obligations + total hours/week
- `get_user_patterns` — behavioral patterns (with optional vector similarity search)
- `get_user_settings` — timezone, work hours, preferences
- `get_projects` — active + blocked projects ordered by priority
- `get_todays_plan` — daily plan with enriched task data
- `write_daily_plan` — upsert plan, mark referenced tasks as scheduled
- `update_task_status` — complete / defer / inbox / scheduled
- `update_user_settings` — partial update of user settings
- `capture_task` — create new task in inbox (with optional `scheduled_at`)
- `search_tasks_hybrid` — full-text (Spanish) + semantic similarity search
- `write_pattern` — upsert behavioral pattern with embedding
- `defer_to_tomorrow` — remove from today's plan, append to tomorrow's
- `get_chronic_deferrals` — tasks deferred 3+ times (used by n8n W6)

---

## Design system

The Talavera Nocturna theme is inspired by candlelit Mexican ceramic workshops — rich dark backgrounds with warm Talavera accent colors.

| Token | Color |
|-------|-------|
| `--azul` | `#3B8FE4` (primary blue) |
| `--rojo` | `#F06060` (red, high energy) |
| `--amarillo` | `#F2C94C` (yellow, medium energy) |
| `--verde` | `#34D399` (green, success) |
| `--terracotta` | `#D4714B` (accent) |
| `--gris` | `#5E6E85` (muted) |
| `--blanco` | `#E4E9F2` (text) |
| `--bg-primary` | `#080D1A` (deep night) |
| `--bg-card` | `#0F1628` (surface) |

Typography: **Playfair Display** (italic, headings) + **Plus Jakarta Sans** (body).

---

## Code principles

- No `any` types in TypeScript — strict mode
- No fallback mechanisms that hide failures — fail loudly, fix the root cause
- Server components by default, client only when interactive
- Mobile-first (320px minimum)
- Spanish-first UI
- All `user_id` extracted from the auth session, never trusted from the client
- RLS on every table

---

## Status

🚀 **Live** — actively used by the creator as a daily driver

Built feature by feature in pair-programming sessions. Every change is intentional, scoped, and validated before merging.

---

## Roadmap

- [ ] n8n CRON workflows (auto-plan in the morning, auto-reflection at night)
- [ ] Push notifications (browser + mobile)
- [ ] Real-time Google Calendar sync via webhooks
- [ ] Gmail integration (capture from starred emails)
- [ ] Telegram bot
- [ ] Multi-language support (English)

---

## License

Personal project. All rights reserved. If you want to use it or learn from the code, reach out.

---

Made with cariño from the Pacífico 🌊
