import { callTool } from "@/lib/mcp-client";
import { requireUser } from "@/lib/auth";
import { DayView } from "@/components/hoy/DayView";
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

export default async function HoyPage() {
  const user = await requireUser();
  const planDate = getTodayDate();

  // Check if user has settings — if not, redirect to onboarding
  let hasSettings = true;
  try {
    await callTool("get_user_settings", { user_id: user.id });
  } catch {
    hasSettings = false;
  }

  if (!hasSettings) {
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

  // Count unscheduled tasks to know if user has any
  const rawTasks = await callTool("get_unscheduled_tasks", { user_id: user.id });
  const taskCount = Array.isArray(rawTasks) ? rawTasks.length : 0;

  return (
    <DayView
      plan={plan}
      projects={projectsMap}
      planDate={planDate}
      taskCount={taskCount}
      mood={plan?.mood ?? null}
    />
  );
}
