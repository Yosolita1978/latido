import { createAdminClient } from "@/lib/supabase";
import { requireUser } from "@/lib/auth";

export async function GET() {
  const user = await requireUser();

  const db = createAdminClient();
  const { data, error } = await db
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .order("priority");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}

export async function POST(request: Request) {
  const user = await requireUser();
  const { name, hours_per_week_needed, priority } = await request.json();

  if (!name) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("projects")
    .insert({
      user_id: user.id,
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
  const user = await requireUser();
  const { id, status, hours_per_week_needed, priority } = await request.json();

  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status !== undefined) updates.status = status;
  if (hours_per_week_needed !== undefined) updates.hours_per_week_needed = hours_per_week_needed;
  if (priority !== undefined) updates.priority = priority;

  const db = createAdminClient();
  const { data, error } = await db
    .from("projects")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}
