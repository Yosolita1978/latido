import json
import os
from datetime import date, datetime

from dotenv import load_dotenv
from fastmcp import FastMCP
from supabase import Client, create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

db: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
mcp = FastMCP("latido-tools")


# ---------------------------------------------------------------------------
# Tool 1: get_unscheduled_tasks
# ---------------------------------------------------------------------------
@mcp.tool()
def get_unscheduled_tasks(user_id: str) -> list[dict]:
    """Get all tasks with status 'inbox' or 'deferred', ordered by due date and deferred count."""
    result = (
        db.table("tasks")
        .select("id, title, category, energy_level, estimated_minutes, project_id, due_date, deferred_count")
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
    # Upsert the plan
    result = (
        db.table("daily_plans")
        .upsert(
            {
                "user_id": user_id,
                "plan_date": plan_date,
                "time_blocks": time_blocks,
                "total_planned_minutes": total_planned_minutes,
            },
            on_conflict="user_id,plan_date",
        )
        .execute()
    )
    plan_id = result.data[0]["id"]

    # Update each referenced task to 'scheduled'
    task_ids = [b["task_id"] for b in time_blocks if b.get("task_id")]
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
) -> dict:
    """Update a task's status. If completed, sets completed_at. If deferred, increments deferred_count."""
    update_data: dict = {"status": status}

    if actual_minutes is not None:
        update_data["actual_minutes"] = actual_minutes

    if status == "completed":
        update_data["completed_at"] = datetime.now().isoformat()

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
) -> dict:
    """Create a new task in the inbox."""
    task_data: dict = {
        "user_id": user_id,
        "title": title,
        "category": category,
        "energy_level": energy_level,
        "estimated_minutes": estimated_minutes,
        "status": "inbox",
    }
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
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    mcp.run(transport="streamable-http", host="0.0.0.0", port=8080)
