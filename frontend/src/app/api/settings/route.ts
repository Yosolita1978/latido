import { callTool } from "@/lib/mcp-client";
import { createAdminClient } from "@/lib/supabase";
import { requireUser } from "@/lib/auth";

export async function GET() {
  const user = await requireUser();

  try {
    const settings = await callTool("get_user_settings", { user_id: user.id });
    return Response.json(settings);
  } catch {
    // No settings yet — return null so the frontend knows
    return Response.json(null);
  }
}

export async function PATCH(request: Request) {
  const user = await requireUser();
  const settings = await request.json();

  // Check if settings exist — if not, create them
  const db = createAdminClient();
  const { data: existing } = await db
    .from("user_settings")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    // Create default settings row first
    const { error: insertError } = await db.from("user_settings").insert({
      user_id: user.id,
      timezone: settings.timezone ?? "America/Mexico_City",
      work_hours_start: settings.work_hours_start ?? "09:00",
      work_hours_end: settings.work_hours_end ?? "18:00",
      planning_time: settings.planning_time ?? "morning",
      max_daily_tasks: settings.max_daily_tasks ?? null,
      notification_channel: settings.notification_channel ?? "email",
    });

    if (insertError) {
      return Response.json(
        { error: `Insert failed: ${insertError.message}`, details: insertError },
        { status: 500 },
      );
    }

    return Response.json({ success: true, created: true });
  }

  try {
    const result = await callTool("update_user_settings", {
      user_id: user.id,
      settings,
    });
    return Response.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
