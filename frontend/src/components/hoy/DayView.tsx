"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { ProgressArc } from "@/components/ui/ProgressArc";
import { TimeBlock } from "@/components/ui/TimeBlock";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { TEMP_USER_ID } from "@/lib/constants";
import { calculateEnfoque, getCurrentEnergy } from "@/lib/enfoque";

interface TaskData {
  id: string;
  title: string;
  status: string;
  category: string;
  energy_level: "low" | "medium" | "high";
  project_id: string | null;
  estimated_minutes?: number;
  completed_at?: string | null;
}

interface Block {
  task_id: string;
  start_time: string;
  end_time: string;
  slot_type: string;
  plan_rank?: number;
  task?: TaskData;
}

interface Plan {
  id: string;
  plan_date: string;
  time_blocks: Block[];
  total_planned_minutes: number;
  total_completed_minutes: number | null;
  completion_rate: number | null;
}

interface ProjectMap {
  [id: string]: string;
}

interface PeakWindow {
  start: number;
  end: number;
}

interface DayViewProps {
  plan: Plan | null;
  projects: ProjectMap;
  planDate: string;
  peakWindow?: PeakWindow;
}

const currentEnergyLabels = {
  alta: "Energía alta",
  media: "Energía media",
  baja: "Energía baja",
};

const currentEnergyColors = {
  alta: "bg-rojo/10 text-rojo border-rojo/15",
  media: "bg-amarillo/10 text-amarillo border-amarillo/15",
  baja: "bg-[var(--energy-low)]/10 text-[var(--energy-low)] border-[var(--energy-low)]/15",
};

