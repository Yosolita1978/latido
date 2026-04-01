import { callTool } from "@/lib/mcp-client";
import { TEMP_USER_ID } from "@/lib/constants";
import { ReflectionView } from "@/components/reflexion/ReflectionView";

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

export default async function ReflexionPage() {
  const plan = (await callTool("get_todays_plan", {
    user_id: TEMP_USER_ID,
    plan_date: getTodayDate(),
  })) as Plan | null;

  const taskBlocks = plan?.time_blocks.filter((b) => b.slot_type !== "break" && b.task) ?? [];
  const tasksCompleted = taskBlocks.filter((b) => b.task!.status === "completed").length;
  const tasksDeferred = taskBlocks.filter((b) => b.task!.status !== "completed").length;

  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      <h1 className="font-[family-name:var(--font-heading)] text-2xl text-azul">
        Reflexión del día
      </h1>
      <ReflectionView
        completionRate={plan?.completion_rate ?? null}
        reflection={plan?.reflection ?? null}
        tasksCompleted={tasksCompleted}
        tasksDeferred={tasksDeferred}
        totalTasks={taskBlocks.length}
      />
    </div>
  );
}
