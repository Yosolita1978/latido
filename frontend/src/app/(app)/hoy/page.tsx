import { callTool } from "@/lib/mcp-client";
import { requireUser } from "@/lib/auth";
import { DayView } from "@/components/hoy/DayView";
import { getTodayEvents } from "@/lib/google-calendar";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface Project {
  id: string;
  name: string;
}

interface Plan {
  id: string;
  plan_date: string;
  time_blocks: Array<{
    task_id: string;
    start_time: string;
    end_time: string;
    slot_type: string;
    plan_rank?: number;
    task?: {
      id: string;
      title: string;
      status: string;
      category: string;
      energy_level: "low" | "medium" | "high";
      project_id: string | null;
      estimated_minutes?: number;
      completed_at?: string | null;
    };
  }>;
  total_planned_minutes: number;
  total_completed_minutes: number | null;
  completion_rate: number | null;
  mood: string | null;
}

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

interface UserSettings {
  timezone: string;
}

export default async function HoyPage() {
  const user = await requireUser();
  const planDate = getTodayDate();

  // Check if user has settings — if not, redirect to onboarding
  let settings: UserSettings | null = null;
  try {
    settings = (await callTool("get_user_settings", { user_id: user.id })) as UserSettings;
  } catch {
    settings = null;
  }

  if (!settings) {
    redirect("/settings?onboarding=1");
  }

  const [plan, rawProjects] = await Promise.all([
    callTool("get_todays_plan", {
      user_id: user.id,
      plan_date: planDate,
    }) as Promise<Plan | null>,
    callTool("get_projects", { user_id: user.id }),
  ]);

  const projects: Project[] = Array.isArray(rawProjects) ? rawProjects : [];
  const projectsMap: Record<string, string> = {};
  for (const p of projects) {
    projectsMap[p.id] = p.name;
  }

  // Fetch all unscheduled tasks
  const rawTasks = await callTool("get_unscheduled_tasks", { user_id: user.id });
  const allUnscheduled: Array<{
    id: string;
    title: string;
    category: string;
    energy_level: "low" | "medium" | "high";
    estimated_minutes: number | null;
    project_id: string | null;
    deferred_count: number;
    scheduled_at: string | null;
    created_at: string;
  }> = Array.isArray(rawTasks) ? rawTasks : [];

  const taskCount = allUnscheduled.length;

  // Tasks captured today OR scheduled for today (and not yet in plan as a time block)
  const todayDateStr = planDate;
  const plannedTaskIds = new Set(
    plan?.time_blocks?.map((b) => b.task_id).filter(Boolean) ?? [],
  );
  const capturedToday = allUnscheduled.filter((t) => {
    if (plannedTaskIds.has(t.id)) return false;
    const createdLocal = new Date(t.created_at);
    const createdDateStr = `${createdLocal.getFullYear()}-${String(createdLocal.getMonth() + 1).padStart(2, "0")}-${String(createdLocal.getDate()).padStart(2, "0")}`;
    const isCreatedToday = createdDateStr === todayDateStr;
    const isScheduledToday =
      t.scheduled_at &&
      (() => {
        const d = new Date(t.scheduled_at);
        const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return s === todayDateStr;
      })();
    return isCreatedToday || isScheduledToday;
  });

  // Fetch calendar events (silently fail if Google not connected)
  let calendarEvents: Awaited<ReturnType<typeof getTodayEvents>> = [];
  try {
    calendarEvents = await getTodayEvents(user.id, settings.timezone);
  } catch {
    // Ignore — show plan without calendar
  }

  return (
    <DayView
      plan={plan}
      projects={projectsMap}
      planDate={planDate}
      taskCount={taskCount}
      mood={plan?.mood ?? null}
      calendarEvents={calendarEvents}
      capturedToday={capturedToday}
    />
  );
}