export function DayView({ plan: initialPlan, projects, planDate, peakWindow = { start: 8, end: 12 } }: DayViewProps) {
  const [plan, setPlan] = useState(initialPlan);
  const [taskStatuses, setTaskStatuses] = useState<Record<string, string>>({});
  const [showAll, setShowAll] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (plan?.time_blocks) {
      const statuses: Record<string, string> = {};
      for (const block of plan.time_blocks) {
        if (block.task) {
          statuses[block.task_id] = block.task.status;
        }
      }
      setTaskStatuses(statuses);
    }
  }, [plan]);

  // SSE connection
  useEffect(() => {
    if (!plan?.time_blocks) return;

    const eventSource = new EventSource(
      `/api/stream/day?user_id=${TEMP_USER_ID}&plan_date=${planDate}`,
    );

    eventSource.addEventListener("task_update", (event) => {
      const data = JSON.parse(event.data);
      setTaskStatuses((prev) => ({ ...prev, [data.task_id]: data.status }));
    });

    eventSource.addEventListener("plan_update", (event) => {
      const data = JSON.parse(event.data);
      setPlan((prev) =>
        prev
          ? { ...prev, completion_rate: data.completion_rate, total_completed_minutes: data.total_completed_minutes }
          : prev,
      );
    });

    return () => eventSource.close();
  }, [plan, planDate]);

  const handleComplete = useCallback(async (taskId: string, actualMinutes: number) => {
    setTaskStatuses((prev) => ({ ...prev, [taskId]: "completed" }));
    try {
      const response = await fetch("/api/tasks/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: taskId,
          status: "completed",
          actual_minutes: actualMinutes,
          completed_at: new Date().toISOString(),
        }),
      });
      if (!response.ok) throw new Error(`Error ${response.status}`);
    } catch {
      setTaskStatuses((prev) => ({ ...prev, [taskId]: "scheduled" }));
      setToast({ message: "No se pudo completar la tarea", type: "error" });
    }
  }, []);

  const handleDefer = useCallback(async (taskId: string) => {
    setTaskStatuses((prev) => ({ ...prev, [taskId]: "deferred" }));
    try {
      const response = await fetch("/api/tasks/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: taskId,
          status: "deferred",
          user_id: TEMP_USER_ID,
        }),
      });
      if (!response.ok) throw new Error(`Error ${response.status}`);
    } catch {
      setTaskStatuses((prev) => ({ ...prev, [taskId]: "scheduled" }));
      setToast({ message: "No se pudo diferir la tarea", type: "error" });
    }
  }, []);

  const handleCancel = useCallback(async (taskId: string) => {
    setTaskStatuses((prev) => ({ ...prev, [taskId]: "inbox" }));
    try {
      const response = await fetch("/api/tasks/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId, status: "inbox" }),
      });
      if (!response.ok) throw new Error(`Error ${response.status}`);
    } catch {
      setTaskStatuses((prev) => ({ ...prev, [taskId]: "scheduled" }));
      setToast({ message: "No se pudo cancelar la tarea", type: "error" });
    }
  }, []);

  async function handleGeneratePlan() {
    setGenerating(true);
    try {
      const response = await fetch("/api/agents/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: TEMP_USER_ID, plan_date: planDate }),
      });
      if (!response.ok) throw new Error(`Error ${response.status}`);
      window.location.reload();
    } catch {
      setToast({ message: "No se pudo generar el plan", type: "error" });
      setGenerating(false);
    }
  }

  // No plan yet
  if (!plan || !plan.time_blocks) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-12rem)] gap-(--space-8) animate-fade-slide-up">
        <Image
          src="/images/icon-white.png"
          alt="Latido"
          width={80}
          height={80}
          className="opacity-60"
          priority
        />
        <div className="text-center">
          <p className="text-blanco font-[family-name:var(--font-heading)] text-lg italic">
            Tu día espera
          </p>
          <p className="text-gris text-sm mt-1">No hay plan para hoy todavía.</p>
        </div>
        <Button onClick={handleGeneratePlan} disabled={generating}>
          {generating ? (
            <span className="flex items-center gap-(--space-2)">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generando plan...
            </span>
          ) : (
            "Generar plan para hoy"
          )}
        </Button>
      </div>
    );
  }

  // Build enriched blocks with current statuses for Enfoque calculation
  const enrichedBlocks = plan.time_blocks.map((block) => ({
    ...block,
    task: block.task
      ? { ...block.task, status: taskStatuses[block.task_id] ?? block.task.status }
      : block.task,
  }));

  // Calculate Enfoque score
  const { score: enfoqueScore } = calculateEnfoque(enrichedBlocks, peakWindow);

  // Current energy based on time of day
  const currentEnergy = getCurrentEnergy(peakWindow);

  // Separate task blocks from breaks
  const taskBlocks = enrichedBlocks.filter((b) => b.slot_type !== "break" && b.task);

  // TOP 3 by plan_rank (fallback to first 3)
  const top3Ranked = taskBlocks
    .filter((b) => b.plan_rank && b.plan_rank >= 1 && b.plan_rank <= 3)
    .sort((a, b) => (a.plan_rank ?? 0) - (b.plan_rank ?? 0));
  const top3 = top3Ranked.length > 0 ? top3Ranked : taskBlocks.slice(0, 3);
  const top3Ids = new Set(top3.map((b) => b.task_id));
  const overflow = taskBlocks.filter((b) => !top3Ids.has(b.task_id));

  return (
    <div className="flex flex-col items-center gap-(--space-6)">
      <span className="text-xs text-gris tracking-[0.2em] uppercase pt-(--space-2) font-[family-name:var(--font-body)] font-medium">
        Hoy
      </span>

      {/* Enfoque ring */}
      <ProgressArc score={enfoqueScore} />

      {/* Current energy badge (time-based) */}
      <Badge
        label={`${currentEnergyLabels[currentEnergy]}`}
        className={currentEnergyColors[currentEnergy]}
      />

      {/* TOP 3 section */}
      <div className="w-full">
        <span className="text-xs text-gris tracking-[0.15em] uppercase mb-(--space-3) block font-[family-name:var(--font-body)] font-medium">
          Top {Math.min(3, top3.length)}
        </span>
        <div className="flex flex-col gap-(--space-3) stagger-children">
          {top3.map((block, index) => (
            <TimeBlock
              key={`${block.task_id}-${index}`}
              taskId={block.task_id}
              title={block.task?.title ?? "Tarea"}
              projectName={
                block.task?.project_id ? projects[block.task.project_id] : undefined
              }
              startTime={block.start_time}
              endTime={block.end_time}
              energyLevel={block.task?.energy_level ?? "medium"}
              slotType={block.slot_type}
              completed={taskStatuses[block.task_id] === "completed"}
              estimatedMinutes={block.task?.estimated_minutes}
              featured={index === 0}
              onComplete={handleComplete}
              onDefer={handleDefer}
              onCancel={handleCancel}
            />
          ))}
        </div>

        {/* Expand hint */}
        <p className="text-xs text-gris/25 text-center mt-(--space-3) font-[family-name:var(--font-body)]">
          toca una tarea para ver opciones
        </p>
      </div>

      {/* Overflow tasks */}
      {overflow.length > 0 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full bg-bg-card/50 rounded-(--radius-lg) py-(--space-3) text-center border border-blanco/[0.04] transition-all active:scale-[0.99]"
        >
          <span className="text-sm text-azul font-medium">
            {showAll ? "Ocultar" : `${overflow.length} tareas más`}
          </span>
        </button>
      )}

      {showAll && (
        <div className="w-full flex flex-col gap-(--space-3) stagger-children">
          {overflow.map((block, index) => (
            <TimeBlock
              key={`${block.task_id}-overflow-${index}`}
              taskId={block.task_id}
              title={block.task?.title ?? "Tarea"}
              projectName={
                block.task?.project_id ? projects[block.task.project_id] : undefined
              }
              startTime={block.start_time}
              endTime={block.end_time}
              energyLevel={block.task?.energy_level ?? "medium"}
              slotType={block.slot_type}
              completed={taskStatuses[block.task_id] === "completed"}
              estimatedMinutes={block.task?.estimated_minutes}
              onComplete={handleComplete}
              onDefer={handleDefer}
              onCancel={handleCancel}
            />
          ))}
        </div>
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}
