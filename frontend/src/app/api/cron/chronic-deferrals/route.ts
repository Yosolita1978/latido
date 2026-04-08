import { validateCronAuth } from "@/lib/cron-auth";
import { callTool } from "@/lib/mcp-client";

interface ChronicDeferral {
  id: string;
  title: string;
  deferred_count: number;
  category: string;
  energy_level: "alta" | "media" | "baja";
}

/**
 * CRON endpoint for n8n Workflow 6 (Deferred Escalation, noon PST).
 *
 * Auth: Authorization: Bearer <CRON_API_KEY>
 * Body: { user_id: string }
 *
 * Returns up to 5 tasks the user has deferred 3+ times, ordered by
 * deferred_count DESC. Used by W6 to send a "do, delegate, or delete?"
 * Telegram nudge at noon. If the list is empty, n8n's IF node skips the
 * notification entirely.
 */
export async function POST(request: Request) {
  const authError = validateCronAuth(request);
  if (authError) return authError;

  let body: { user_id?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { user_id } = body;
  if (!user_id) {
    return Response.json({ error: "user_id is required" }, { status: 400 });
  }

  try {
    const tasks = (await callTool("get_chronic_deferrals", {
      user_id,
    })) as ChronicDeferral[] | null;

    return Response.json({ tasks: tasks ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("CRON chronic-deferrals error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
