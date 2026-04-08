import { validateCronAuth } from "@/lib/cron-auth";
import { generatePlan } from "@/lib/agents/plan";
import { callTool } from "@/lib/mcp-client";

interface ExistingPlan {
  id: string;
  time_blocks: unknown[];
}

interface UserSettings {
  timezone: string;
}

/**
 * CRON endpoint for n8n to trigger morning plan generation.
 *
 * Auth: Authorization: Bearer <CRON_API_KEY>
 * Body: { user_id: string, plan_date: string }
 *
 * If a plan with non-empty time_blocks already exists for that date, it skips
 * (so manual planning isn't overwritten).
 */
export async function POST(request: Request) {
  const authError = validateCronAuth(request);
  if (authError) return authError;

  let body: { user_id?: string; plan_date?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { user_id, plan_date } = body;
  if (!user_id || !plan_date) {
    return Response.json(
      { error: "user_id and plan_date are required" },
      { status: 400 },
    );
  }

  try {
    // Guard 1: user must have settings (means they completed onboarding)
    let hasSettings = false;
    try {
      const settings = (await callTool("get_user_settings", { user_id })) as UserSettings | null;
      hasSettings = !!settings?.timezone;
    } catch {
      hasSettings = false;
    }
    if (!hasSettings) {
      return Response.json({
        success: true,
        skipped: true,
        reason: "el usuario aún no ha completado la configuración inicial",
      });
    }

    // Guard 2: skip if a plan with tasks already exists for this date
    const existing = (await callTool("get_todays_plan", {
      user_id,
      plan_date,
    })) as ExistingPlan | null;

    if (existing && Array.isArray(existing.time_blocks) && existing.time_blocks.length > 0) {
      return Response.json({
        success: true,
        skipped: true,
        reason: "ya existe un plan para esta fecha",
      });
    }

    // Guard 3: skip if there are no tasks to plan
    const rawTasks = await callTool("get_unscheduled_tasks", { user_id });
    const taskCount = Array.isArray(rawTasks) ? rawTasks.length : 0;
    if (taskCount === 0) {
      return Response.json({
        success: true,
        skipped: true,
        reason: "no hay tareas para planificar",
      });
    }

    const result = await generatePlan(user_id, plan_date);
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("CRON plan error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
