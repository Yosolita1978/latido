import { validateCronAuth } from "@/lib/cron-auth";
import { callTool } from "@/lib/mcp-client";
import { getTodayEvents } from "@/lib/google-calendar";

interface EnrichedTimeBlock {
  task_id?: string;
  start_time: string; // "HH:MM"
  end_time: string;   // "HH:MM"
  plan_rank: number;
  task?: {
    id: string;
    title: string;
    energy_level: "alta" | "media" | "baja";
  };
}

interface DailyPlan {
  id: string;
  time_blocks: EnrichedTimeBlock[];
}

interface UserSettings {
  timezone: string;
}

/**
 * CRON endpoint for n8n Workflow 4 (Morning Nudge, 7:30 AM PST).
 *
 * Auth: Authorization: Bearer <CRON_API_KEY>
 * Body: { user_id: string, plan_date: string }
 *
 * Returns a snapshot of today's plan for the morning Telegram nudge:
 *   - has_plan:        true if a plan with at least one block exists
 *   - task_count:      number of scheduled tasks
 *   - top3:            titles of the 3 highest-priority tasks (lowest plan_rank > 0)
 *   - current_energy:  energy_level of the task currently in progress in the
 *                      user's timezone, or null if no block contains "now"
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
    // Fetch plan, settings, in parallel
    const [plan, settings] = await Promise.all([
      callTool("get_todays_plan", { user_id, plan_date }) as Promise<DailyPlan | null>,
      callTool("get_user_settings", { user_id }) as Promise<UserSettings | null>,
    ]);

    const blocks = plan?.time_blocks ?? [];
    const timezone = settings?.timezone ?? "America/Los_Angeles";

    // Fetch calendar events for the plan date
    let calendarEvents: { summary: string; start_time: string; end_time: string; is_all_day: boolean }[] = [];
    try {
      calendarEvents = (await getTodayEvents(user_id, timezone, plan_date)).map((ev) => ({
        summary: ev.summary,
        start_time: ev.start_time,
        end_time: ev.end_time,
        is_all_day: ev.is_all_day,
      }));
    } catch {
      // Calendar fetch failed — proceed without events
    }

    // Empty / missing plan — return the no-plan shape
    if (blocks.length === 0) {
      return Response.json({
        has_plan: false,
        task_count: 0,
        top3: [],
        current_energy: null,
        calendar_events: calendarEvents,
      });
    }

    // TOP 3: blocks with plan_rank > 0, sorted ascending, first 3 titles
    const top3 = blocks
      .filter((b) => b.plan_rank > 0 && b.task?.title)
      .sort((a, b) => a.plan_rank - b.plan_rank)
      .slice(0, 3)
      .map((b) => b.task!.title);

    const task_count = blocks.filter((b) => !!b.task_id).length;

    // current_energy: find the block whose time window contains "now"
    let current_energy: "alta" | "media" | "baja" | null = null;
    const now = nowHHMMInTimezone(timezone);
    const currentBlock = blocks.find(
      (b) =>
        b.task?.energy_level &&
        b.start_time <= now &&
        now < b.end_time,
    );
    current_energy = currentBlock?.task?.energy_level ?? null;

    return Response.json({
      has_plan: true,
      task_count,
      top3,
      current_energy,
      calendar_events: calendarEvents,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("CRON morning-status error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}

/**
 * Returns the current time as a zero-padded "HH:MM" string in the given IANA
 * timezone. Used for comparing against time_block start_time / end_time, which
 * are also stored as "HH:MM" local strings.
 */
function nowHHMMInTimezone(timezone: string): string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  // en-GB with hour12:false gives "HH:MM" exactly
  return fmt.format(new Date());
}
