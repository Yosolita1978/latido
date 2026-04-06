import { callTool } from "@/lib/mcp-client";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase";
import { ReflectionView } from "@/components/reflexion/ReflectionView";
import { PatronesView } from "@/components/reflexion/PatronesView";

export const dynamic = "force-dynamic";

interface Plan {
  completion_rate: number | null;
  reflection: string | null;
  time_blocks: Array<{
    slot_type: string;
    task?: { status: string };
  }>;
}

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

export default async function PatronesPage() {
  const user = await requireUser();

  const [plan, patterns] = await Promise.all([
    callTool("get_todays_plan", {
      user_id: user.id,
      plan_date: getTodayDate(),
    }) as Promise<Plan | null>,
    createAdminClient()
      .from("user_patterns")
      .select("id, pattern_key, pattern_value, confidence, last_updated")
      .eq("user_id", user.id)
      .order("confidence", { ascending: false })
      .then((res) => res.data ?? []),
  ]);

  const taskBlocks = plan?.time_blocks?.filter((b) => b.slot_type !== "break" && b.task) ?? [];
  const tasksCompleted = taskBlocks.filter((b) => b.task!.status === "completed").length;
  const tasksDeferred = taskBlocks.filter((b) => b.task!.status !== "completed").length;

  return (
    <div className="flex flex-col gap-(--space-8) animate-fade-slide-up">
      {/* Reflection card (if available) */}
      <div>
        <h2 className="font-[family-name:var(--font-heading)] text-xl text-blanco mb-(--space-4) italic">
          Reflexión del día
        </h2>
        <ReflectionView
          completionRate={plan?.completion_rate ?? null}
          reflection={plan?.reflection ?? null}
          tasksCompleted={tasksCompleted}
          tasksDeferred={tasksDeferred}
        />
      </div>

      {/* Patterns section */}
      <div>
        <h2 className="font-[family-name:var(--font-heading)] text-xl text-blanco mb-(--space-2) italic">
          Lo que Latido sabe de ti
        </h2>
        <p className="text-xs text-gris/60 mb-(--space-4) font-[family-name:var(--font-body)]">
          Estos patrones se aprenden de tu actividad diaria.
        </p>
        <PatronesView patterns={patterns} />
      </div>
    </div>
  );
}
