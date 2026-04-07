import { createAdminClient } from "@/lib/supabase";
import { requireUser } from "@/lib/auth";
import { ProjectsList } from "@/components/proyectos/ProjectsList";

export const dynamic = "force-dynamic";

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export default async function ProyectosPage() {
  const user = await requireUser();
  const db = createAdminClient();

  const [projectsResult, settingsResult] = await Promise.all([
    db
      .from("projects")
      .select("id, name, status, hours_per_week_needed, priority")
      .eq("user_id", user.id)
      .order("priority"),
    db
      .from("user_settings")
      .select("work_hours_start, work_hours_end")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  // Calculate available work hours per week (5 working days)
  let weeklyHoursAvailable = 40;
  if (settingsResult.data) {
    const startMin = timeToMinutes(settingsResult.data.work_hours_start);
    const endMin = timeToMinutes(settingsResult.data.work_hours_end);
    weeklyHoursAvailable = Math.round(((endMin - startMin) / 60) * 5);
  }

  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      <h1 className="font-[family-name:var(--font-heading)] text-2xl text-blanco">
        Mis proyectos
      </h1>
      <ProjectsList
        projects={projectsResult.data ?? []}
        weeklyHoursAvailable={weeklyHoursAvailable}
      />
    </div>
  );
}
