"""
Seed script that clears all data and re-inserts with embeddings.
Run from mcp-server/: source .venv/bin/activate && python seed_with_embeddings.py
"""

import os
from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client

load_dotenv()

db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
openai = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

USER_ID = "73305d0c-6897-44b8-9026-08d308deee62"


def embed(text: str) -> list[float]:
    response = openai.embeddings.create(
        model="text-embedding-3-small",
        input=text,
        dimensions=768,
    )
    return response.data[0].embedding


def main():
    print("🗑  Clearing all data...")
    db.table("capture_inbox").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    db.table("user_patterns").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    db.table("daily_plans").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    db.table("tasks").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    db.table("commitments").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    db.table("projects").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    db.table("user_settings").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    print("✓ All data cleared")

    # --- User Settings ---
    print("📝 Inserting user settings...")
    db.table("user_settings").insert({
        "user_id": USER_ID,
        "timezone": "America/Los_Angeles",
        "locale": "es-MX",
        "planning_time": "evening",
        "work_hours_start": "08:00",
        "work_hours_end": "18:00",
        "notification_channel": "telegram",
    }).execute()
    print("✓ User settings")

    # --- Projects ---
    print("📁 Inserting projects...")
    projects_data = [
        {"name": "Latido", "status": "active", "hours_per_week_needed": 8, "priority": 1},
        {"name": "Nouvie", "status": "active", "hours_per_week_needed": 5, "priority": 2},
        {"name": "MujerTech Module 2", "status": "active", "hours_per_week_needed": 4, "priority": 2},
        {"name": "ComadreLab Clients", "status": "active", "hours_per_week_needed": 6, "priority": 3},
        {"name": "Cascadia AI Collective", "status": "active", "hours_per_week_needed": 2, "priority": 4},
        {"name": "CascadiaJS 2026 Scholarships", "status": "active", "hours_per_week_needed": 10, "priority": 5},
        {"name": "Anzuelo", "status": "paused", "hours_per_week_needed": None, "priority": 5},
        {"name": "SonetoBot", "status": "active", "hours_per_week_needed": 1, "priority": 4},
        {"name": "AI Agents Course", "status": "wishlist", "hours_per_week_needed": None, "priority": 3},
    ]
    for p in projects_data:
        db.table("projects").insert({"user_id": USER_ID, **p}).execute()
    print(f"✓ {len(projects_data)} projects")

    # Get project IDs for task references
    projects = db.table("projects").select("id, name").eq("user_id", USER_ID).execute().data
    proj_by_name = {p["name"]: p["id"] for p in projects}

    # --- Commitments ---
    print("🤝 Inserting commitments...")
    commitments_data = [
        {"name": "InterRAI/Orkidea weekly calls", "hours_per_week": 3, "category": "client", "starts_at": "2025-01-01", "active": True},
        {"name": "SonetoBot daily maintenance", "hours_per_week": 1, "category": "product", "starts_at": "2024-01-01", "active": True},
        {"name": "Cascadia AI meetup planning", "hours_per_week": 2, "category": "community", "starts_at": "2025-06-01", "active": True},
    ]
    for c in commitments_data:
        db.table("commitments").insert({"user_id": USER_ID, **c}).execute()
    print(f"✓ {len(commitments_data)} commitments")

    # --- Tasks (with embeddings) ---
    print("📋 Inserting tasks with embeddings...")
    tasks_data = [
        {"title": "Design Latido Capture screen", "category": "deep_work", "energy_level": "high", "estimated_minutes": 120, "project": "Latido"},
        {"title": "Send invoice to Mario", "category": "admin", "energy_level": "low", "estimated_minutes": 15, "project": "ComadreLab Clients"},
        {"title": "Review Nouvie PromoMix feature PR", "category": "client_work", "energy_level": "medium", "estimated_minutes": 45, "project": "Nouvie"},
        {"title": "Write MujerTech Module 2 lesson plan", "category": "deep_work", "energy_level": "high", "estimated_minutes": 90, "project": "MujerTech Module 2"},
        {"title": "Update Cascadia landing page events section", "category": "maintenance", "energy_level": "low", "estimated_minutes": 30, "project": "Cascadia AI Collective"},
        {"title": "Fix SonetoBot CRON timing issue", "category": "maintenance", "energy_level": "medium", "estimated_minutes": 45, "project": "SonetoBot"},
        {"title": "Respond to n8n ambassador program follow-up", "category": "admin", "energy_level": "low", "estimated_minutes": 15, "project": None},
        {"title": "Grocery shopping", "category": "personal", "energy_level": "low", "estimated_minutes": 45, "project": None},
        {"title": "Draft Latido MCP server tools", "category": "deep_work", "energy_level": "high", "estimated_minutes": 90, "project": "Latido"},
        {"title": "Prepare ComadreLab client presentation", "category": "client_work", "energy_level": "high", "estimated_minutes": 60, "project": "ComadreLab Clients"},
    ]

    for i, t in enumerate(tasks_data):
        project_id = proj_by_name.get(t["project"]) if t["project"] else None
        print(f"  [{i+1}/{len(tasks_data)}] Embedding: {t['title']}")
        task_embedding = embed(t["title"])

        db.table("tasks").insert({
            "user_id": USER_ID,
            "title": t["title"],
            "status": "inbox",
            "category": t["category"],
            "energy_level": t["energy_level"],
            "estimated_minutes": t["estimated_minutes"],
            "project_id": project_id,
            "embedding": task_embedding,
        }).execute()

    print(f"✓ {len(tasks_data)} tasks with embeddings")

    print("\n🎉 Seed complete! All tasks have embeddings for hybrid search.")


if __name__ == "__main__":
    main()
