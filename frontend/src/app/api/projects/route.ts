import { createServerClient } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");

  if (!userId) {
    return Response.json({ error: "user_id is required" }, { status: 400 });
  }

  const db = createServerClient();
  const { data, error } = await db
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("priority");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}

export async function POST(request: Request) {
  const { user_id, name, hours_per_week_needed, priority } = await request.json();

  if (!user_id || !name) {
    return Response.json({ error: "user_id and name are required" }, { status: 400 });
  }

  const db = createServerClient();
  const { data, error } = await db
    .from("projects")
    .insert({
      user_id,
      name,
      hours_per_week_needed: hours_per_week_needed ?? null,
      priority: priority ?? 3,
      status: "active",
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}

export async function PATCH(request: Request) {
  const { id, status, hours_per_week_needed, priority } = await request.json();

  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status !== undefined) updates.status = status;
  if (hours_per_week_needed !== undefined) updates.hours_per_week_needed = hours_per_week_needed;
  if (priority !== undefined) updates.priority = priority;

  const db = createServerClient();
  const { data, error } = await db
    .from("projects")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}
