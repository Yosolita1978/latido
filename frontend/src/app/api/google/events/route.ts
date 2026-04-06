import { requireUser } from "@/lib/auth";
import { getTodayEvents } from "@/lib/google-calendar";
import { callTool } from "@/lib/mcp-client";
import { createAdminClient } from "@/lib/supabase";

interface UserSettings {
  timezone: string;
}

export async function GET() {
  const user = await requireUser();

  // Check what scope is stored
  const db = createAdminClient();
  const { data: tokenRow } = await db
    .from("google_oauth_tokens")
    .select("scope, email, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  let timezone = "America/Mexico_City";
  try {
    const settings = (await callTool("get_user_settings", { user_id: user.id })) as UserSettings;
    if (settings?.timezone) timezone = settings.timezone;
  } catch {
    // use default
  }

  try {
    const events = await getTodayEvents(user.id, timezone);
    return Response.json({
      ok: true,
      timezone,
      stored_scope: tokenRow?.scope ?? null,
      stored_email: tokenRow?.email ?? null,
      stored_updated_at: tokenRow?.updated_at ?? null,
      count: events.length,
      events,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      {
        ok: false,
        timezone,
        stored_scope: tokenRow?.scope ?? null,
        stored_email: tokenRow?.email ?? null,
        stored_updated_at: tokenRow?.updated_at ?? null,
        error: message,
      },
      { status: 500 },
    );
  }
}
