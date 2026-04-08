import json
import os
import re
from datetime import date, datetime

import uvicorn
from dotenv import load_dotenv
from fastmcp import FastMCP
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route
from supabase import Client, create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
MCP_API_KEY = os.environ["MCP_API_KEY"]

db: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
mcp = FastMCP("latido-tools")


# ---------------------------------------------------------------------------
# HTTP-level API key middleware
# ---------------------------------------------------------------------------
class ApiKeyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Public endpoints — no auth required
        if request.url.path == "/health":
            return await call_next(request)

        auth_header = request.headers.get("authorization", "")
        if auth_header != f"Bearer {MCP_API_KEY}":
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        return await call_next(request)


# ---------------------------------------------------------------------------
# Public health endpoint (no auth)
# ---------------------------------------------------------------------------
async def health_endpoint(request: Request) -> JSONResponse:
    """Public liveness check for n8n Workflow 5. No API key required."""
    return JSONResponse({"status": "ok", "tools_count": 14})


# ---------------------------------------------------------------------------
# Tool 1: get_unscheduled_tasks
# ---------------------------------------------------------------------------
@mcp.tool()
def get_unscheduled_tasks(user_id: str) -> list[dict]:
    """Get all tasks with status 'inbox' or 'deferred', ordered by due date and deferred count."""
    result = (
        db.table("tasks")
        .select("id, title, category, energy_level, estimated_minutes, project_id, due_date, deferred_count, scheduled_at, created_at")
        .eq("user_id", user_id)
        .in_("status", ["inbox", "deferred"])
        .order("due_date", nullsfirst=False)
        .order("deferred_count", desc=True)
        .execute()
    )
    return result.data


# ---------------------------------------------------------------------------
# Tool 2: get_active_commitments
# ---------------------------------------------------------------------------
@mcp.tool()
def get_active_commitments(user_id: str) -> dict:
    """Get active commitments and total committed hours per week."""
    result = (
        db.table("commitments")
        .select("id, name, hours_per_week, category, project_id, ends_at")
        .eq("user_id", user_id)
        .eq("active", True)
        .execute()
    )
    commitments = result.data
    # Filter out expired commitments
    today = date.today().isoformat()
    active = [c for c in commitments if c["ends_at"] is None or c["ends_at"] > today]
    total = sum(float(c["hours_per_week"]) for c in active)
    return {"commitments": active, "total_committed_hours_per_week": total}


# ---------------------------------------------------------------------------
# Tool 3: get_user_patterns
# ---------------------------------------------------------------------------
@mcp.tool()
def get_user_patterns(user_id: str, context_embedding: list[float] | None = None) -> list[dict]:
    """Get user patterns. If context_embedding is provided, returns the 5 most relevant by cosine similarity. Otherwise returns top 10 by confidence."""
    if context_embedding:
        # Use RPC for vector similarity search
        result = db.rpc(
            "match_user_patterns",
            {
                "p_user_id": user_id,
                "p_embedding": context_embedding,
                "p_limit": 5,
            },
        ).execute()
        return result.data
    else:
        result = (
            db.table("user_patterns")
            .select("pattern_key, pattern_value, confidence")
            .eq("user_id", user_id)
            .order("confidence", desc=True)
            .limit(10)
            .execute()
        )
        return result.data


# ---------------------------------------------------------------------------
# Tool 4: get_user_settings
# ---------------------------------------------------------------------------
@mcp.tool()
def get_user_settings(user_id: str) -> dict:
    """Get user settings (timezone, work hours, preferences)."""
    result = (
        db.table("user_settings")
        .select("*")
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    return result.data


# ---------------------------------------------------------------------------
# Tool 5: write_daily_plan
# ---------------------------------------------------------------------------
@mcp.tool()
def write_daily_plan(
    user_id: str,
    plan_date: str,
    time_blocks: list[dict],
    total_planned_minutes: int,
) -> dict:
    """Upsert a daily plan and mark referenced tasks as 'scheduled'."""
    UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE)

    # Filter out blocks with invalid task_ids (LLM sometimes uses names instead of UUIDs)
    valid_blocks = []
    for block in time_blocks:
        tid = block.get("task_id")
        if tid is None or UUID_RE.match(str(tid)):
            valid_blocks.append(block)
        # else: silently drop blocks with non-UUID task_ids

    # Upsert the plan
    result = (
        db.table("daily_plans")
        .upsert(
            {
                "user_id": user_id,
                "plan_date": plan_date,
                "time_blocks": valid_blocks,
                "total_planned_minutes": total_planned_minutes,
            },
            on_conflict="user_id,plan_date",
        )
        .execute()
    )
    plan_id = result.data[0]["id"]

    # Update each referenced task to 'scheduled'
    task_ids = [b["task_id"] for b in valid_blocks if b.get("task_id")]
    for task_id in task_ids:
        db.table("tasks").update({"status": "scheduled"}).eq("id", task_id).execute()

    return {"success": True, "plan_id": plan_id}


