# n8n Workflows — Implementation Plan

**Status:** W1, W2, W4, W5 all built and active. W6 deferred indefinitely.
**Last updated:** 2026-04-08 (end of session)

---

## Goal

Automate Latido's daily loop with n8n so the user doesn't have to manually trigger plan generation, reflection, or task escalation. All notifications routed through Telegram.

---

## What's already done ✅

| Item | Status |
|------|--------|
| `CRON_API_KEY` env var | ✅ Generated, stored in Vercel |
| `validateCronAuth()` helper (`src/lib/cron-auth.ts`) | ✅ Built |
| `generatePlan(user_id, plan_date)` shared function (`src/lib/agents/plan.ts`) | ✅ Refactored |
| `runAccountability(user_id, plan_date)` shared function (`src/lib/agents/accountability.ts`) | ✅ Refactored |
| `POST /api/cron/plan` endpoint (with skip guards) | ✅ Built |
| `POST /api/cron/reflect` endpoint (with NoPlanError handling) | ✅ Built |
| Workflow 1 in n8n (basic setup, currently 8:30 AM PST for today) | 🟡 Needs to change to 8:00 PM PST for **tomorrow** |
| `GET /api/health` (Next.js) | ✅ Built (Step A) |
| `GET /health` (MCP server) | ✅ Built (Step B) |
| `POST /api/cron/morning-status` (Next.js) | ✅ Built (Step C) |
| `POST /api/cron/chronic-deferrals` (Next.js) + MCP tool `get_chronic_deferrals` | ✅ Built (Step D) |
| Telegram bot (**Latido Bot — new, dedicated**) | ❌ Needs to be created via @BotFather |

---

## What's missing ❌

### Code (new endpoints) — ✅ ALL DONE in 2026-04-08 session

| Endpoint | Purpose | Where | Status |
|----------|---------|-------|--------|
| `GET /api/health` | Check Supabase connection — returns `{ status, supabase, timestamp }` | Next.js | ✅ |
| `GET /health` | Return `{ status, tools_count: 14 }` | MCP server (Python) | ✅ |
| `POST /api/cron/morning-status` | Return today's plan info (TOP 3 titles, task count, current_energy) for morning nudge | Next.js | ✅ |
| `POST /api/cron/chronic-deferrals` | Return tasks with `deferred_count >= 3` for noon escalation | Next.js | ✅ |

### n8n workflows

