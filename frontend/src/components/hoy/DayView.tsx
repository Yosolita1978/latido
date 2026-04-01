"use client";

import { useEffect, useState, useCallback } from "react";
import { ProgressArc } from "@/components/ui/ProgressArc";
import { TimeBlock } from "@/components/ui/TimeBlock";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { TEMP_USER_ID } from "@/lib/constants";

interface TaskData {
  id: string;
  title: string;
  status: string;
  category: string;
  energy_level: "low" | "medium" | "high";
  project_id: string | null;
  estimated_minutes?: number;
}

interface Block {
  task_id: string;
  start_time: string;
  end_time: string;
  slot_type: string;
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

interface DayViewProps {
  plan: Plan | null;
  projects: ProjectMap;
  planDate: string;
}

function getOverallEnergy(blocks: Block[], statuses: Record<string, string>): "low" | "medium" | "high" {
  const pending = blocks.filter(
    (b) => b.slot_type !== "break" && b.task && statuses[b.task_id] !== "completed",
  );
  if (pending.length === 0) return "low";
  const levels = pending.map((b) => b.task!.energy_level);
  if (levels.includes("high")) return "high";
  if (levels.includes("medium")) return "medium";
  return "low";
}

const energyLabels = {
  low: "Energía baja",
  medium: "Energía media",
  high: "Energía alta",
};

export function DayView({ plan: initialPlan, projects, planDate }: DayViewProps) {
  const [plan, setPlan] = useState(initialPlan);
  const [taskStatuses, setTaskStatuses] = useState<Record<string, string>>({});
  const [showAll, setShowAll] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (plan) {
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
    if (!plan) return;

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

  const handleToggle = useCallback(async (taskId: string) => {
    const currentStatus = taskStatuses[taskId];
    const newStatus = currentStatus === "completed" ? "scheduled" : "completed";

    setTaskStatuses((prev) => ({ ...prev, [taskId]: newStatus }));

    try {
      const response = await fetch("/api/tasks/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId, status: newStatus }),
      });
      if (!response.ok) throw new Error(`Error ${response.status}`);
    } catch {
      setTaskStatuses((prev) => ({ ...prev, [taskId]: currentStatus }));
      setToast({ message: "No se pudo actualizar la tarea", type: "error" });
    }
  }, [taskStatuses]);

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
  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-12rem)] gap-[var(--space-6)]">
        <ProgressArc completed={0} total={0} />
        <p className="text-gris text-center">No hay plan para hoy todavía.</p>
        <Button onClick={handleGeneratePlan} disabled={generating}>
          {generating ? (
            <span className="flex items-center gap-[var(--space-2)]">
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

  // Separate task blocks from breaks
  const taskBlocks = plan.time_blocks.filter((b) => b.slot_type !== "break" && b.task);
  const completedCount = taskBlocks.filter((b) => taskStatuses[b.task_id] === "completed").length;
  const totalCount = taskBlocks.length;

  // TOP 3 and overflow
  const top3 = taskBlocks.slice(0, 3);
  const overflow = taskBlocks.slice(3);
  const overallEnergy = getOverallEnergy(taskBlocks, taskStatuses);

  // Find next upcoming event-like task (client_work with a time)
  const upcomingEvent = taskBlocks.find(
    (b) => b.task?.category === "client_work" && taskStatuses[b.task_id] !== "completed",
  );

  return (
    <div className="flex flex-col items-center gap-[var(--space-6)]">
      {/* Page dots */}
      <div className="flex items-center gap-1.5 pt-[var(--space-2)]">
        <div className="w-6 h-1.5 rounded-full bg-azul" />
        <div className="w-1.5 h-1.5 rounded-full bg-gris/40" />
        <div className="w-1.5 h-1.5 rounded-full bg-gris/40" />
      </div>
      <span className="text-xs text-gris tracking-widest uppercase">Hoy</span>

      {/* Focus ring */}
      <ProgressArc completed={completedCount} total={totalCount} />

      {/* Energy badge */}
      <Badge
        label={`⚡ ${energyLabels[overallEnergy]}`}
        className="bg-bg-card-elevated text-amarillo border border-amarillo/20"
      />

      {/* Upcoming event */}
      {upcomingEvent && (
        <div className="w-full bg-bg-card rounded-[var(--radius-lg)] p-[var(--space-4)] flex items-center gap-[var(--space-3)]">
          <div className="w-8 h-8 bg-bg-card-elevated rounded-[var(--radius-sm)] flex items-center justify-center text-gris">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-blanco font-medium truncate">
              {upcomingEvent.task?.project_id ? projects[upcomingEvent.task.project_id] : upcomingEvent.task?.title}
            </p>
            <p className="text-xs text-gris">
              {upcomingEvent.start_time} PM · Zoom
            </p>
          </div>
          <span className="text-xs text-verde whitespace-nowrap">
            en {upcomingEvent.start_time}
          </span>
        </div>
      )}

      {/* TOP 3 section */}
      <div className="w-full">
        <span className="text-xs text-gris tracking-widest uppercase mb-[var(--space-3)] block">
          Top {Math.min(3, taskBlocks.length)}
        </span>
        <div className="flex flex-col gap-[var(--space-3)]">
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
              onToggle={handleToggle}
            />
          ))}
        </div>

        {/* Swipe hint */}
        <p className="text-xs text-gris/50 text-center mt-[var(--space-3)]">
          ← desliza para completar o diferir →
        </p>
      </div>

      {/* Overflow tasks */}
      {overflow.length > 0 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full bg-bg-card rounded-[var(--radius-lg)] py-[var(--space-3)] text-center"
        >
          <span className="text-sm text-azul font-medium">
            {showAll ? "Ocultar" : `${overflow.length} tareas más`}
          </span>
          <span className="text-xs text-gris"> · toca para ver</span>
        </button>
      )}

      {showAll && (
        <div className="w-full flex flex-col gap-[var(--space-3)]">
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
              onToggle={handleToggle}
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