# ---------------------------------------------------------------------------
# Tool 6: update_task_status
# ---------------------------------------------------------------------------
@mcp.tool()
def update_task_status(
    task_id: str,
    status: str,
    actual_minutes: int | None = None,
    completed_at: str | None = None,
) -> dict:
    """Update a task's status. If completed, sets completed_at (accepts ISO 8601 with timezone from frontend, falls back to UTC). If deferred, increments deferred_count."""
    update_data: dict = {"status": status}

    if actual_minutes is not None:
        update_data["actual_minutes"] = actual_minutes

    if status == "completed":
        update_data["completed_at"] = completed_at or datetime.now().isoformat()

    result = db.table("tasks").update(update_data).eq("id", task_id).execute()

    # If deferred, increment deferred_count separately
    if status == "deferred":
        task = db.table("tasks").select("deferred_count").eq("id", task_id).single().execute()
        new_count = (task.data["deferred_count"] or 0) + 1
        db.table("tasks").update({"deferred_count": new_count}).eq("id", task_id).execute()

    return {"success": True, "task_id": task_id, "new_status": status}


# ---------------------------------------------------------------------------
# Tool 7: capture_task
# ---------------------------------------------------------------------------
@mcp.tool()
def capture_task(
    user_id: str,
    title: str,
    category: str,
    energy_level: str,
    estimated_minutes: int,
    project_id: str | None = None,
    embedding: list[float] | None = None,
    scheduled_at: str | None = None,
) -> dict:
    """Create a new task in the inbox. scheduled_at is an optional ISO 8601 timestamp."""
    task_data: dict = {
        "user_id": user_id,
        "title": title,
        "category": category,
        "energy_level": energy_level,
        "estimated_minutes": estimated_minutes,
        "status": "inbox",
    }
    if scheduled_at:
        task_data["scheduled_at"] = scheduled_at
    if project_id:
        task_data["project_id"] = project_id
    if embedding:
        task_data["embedding"] = embedding

    result = db.table("tasks").insert(task_data).execute()
    return {"success": True, "task_id": result.data[0]["id"]}


# ---------------------------------------------------------------------------
# Tool 8: search_tasks_hybrid
# ---------------------------------------------------------------------------
@mcp.tool()
def search_tasks_hybrid(
    user_id: str,
    query_text: str,
    query_embedding: list[float],
) -> list[dict]:
    """Hybrid search combining full-text (Spanish) and semantic similarity (0.4/0.6 weighting)."""
    result = db.rpc(
        "search_tasks_hybrid",
        {
            "p_user_id": user_id,
            "p_query_text": query_text,
            "p_query_embedding": query_embedding,
            "p_limit": 3,
        },
    ).execute()
    return result.data


# ---------------------------------------------------------------------------
# Tool 9: write_pattern
# ---------------------------------------------------------------------------
@mcp.tool()
def write_pattern(
    user_id: str,
    pattern_key: str,
    pattern_value: dict,
    embedding: list[float],
    confidence: int,
) -> dict:
    """Create or update a user pattern."""
    existing = (
        db.table("user_patterns")
        .select("id")
        .eq("user_id", user_id)
        .eq("pattern_key", pattern_key)
        .execute()
    )

    if existing.data:
        db.table("user_patterns").update(
            {
                "pattern_value": pattern_value,
                "embedding": embedding,
                "confidence": confidence,
                "last_updated": datetime.now().isoformat(),
            }
        ).eq("id", existing.data[0]["id"]).execute()
        return {"success": True, "action": "updated"}
    else:
        db.table("user_patterns").insert(
            {
                "user_id": user_id,
                "pattern_key": pattern_key,
                "pattern_value": pattern_value,
                "embedding": embedding,
                "confidence": confidence,
            }
        ).execute()
        return {"success": True, "action": "created"}


# ---------------------------------------------------------------------------
# Tool 10: get_todays_plan
# ---------------------------------------------------------------------------
@mcp.tool()
def get_todays_plan(user_id: str, plan_date: str) -> dict | None:
    """Get a daily plan with enriched time blocks (includes current task status)."""
    plan_result = (
        db.table("daily_plans")
        .select("*")
        .eq("user_id", user_id)
        .eq("plan_date", plan_date)
        .execute()
    )

    if not plan_result.data:
        return None

    plan = plan_result.data[0]
    time_blocks = plan["time_blocks"]

    # Enrich each block with current task data
    task_ids = [b["task_id"] for b in time_blocks if b.get("task_id")]
    if task_ids:
        tasks_result = (
            db.table("tasks")
            .select("id, title, status, actual_minutes, category, energy_level, project_id")
            .in_("id", task_ids)
            .execute()
        )
        tasks_by_id = {t["id"]: t for t in tasks_result.data}

        for block in time_blocks:
            task_id = block.get("task_id")
            if task_id and task_id in tasks_by_id:
                block["task"] = tasks_by_id[task_id]

    plan["time_blocks"] = time_blocks
    return plan


