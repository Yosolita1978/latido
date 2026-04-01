interface CompletedTask {
  id: string;
  status: string;
  energy_level: string;
  completed_at?: string | null;
}

interface PlanBlock {
  task_id: string;
  start_time: string;
  end_time: string;
  slot_type: string;
  plan_rank?: number;
  task?: CompletedTask;
}

interface PeakWindow {
  start: number;
  end: number;
}

/**
 * Enfoque: composite focus score (0–5).
 * Answers: "Am I doing the right things at the right time in the right way?"
 *
 * - Alignment (40%): completed planned tasks within ±1 hour of schedule
 * - Energy match (30%): high-energy tasks in peak, low-energy in off-peak
 * - Priority integrity (30%): TOP 3 tasks completed
 */
export function calculateEnfoque(
  blocks: PlanBlock[],
  peakWindow: PeakWindow = { start: 8, end: 12 },
): { score: number; alignment: number; energyMatch: number; priorityIntegrity: number } {
  const taskBlocks = blocks.filter((b) => b.slot_type !== "break" && b.task);
  if (taskBlocks.length === 0) {
    return { score: 0, alignment: 0, energyMatch: 0, priorityIntegrity: 0 };
  }

  const completedBlocks = taskBlocks.filter((b) => b.task!.status === "completed");

  // 1. Alignment (40%) — completed tasks within ±1 hour of planned time
  const alignedTasks = completedBlocks.filter((block) => {
    if (!block.task?.completed_at) return false;
    const completedHour = new Date(block.task.completed_at).getHours();
    const plannedHour = parseInt(block.start_time.split(":")[0], 10);
    return Math.abs(completedHour - plannedHour) <= 1;
  });
  const alignment = alignedTasks.length / taskBlocks.length;

  // 2. Energy match (30%) — right energy level for the time of day
  const energyMatchedTasks = completedBlocks.filter((block) => {
    if (!block.task?.completed_at) return false;
    const hour = new Date(block.task.completed_at).getHours();
    const inPeak = hour >= peakWindow.start && hour < peakWindow.end;
    const energy = block.task.energy_level;

    if (energy === "high" && inPeak) return true;
    if (energy === "low" && !inPeak) return true;
    if (energy === "medium") return true;
    return false;
  });
  const energyMatch = energyMatchedTasks.length / Math.max(completedBlocks.length, 1);

  // 3. Priority integrity (30%) — TOP 3 tasks completed
  const top3Blocks = taskBlocks
    .filter((b) => b.plan_rank && b.plan_rank >= 1 && b.plan_rank <= 3)
    .sort((a, b) => (a.plan_rank ?? 0) - (b.plan_rank ?? 0));

  // Fallback: if no plan_rank set, use first 3 task blocks
  const top3 = top3Blocks.length > 0 ? top3Blocks : taskBlocks.slice(0, 3);
  const top3Ids = top3.map((b) => b.task_id);
  const top3Completed = top3Ids.filter((id) =>
    completedBlocks.some((b) => b.task_id === id),
  ).length;
  const priorityIntegrity = top3.length > 0 ? top3Completed / top3.length : 0;

  // Combined score on 0–5 scale
  const raw = alignment * 0.4 + energyMatch * 0.3 + priorityIntegrity * 0.3;
  const score = Math.round(raw * 5);

  return { score, alignment, energyMatch, priorityIntegrity };
}

/**
 * Get current energy level based on time of day vs peak window.
 */
export function getCurrentEnergy(
  peakWindow: PeakWindow = { start: 8, end: 12 },
): "alta" | "media" | "baja" {
  const currentHour = new Date().getHours();
  const inPeak = currentHour >= peakWindow.start && currentHour < peakWindow.end;
  const nearEnd = currentHour >= peakWindow.end && currentHour < peakWindow.end + 2;

  if (inPeak) return "alta";
  if (nearEnd) return "media";
  return "baja";
}
