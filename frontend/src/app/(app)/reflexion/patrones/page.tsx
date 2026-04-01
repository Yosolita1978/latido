import { callTool } from "@/lib/mcp-client";
import { TEMP_USER_ID } from "@/lib/constants";
import { createServerClient } from "@/lib/supabase";
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
  const [plan, patterns] = await Promise.all([
    callTool("get_todays_plan", {
      user_id: TEMP_USER_ID,
      plan_date: getTodayDate(),
    }) as Promise<Plan | null>,
    createServerClient()
      .from("user_patterns")
      .select("id, pattern_key, pattern_value, confidence, last_updated")
      .eq("user_id", TEMP_USER_ID)
      .order("confidence", { ascending: false })
      .then((res) => res.data ?? []),
  ]);

  const taskBlocks = plan?.time_blocks?.filter((b) => b.slot_type !== "break" && b.task) ?? [];
  const tasksCompleted = taskBlocks.filter((b) => b.task!.status === "completed").length;
  const tasksDeferred = taskBlocks.filter((b) => b.task!.status !== "completed").length;

  return (
    <div className="flex flex-col gap-[var(--space-8)]">
      {/* Reflection card (if available) */}
      <div>
        <h2 className="font-[family-name:var(--font-heading)] text-xl text-blanco mb-[var(--space-4)]">
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
        <h2 className="font-[family-name:var(--font-heading)] text-xl text-blanco mb-[var(--space-2)]">
          Lo que Latido sabe de ti
        </h2>
        <p className="text-xs text-gris mb-[var(--space-4)]">
          Estos patrones se aprenden de tu actividad diaria. Puedes eliminar cualquiera.
        </p>
        <PatronesView patterns={patterns} />
      </div>
    </div>
  );
}
