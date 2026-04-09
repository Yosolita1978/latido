import { validateCronAuth } from "@/lib/cron-auth";
import { generatePlan } from "@/lib/agents/plan";
import { callTool } from "@/lib/mcp-client";
import { getTodayEvents } from "@/lib/google-calendar";

interface PlanBlock {
  start_time: string;
  end_time: string;
  slot_type: string;
  plan_rank?: number;
  task?: {
    title: string;
    status: string;
  };
}

interface ExistingPlan {
  id: string;
  time_blocks: PlanBlock[];
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
    let settings: UserSettings | null = null;
    try {
      settings = (await callTool("get_user_settings", { user_id })) as UserSettings | null;
    } catch {
      settings = null;
    }
    if (!settings?.timezone) {
      return Response.json({
        success: true,
        skipped: true,
        reason: "el usuario aún no ha completado la configuración inicial",
      });
    }

    // Fetch calendar events for the plan date
    let calendarEvents: { summary: string; start_time: string; end_time: string; is_all_day: boolean }[] = [];
    try {
      calendarEvents = (await getTodayEvents(user_id, settings.timezone, plan_date)).map((ev) => ({
        summary: ev.summary,
        start_time: ev.start_time,
        end_time: ev.end_time,
        is_all_day: ev.is_all_day,
      }));
    } catch {
      // Calendar fetch failed — proceed without events
    }

    // Guard 2: skip if a plan with tasks already exists for this date
    const existing = (await callTool("get_todays_plan", {
      user_id,
      plan_date,
    })) as ExistingPlan | null;

    if (existing && Array.isArray(existing.time_blocks) && existing.time_blocks.length > 0) {
      const taskBlocks = existing.time_blocks
        .filter((b) => b.slot_type !== "break" && b.task)
        .map((b) => ({
          title: b.task!.title,
          start_time: b.start_time,
          end_time: b.end_time,
          plan_rank: b.plan_rank ?? 0,
          status: b.task!.status,
        }));

      const top3 = taskBlocks
        .filter((b) => b.plan_rank >= 1 && b.plan_rank <= 3)
        .sort((a, b) => a.plan_rank - b.plan_rank);

      return Response.json({
        success: true,
        skipped: true,
        reason: "ya existe un plan para esta fecha",
        plan_summary: {
          total_tasks: taskBlocks.length,
          top3: top3.map((b) => ({
            title: b.title,
            start_time: b.start_time,
            end_time: b.end_time,
          })),
          all_tasks: taskBlocks.map((b) => ({
            title: b.title,
            start_time: b.start_time,
            end_time: b.end_time,
            status: b.status,
          })),
          calendar_events: calendarEvents,
        },
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
    return Response.json({ ...result, calendar_events: calendarEvents });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("CRON plan error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
