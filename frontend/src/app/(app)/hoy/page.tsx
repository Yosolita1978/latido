import { callTool } from "@/lib/mcp-client";
import { TEMP_USER_ID } from "@/lib/constants";
import { DayView } from "@/components/hoy/DayView";

export const dynamic = "force-dynamic";

interface Project {
  id: string;
  name: string;
}

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

export default async function HoyPage() {
  const planDate = getTodayDate();

  const [plan, projects] = await Promise.all([
    callTool("get_todays_plan", {
      user_id: TEMP_USER_ID,
      plan_date: planDate,
    }),
    callTool("get_projects", { user_id: TEMP_USER_ID }) as Promise<Project[]>,
  ]);

  const projectsMap: Record<string, string> = {};
  for (const p of projects) {
    projectsMap[p.id] = p.name;
  }

  return (
    <DayView
      plan={plan as Parameters<typeof DayView>[0]["plan"]}
      projects={projectsMap}
      planDate={planDate}
    />
  );
}