| # | Name | Cron | Status |
|---|------|------|--------|
| W1 | Evening Plan Generation (Latido - Evening Plan Generation) | `0 0 20 * * 1-5` (8 PM PST, Mon-Fri, tomorrow's date) | ✅ Built + active |
| W2 | Nightly Accountability | `0 30 21 * * 1-5` (9:30 PM PST, Mon-Fri, today's date) | ✅ Built + active |
| W3 | Google Calendar Sync | every 30 min | ⏸ Skipped (events fetched live) |
| W4 | Morning Nudge | `0 30 7 * * 1-5` (7:30 AM PST, Mon-Fri) | ✅ Built + active |
| W5 | Latido Monitor (combined Health + Error handler) | 7:00, 13:00, 19:30 PST + on-error from W1/W2 | ✅ Built + active |
| W6 | Deferred Task Escalation | `0 0 12 * * *` (noon PST) | ⏸ Deferred — wait until there's enough data to test |

**Important n8n cloud notes learned this session:**
- n8n Cloud's Schedule Trigger uses **6-field cron** (`Second Minute Hour Day Month DayOfWeek`), not standard 5-field. Always prefix with `0 ` for the seconds field to be safe.
- n8n Cloud has a **draft/publish model**: changes live in a draft until you click "Publish". Error workflow assignments must be **published** to take effect.
- **Manual test executions may NOT trigger error workflows** — only production (scheduled/triggered) executions do. Verify error workflows by either waiting for a real failure or using mock data on the Error Trigger node directly.
- W5's HTTP nodes use **"Never Error" = ON** so health check failures don't recursively trigger W5's own error path.

### n8n credentials needed

| Credential | Notes |
|------------|-------|
| `Latido Cron Auth` (Header Auth) | ✅ Already exists. Header `Authorization`, value `Bearer <CRON_API_KEY>` |
| Telegram Bot (Bot Token) | **Create a NEW dedicated "Latido Bot" via @BotFather** — do NOT reuse `cristina_edtech_bot` from SonetoBot. Get token from BotFather, chat ID from @userinfobot, paste both into a fresh n8n Telegram credential. |

---

## Implementation phases (do in order)

### Phase 1 — Reconfigure existing workflows (~30 min)

1. **Workflow 1 — Evening Plan**
   - Change cron from `30 8 * * *` → `0 20 * * *` (8 PM)
   - Update Code node to compute **tomorrow's** date in PST:
     ```javascript
     const fmt = new Intl.DateTimeFormat("en-CA", {
       timeZone: "America/Los_Angeles",
       year: "numeric",
       month: "2-digit",
       day: "2-digit",
     });
     const tomorrow = new Date();
     tomorrow.setDate(tomorrow.getDate() + 1);
     const planDate = fmt.format(tomorrow);

     return [{ json: {
       user_id: "070731f7-9641-4d14-a5eb-23980f99ab4d",
       plan_date: planDate,
     }}];
     ```
   - Test manually
   - Activate

2. **Workflow 2 — Nightly Accountability**
   - Create new workflow
   - Cron: `30 21 * * *` (9:30 PM)
   - Code node: today's date in PST
   - HTTP Request: `POST /api/cron/reflect` with `Latido Cron Auth`
   - Test manually
   - Activate

### Phase 2 — Add Telegram outbound (~30 min)

3. **Set up Telegram credential in n8n**
   - In n8n: Credentials → New → Telegram → paste bot token from @BotFather
   - Find your `chat_id` by messaging `@userinfobot` on Telegram

4. **Add Telegram node to W1 (Evening Plan)** after the HTTP Request, success branch
   - Use a Code node to format the message:
     ```javascript
     const data = $input.first().json;

     // If skipped, send a different message
     if (data.skipped) {
       return [{ json: { text: `🫀 Plan saltado para mañana: ${data.reason}` } }];
     }

     // Format the success message
     const text = `🫀 Tu plan para mañana está listo

${data.tasks_scheduled} tareas · ${Math.round(data.total_planned_minutes / 60)}h planificadas

"${data.reasoning}"

→ [Abre Latido](https://latido.day/api/auto-login?token=${process.env.AUTO_LOGIN_TOKEN || ''}&next=/manana)`;

     return [{ json: { text } }];
     ```
   - Telegram node:
     - **Resource:** Message
     - **Operation:** Send Message
     - **Chat ID:** your chat ID
     - **Text:** `{{ $json.text }}`

5. **Add Telegram node to W2 (Reflection)** with similar formatting:
   ```javascript
   const data = $input.first().json;

   if (data.skipped) {
     return [{ json: { text: `🌙 Sin plan para reflexionar hoy.` } }];
   }

   let text = `🫀 Reflexión del día

${data.completion_rate}% completado · ${data.tasks_completed} hechas · ${data.tasks_deferred} diferidas

"${data.reflection}"`;

   if (data.patterns_written > 0) {
     text += `\n\nAprendí ${data.patterns_written} patrón(es) nuevo(s) sobre ti.`;
   }

   if (data.tomorrow_priorities && data.tomorrow_priorities.length > 0) {
     text += `\n\nMañana:\n${data.tomorrow_priorities.map((p, i) => `${i + 1}. ${p}`).join("\n")}`;
   }

   text += `\n\nDescansa bien 🌙\n\n→ [Ver tu día](https://latido.day/api/auto-login?token=${process.env.AUTO_LOGIN_TOKEN || ''}&next=/hoy)`;

   return [{ json: { text } }];
   ```

### Phase 3 — Build new endpoints (~1 hour)

6. **`GET /api/health`** (Next.js)
   - File: `frontend/src/app/api/health/route.ts`
   - Returns `{ status: "ok", supabase: "ok", timestamp }`
   - Tests Supabase connection with a trivial query
   - No auth required (public health check)

7. **`GET /health`** (MCP server, Python)
   - Add a route to `mcp-server/main.py` using Starlette
   - Returns `{ status: "ok", tools_count: 13 }`
   - No API key required (public health check)

8. **`POST /api/cron/morning-status`** (Next.js)
   - Auth: `validateCronAuth`
   - Body: `{ user_id, plan_date }`
   - Returns:
     ```json
     {
       "has_plan": true,
       "task_count": 5,
       "top3": ["Conectar n8n", "Llamar Mario", "Preparar demo"],
       "current_energy": "alta"
     }
     ```
   - Used by W4 Morning Nudge

9. **`POST /api/cron/chronic-deferrals`** (Next.js)
   - Auth: `validateCronAuth`
   - Body: `{ user_id }`
   - Returns deferred tasks with `deferred_count >= 3`, ordered by `deferred_count DESC`, limit 5
   - Used by W6 Deferred Escalation

### Phase 4 — Build new workflows (~45 min)

10. **W5 — Health Monitor** (build first per spec)
    - Trigger: Cron `*/15 * * * *`
    - HTTP Request 1: `GET https://latido-ooag.onrender.com/health` (timeout 10s)
    - HTTP Request 2: `GET https://latido.day/api/health` (timeout 10s)
    - Use n8n static workflow data to track 2-consecutive-failures counter
    - Send Telegram alert only on 2nd failure: "⚠️ Latido infrastructure down: ..."
    - Reset counter on success

11. **W4 — Morning Nudge**
    - Trigger: Cron `30 7 * * *`
    - Code node: today's date
    - HTTP Request: `POST /api/cron/morning-status`
    - IF `has_plan` → Telegram with TOP 3
    - IF NOT `has_plan` → Telegram nudge + (optional) inline button to trigger plan generation

12. **W6 — Deferred Escalation**
    - Trigger: Cron `0 12 * * *`
    - HTTP Request: `POST /api/cron/chronic-deferrals`
    - IF results > 0 → Telegram with the list
    - IF empty → no notification

### Phase 5 — Skipped for now

- **W3 Calendar Sync** — calendar events are already fetched live on every page load and on plan generation. Add this when there are multiple users and we need to detect mid-day calendar conflicts proactively.

---

## Telegram message templates (reference)

### Morning Nudge (W4)
```
Buenos días 🫀

Hoy tienes {n} tareas planificadas.

Tu TOP 3:
1. {title}
2. {title}
3. {title}

Energía ahora: {alta/media/baja}

→ [Abre Latido](https://latido.day/api/auto-login?token=AUTO_LOGIN_TOKEN&next=/hoy)
```

### Evening Plan (W1)
```
🫀 Tu plan para mañana está listo

{n} tareas · {h}h planificadas

"{reasoning}"

→ [Abre Latido](https://latido.day/api/auto-login?token=AUTO_LOGIN_TOKEN&next=/manana)
```

### Nightly Reflection (W2)
```
🫀 Reflexión del día

{completion_rate}% completado · {n} hechas · {n} diferidas

"{reflection}"

Aprendí {n} patrón(es) nuevo(s) sobre ti.

Mañana:
1. {priority}
2. {priority}
3. {priority}

Descansa bien 🌙

→ [Ver tu día](https://latido.day/api/auto-login?token=AUTO_LOGIN_TOKEN&next=/hoy)
```

### Deferred Escalation (W6)
```
🔴 Tareas que siguen esperando:

- {title} — diferida {n} veces
- {title} — diferida {n} veces

¿Las haces hoy, las delegas, o las eliminas?
```

### Health Alert (W5)
```
⚠️ El servidor MCP de Latido no responde.
Último error: {error}.
Revisa Render.
```

---

## Environment variables in n8n

When configuring workflows, these are the values to use:

| Variable | Value |
|----------|-------|
| `LATIDO_URL` | `https://latido.day` |
| `LATIDO_USER_ID` | `070731f7-9641-4d14-a5eb-23980f99ab4d` |
| `MCP_SERVER_URL` | `https://latido-ooag.onrender.com` |
| `CRON_API_KEY` | (in your local `.env.local` and Vercel env vars) |
| `TELEGRAM_BOT_TOKEN` | from @BotFather |
| `TELEGRAM_CHAT_ID` | from @userinfobot |
| `AUTO_LOGIN_TOKEN` | Secret token for Telegram auto-login links (also set in Vercel env vars) |

You can store these as n8n environment variables (Settings → Variables) so workflows reference them by name instead of hardcoding.

---

## Notes & decisions

- **Why 8 PM for plan, not 8 AM:** User's `planning_time` is "evening". Planning the night before reduces morning friction and lets the AI consider any last-minute calendar additions.
- **Why 9:30 PM for reflection, not 9 PM:** Workflow 1 runs at 8 PM and needs to finish first. Reflection should run after the user's last possible task completions.
- **Why 2 failures before alerting (W5):** Render free tier cold-starts can take 30+ seconds. A single timeout doesn't mean the server is down — it means it was sleeping. Two consecutive failures 15 minutes apart means something is actually broken. (User has paid tier so cold starts shouldn't apply, but the principle holds.)
- **Why noon for deferred escalation (W6):** Earlier feels naggy. Later feels like it's too late to act.
- **Calendar sync skipped:** Events are fetched live on `/hoy` and inside `generatePlan()`. Stale data only happens between plan generations. Revisit when there are real users.

---

## Next session — pick up here

All active scope is done. W1, W2, W4, W5 are built, tested, and running on schedule. The daily Latido loop is fully automated.

**Only W6 (Deferred Escalation) remains**, and it's on hold by user decision until there's enough chronically-deferred-task data to make the noon nudge meaningful (`get_chronic_deferrals` MCP tool returns tasks with `deferred_count >= 3`, and the user is just starting to accumulate that history).

**When you're ready for W6:**
- Trigger: Schedule, `0 0 12 * * *` (noon PST, 6-field cron)
- HTTP Request: `POST /api/cron/chronic-deferrals` with `Latido Cron Auth`, body `{user_id}` only (no plan_date)
- Branch on `tasks.length > 0`:
  - If empty → return [] / no message (don't spam when there's nothing to escalate)
  - If non-empty → Format Telegram listing each task with its deferred_count
- Send via `Latido Bot`
- Assign `Latido Monitor` as error workflow
- Same patterns as W1/W2/W4

The handoff to Claude next time:
> "Build W6 — Deferred Escalation per `docs/n8n-workflows-plan.md`. All other workflows are already live."