# ---------------------------------------------------------------------------
# Tool 11: get_projects
# ---------------------------------------------------------------------------
@mcp.tool()
def get_projects(user_id: str) -> list[dict]:
    """Get active and blocked projects ordered by priority."""
    result = (
        db.table("projects")
        .select("id, name, status, priority, hours_per_week_needed, blocked_by")
        .eq("user_id", user_id)
        .in_("status", ["active", "blocked"])
        .order("priority")
        .execute()
    )
    return result.data


# ---------------------------------------------------------------------------
# Tool 12: defer_to_tomorrow
# ---------------------------------------------------------------------------
@mcp.tool()
def defer_to_tomorrow(user_id: str, task_id: str, plan_date: str) -> dict:
    """Defer a task: remove from today's plan and optionally append to tomorrow's plan as unslotted."""
    # 1. Remove task from today's plan
    today = date.today().isoformat()
    today_plan = (
        db.table("daily_plans")
        .select("id, time_blocks, total_planned_minutes")
        .eq("user_id", user_id)
        .eq("plan_date", today)
        .execute()
    )

    if today_plan.data:
        plan = today_plan.data[0]
        old_blocks = plan["time_blocks"] or []
        # Find the deferred block to subtract its minutes
        deferred_block = next((b for b in old_blocks if b.get("task_id") == task_id), None)
        deferred_minutes = 0
        if deferred_block:
            start = deferred_block.get("start_time", "00:00")
            end = deferred_block.get("end_time", "00:00")
            sh, sm = map(int, start.split(":"))
            eh, em = map(int, end.split(":"))
            deferred_minutes = (eh * 60 + em) - (sh * 60 + sm)

        new_blocks = [b for b in old_blocks if b.get("task_id") != task_id]
        new_total = max(0, (plan["total_planned_minutes"] or 0) - deferred_minutes)
        db.table("daily_plans").update(
            {"time_blocks": new_blocks, "total_planned_minutes": new_total}
        ).eq("id", plan["id"]).execute()

    # 2. Check if tomorrow's plan exists
    tomorrow_plan = (
        db.table("daily_plans")
        .select("id, time_blocks")
        .eq("user_id", user_id)
        .eq("plan_date", plan_date)
        .execute()
    )

    appended = False
    if tomorrow_plan.data:
        # Append as unslotted block
        plan = tomorrow_plan.data[0]
        blocks = plan["time_blocks"] or []
        blocks.append({
            "task_id": task_id,
            "start_time": "00:00",
            "end_time": "00:00",
            "slot_type": "unslotted",
            "plan_rank": 0,
        })
        db.table("daily_plans").update({"time_blocks": blocks}).eq("id", plan["id"]).execute()
        appended = True

    return {"success": True, "task_id": task_id, "appended_to_tomorrow": appended}


# ---------------------------------------------------------------------------
# Tool 13: update_user_settings
# ---------------------------------------------------------------------------
@mcp.tool()
def update_user_settings(user_id: str, settings: dict) -> dict:
    """Update user settings. Only provided fields are updated."""
    ALLOWED_FIELDS = {
        "timezone",
        "locale",
        "planning_time",
        "work_hours_start",
        "work_hours_end",
        "max_daily_tasks",
        "notification_channel",
    }

    update_data = {k: v for k, v in settings.items() if k in ALLOWED_FIELDS}
    if not update_data:
        return {"success": False, "error": "No valid fields to update"}

    update_data["updated_at"] = datetime.now().isoformat()

    db.table("user_settings").update(update_data).eq("user_id", user_id).execute()
    return {"success": True, "updated_fields": list(update_data.keys())}


# ---------------------------------------------------------------------------
# Tool 14: get_chronic_deferrals
# ---------------------------------------------------------------------------
@mcp.tool()
def get_chronic_deferrals(user_id: str) -> list[dict]:
    """Get tasks the user has deferred 3 or more times, ordered by
    deferred_count DESC, limit 5. Used by n8n Workflow 6 (noon escalation)."""
    result = (
        db.table("tasks")
        .select("id, title, deferred_count, category, energy_level")
        .eq("user_id", user_id)
        .in_("status", ["inbox", "deferred"])
        .gte("deferred_count", 3)
        .order("deferred_count", desc=True)
        .limit(5)
        .execute()
    )
    return result.data


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    app = mcp.http_app()
    app.router.routes.append(Route("/health", health_endpoint, methods=["GET"]))
    app.add_middleware(ApiKeyMiddleware)
    port = int(os.environ.get("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)
