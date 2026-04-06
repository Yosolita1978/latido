import { createAdminClient } from "@/lib/supabase";
import { requireUser } from "@/lib/auth";
import { ProjectsList } from "@/components/proyectos/ProjectsList";

export const dynamic = "force-dynamic";

export default async function ProyectosPage() {
  const user = await requireUser();
  const db = createAdminClient();
  const { data: projects } = await db
    .from("projects")
    .select("id, name, status, hours_per_week_needed, priority")
    .eq("user_id", user.id)
    .order("priority");

  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      <h1 className="font-[family-name:var(--font-heading)] text-2xl text-blanco">
        Mis proyectos
      </h1>
      <ProjectsList projects={projects ?? []} />
    </div>
  );
}
