"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ProgressArc } from "@/components/ui/ProgressArc";
import { TimeBlock } from "@/components/ui/TimeBlock";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { ReflectionModal } from "@/components/hoy/ReflectionModal";
import { useUserId } from "@/components/AuthProvider";
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

interface CalendarEvent {
  id: string;
  summary: string;
  start_time: string;
  end_time: string;
  is_all_day: boolean;
}

interface CapturedTask {
  id: string;
  title: string;
  category: string;
  energy_level: "low" | "medium" | "high";
  estimated_minutes: number | null;
  project_id: string | null;
  scheduled_at: string | null;
}

interface DayViewProps {
  plan: Plan | null;
  projects: ProjectMap;
  planDate: string;
  peakWindow?: PeakWindow;
  taskCount?: number;
  mood?: string | null;
  calendarEvents?: CalendarEvent[];
  capturedToday?: CapturedTask[];
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

const moodOptions = [
  { level: "low", icon: "〰", label: "Baja", color: "bg-[var(--energy-low)]/15 text-[var(--energy-low)] border-[var(--energy-low)]/30" },
  { level: "medium", icon: "〜", label: "Media", color: "bg-amarillo/15 text-amarillo border-amarillo/30" },
  { level: "high", icon: "⚡", label: "Alta", color: "bg-rojo/15 text-rojo border-rojo/30" },
];

export function DayView({ plan: initialPlan, projects, planDate, peakWindow = { start: 8, end: 12 }, taskCount = 0, mood: initialMood = null, calendarEvents = [], capturedToday = [] }: DayViewProps) {
  useUserId();
  const router = useRouter();
  const [plan, setPlan] = useState(initialPlan);
  const [taskStatuses, setTaskStatuses] = useState<Record<string, string>>({});
  const [showAll, setShowAll] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [currentMood, setCurrentMood] = useState<string | null>(initialMood);
  const [savingMood, setSavingMood] = useState(false);
  const [reflectionOpen, setReflectionOpen] = useState(false);

  // Sync plan state when server re-renders (router.refresh)
  useEffect(() => {
    setPlan(initialPlan);
  }, [initialPlan]);

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
      `/api/stream/day?plan_date=${planDate}`,
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
      router.refresh();
    } catch {
      setTaskStatuses((prev) => ({ ...prev, [taskId]: "scheduled" }));
      setToast({ message: "No se pudo completar la tarea", type: "error" });
    }
  }, [router]);

  const handleDefer = useCallback(async (taskId: string) => {
    setTaskStatuses((prev) => ({ ...prev, [taskId]: "deferred" }));
    try {
      const response = await fetch("/api/tasks/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: taskId,
          status: "deferred",
        }),
      });
      if (!response.ok) throw new Error(`Error ${response.status}`);
      setToast({ message: "Movida a mañana", type: "success" });
      router.refresh();
    } catch {
      setTaskStatuses((prev) => ({ ...prev, [taskId]: "scheduled" }));
      setToast({ message: "No se pudo diferir la tarea", type: "error" });
    }
  }, [router]);

  const handleCancel = useCallback(async (taskId: string) => {
    setTaskStatuses((prev) => ({ ...prev, [taskId]: "inbox" }));
    try {
      const response = await fetch("/api/tasks/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId, status: "inbox" }),
      });
      if (!response.ok) throw new Error(`Error ${response.status}`);
      router.refresh();
    } catch {
      setTaskStatuses((prev) => ({ ...prev, [taskId]: "scheduled" }));
      setToast({ message: "No se pudo cancelar la tarea", type: "error" });
    }
  }, [router]);

  async function handleMoodSelect(level: string) {
    setSavingMood(true);
    setCurrentMood(level);
    try {
      const response = await fetch("/api/energy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ energy_level: level }),
      });
      if (!response.ok) throw new Error(`Error ${response.status}`);
    } catch {
      setCurrentMood(null);
      setToast({ message: "No se pudo guardar tu energía", type: "error" });
    } finally {
      setSavingMood(false);
    }
  }

  async function handleGeneratePlan() {
    setGenerating(true);
    try {
      const response = await fetch("/api/agents/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_date: planDate }),
      });
      if (!response.ok) throw new Error(`Error ${response.status}`);
      window.location.reload();
    } catch {
      setToast({ message: "No se pudo generar el plan", type: "error" });
      setGenerating(false);
    }
  }

  // No plan yet (or plan exists with zero blocks — happens after only logging mood)
  if (!plan || !plan.time_blocks || plan.time_blocks.length === 0) {
    const hasTasks = taskCount > 0;

    return (
      <div className="flex flex-col items-center gap-(--space-6) animate-fade-slide-up py-(--space-8)">
        <Image
          src="/images/icon-white.png"
          alt="Latido"
          width={80}
          height={80}
          className="opacity-60"
          priority
        />

        {/* Energy prompt (before plan) */}
        {!currentMood && (
          <div className="flex flex-col items-center gap-(--space-3)">
            <p className="text-gris text-sm font-[family-name:var(--font-body)]">
              ¿Cómo te sientes hoy?
            </p>
            <div className="flex gap-(--space-3)">
              {moodOptions.map((opt) => (
                <button
                  key={opt.level}
                  onClick={() => handleMoodSelect(opt.level)}
                  disabled={savingMood}
                  className={`flex flex-col items-center gap-1 px-(--space-4) py-(--space-3) rounded-(--radius-lg) border-2 transition-all active:scale-95 bg-bg-card text-gris border-blanco/[0.06] hover:border-blanco/15`}
                >
                  <span className="text-lg">{opt.icon}</span>
                  <span className="text-xs font-[family-name:var(--font-body)]">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {currentMood && (
          <Badge
            label={`Energía ${moodOptions.find((m) => m.level === currentMood)?.label?.toLowerCase() ?? ""}`}
            className={moodOptions.find((m) => m.level === currentMood)?.color ?? ""}
          />
        )}

        <div className="text-center">
          <p className="text-blanco font-[family-name:var(--font-heading)] text-lg italic">
            Tu día espera
          </p>
          {hasTasks ? (
            <p className="text-gris text-sm mt-1">
              {taskCount} {taskCount === 1 ? "tarea pendiente" : "tareas pendientes"} para planificar.
            </p>
          ) : (
            <p className="text-gris text-sm mt-1">
              Captura tus primeras tareas con el botón <span className="text-azul">+</span> de abajo.
            </p>
          )}
        </div>

        {hasTasks && (
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
        )}

        {/* Show captured tasks even before plan exists */}
        {capturedToday.length > 0 && (
          <div className="w-full mt-(--space-4)">
            <span className="text-xs text-gris tracking-[0.15em] uppercase mb-(--space-3) block font-[family-name:var(--font-body)] font-medium">
              Capturadas hoy ({capturedToday.length})
            </span>
            <div className="flex flex-col gap-(--space-2)">
              {capturedToday
                .slice()
                .sort((a, b) => {
                  if (a.scheduled_at && b.scheduled_at) {
                    return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
                  }
                  if (a.scheduled_at) return -1;
                  if (b.scheduled_at) return 1;
                  return 0;
                })
                .map((task) => (
                  <CapturedTaskCard
                    key={task.id}
                    task={task}
                    projectName={task.project_id ? projects[task.project_id] : undefined}
                  />
                ))}
            </div>
          </div>
        )}
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
  const { score: enfoqueScore, alignment, energyMatch, priorityIntegrity } = calculateEnfoque(enrichedBlocks, peakWindow);

  // Current energy based on time of day
  const currentEnergy = getCurrentEnergy(peakWindow);

  // Separate task blocks from breaks
  const taskBlocks = enrichedBlocks.filter((b) => b.slot_type !== "break" && b.task);
  // Filter using BOTH optimistic local state AND server status — local state wins
  // for instant feedback before router.refresh() updates the server data
  const activeBlocks = taskBlocks.filter((b) => {
    const status = taskStatuses[b.task_id] ?? b.task?.status;
    return status !== "deferred" && status !== "completed";
  });
  const completedCount = Object.values(taskStatuses).filter((s) => s === "completed").length;

  // TOP 3 by plan_rank (fallback to first 3)
  const top3Ranked = activeBlocks
    .filter((b) => b.plan_rank && b.plan_rank >= 1 && b.plan_rank <= 3)
    .sort((a, b) => (a.plan_rank ?? 0) - (b.plan_rank ?? 0));
  const top3 = top3Ranked.length > 0 ? top3Ranked : activeBlocks.slice(0, 3);
  const top3Ids = new Set(top3.map((b) => b.task_id));
  const overflow = activeBlocks.filter((b) => !top3Ids.has(b.task_id));

  return (
    <div className="flex flex-col items-center gap-(--space-6)">
      <span className="text-xs text-gris tracking-[0.2em] uppercase pt-(--space-2) font-[family-name:var(--font-body)] font-medium">
        Hoy
      </span>

      {/* Energy prompt (with plan) */}
      {!currentMood && (
        <div className="w-full bg-bg-card/50 rounded-(--radius-lg) p-(--space-4) flex flex-col items-center gap-(--space-3) border border-blanco/[0.04]">
          <p className="text-gris text-xs font-[family-name:var(--font-body)]">
            ¿Cómo te sientes hoy?
          </p>
          <div className="flex gap-(--space-3)">
            {moodOptions.map((opt) => (
              <button
                key={opt.level}
                onClick={() => handleMoodSelect(opt.level)}
                disabled={savingMood}
                className={`flex items-center gap-1.5 px-(--space-3) py-(--space-2) rounded-full text-xs font-medium transition-all active:scale-95 bg-bg-card text-gris border border-blanco/[0.06]`}
              >
                <span>{opt.icon}</span>
                <span className="font-[family-name:var(--font-body)]">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Enfoque ring */}
      <ProgressArc
        score={enfoqueScore}
        breakdown={{ alignment, energyMatch, priorityIntegrity }}
      />

      {/* Energy badge — user's selected mood takes precedence over time-based */}
      {currentMood ? (
        <Badge
          label={`Energía ${moodOptions.find((m) => m.level === currentMood)?.label?.toLowerCase() ?? ""}`}
          className={moodOptions.find((m) => m.level === currentMood)?.color ?? ""}
        />
      ) : (
        <Badge
          label={`${currentEnergyLabels[currentEnergy]}`}
          className={currentEnergyColors[currentEnergy]}
        />
      )}

      {/* Calendar events */}
      {calendarEvents.length > 0 && (
        <div className="w-full">
          <div className="flex items-center gap-(--space-2) mb-(--space-3)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-gris/60">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span className="text-xs text-gris tracking-[0.15em] uppercase font-[family-name:var(--font-body)] font-medium">
              En tu calendario
            </span>
          </div>
          <div className="flex flex-col gap-(--space-2)">
            {calendarEvents.map((event) => (
              <div
                key={event.id}
                className="bg-bg-card/60 rounded-(--radius-md) p-(--space-3) flex items-center gap-(--space-3) border border-blanco/[0.04]"
              >
                <div className="w-1 h-8 rounded-full bg-azul/40 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-blanco/90 truncate font-[family-name:var(--font-body)]">
                    {event.summary}
                  </p>
                  <span className="text-xs text-gris/60 font-[family-name:var(--font-body)]">
                    {event.is_all_day
                      ? "Todo el día"
                      : `${event.start_time} – ${event.end_time}`}
                  </span>
                </div>
                <span className="text-xs text-gris/40 font-[family-name:var(--font-body)] flex-shrink-0">
                  Google
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty plan — all tasks done or deferred */}
      {activeBlocks.length === 0 && (
        <div className="w-full flex flex-col items-center gap-(--space-4) py-(--space-4)">
          {completedCount > 0 && (
            <p className="text-gris text-sm font-[family-name:var(--font-body)] text-center">
              {completedCount === taskBlocks.length
                ? "Completaste todas las tareas del día"
                : `${completedCount} completada${completedCount !== 1 ? "s" : ""}, el resto diferidas`}
            </p>
          )}
          {taskCount > 0 && (
            <Button onClick={handleGeneratePlan} disabled={generating}>
              {generating ? (
                <span className="flex items-center gap-(--space-2)">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Regenerando plan...
                </span>
              ) : (
                "Regenerar plan"
              )}
            </Button>
          )}
          {taskCount === 0 && completedCount === 0 && (
            <p className="text-gris text-sm font-[family-name:var(--font-body)] text-center">
              Captura tareas con el botón <span className="text-azul">+</span> para regenerar tu plan.
            </p>
          )}
        </div>
      )}

      {/* TOP 3 section */}
      {activeBlocks.length > 0 && (
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

        {/* Overflow tasks */}
        {overflow.length > 0 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full bg-bg-card/50 rounded-(--radius-lg) py-(--space-3) text-center border border-blanco/[0.04] transition-all active:scale-[0.99] mt-(--space-3)"
          >
            <span className="text-sm text-azul font-medium">
              {showAll ? "Ocultar" : `${overflow.length} tareas más`}
            </span>
          </button>
        )}

        {showAll && (
          <div className="flex flex-col gap-(--space-3) stagger-children mt-(--space-3)">
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
      </div>
      )}

      {/* Tareas capturadas hoy (no en el plan) */}
      {capturedToday.length > 0 && (
        <div className="w-full">
          <div className="flex items-center gap-(--space-2) mb-(--space-3)">
            <span className="text-xs text-gris tracking-[0.15em] uppercase font-[family-name:var(--font-body)] font-medium">
              Capturadas hoy ({capturedToday.length})
            </span>
          </div>
          <div className="flex flex-col gap-(--space-2)">
            {capturedToday
              .slice()
              .sort((a, b) => {
                if (a.scheduled_at && b.scheduled_at) {
                  return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
                }
                if (a.scheduled_at) return -1;
                if (b.scheduled_at) return 1;
                return 0;
              })
              .map((task) => (
                <CapturedTaskCard
                  key={task.id}
                  task={task}
                  projectName={task.project_id ? projects[task.project_id] : undefined}
                />
              ))}
          </div>
          <p className="text-sm text-gris/60 text-center mt-(--space-3) font-[family-name:var(--font-body)]">
            Estas tareas no están en el plan aún
          </p>
          <button
            onClick={handleGeneratePlan}
            disabled={generating}
            className="w-full mt-(--space-2) min-h-[44px] rounded-(--radius-md) bg-azul/10 text-azul text-sm font-semibold transition-all active:bg-azul/20 border border-azul/15"
          >
            {generating ? (
              <span className="flex items-center justify-center gap-(--space-2)">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Regenerando plan...
              </span>
            ) : (
              "Incluir en el plan"
            )}
          </button>
        </div>
      )}

      {/* End-of-day reflection */}
      {completedCount > 0 && (
        <button
          onClick={() => setReflectionOpen(true)}
          className="w-full bg-bg-card rounded-(--radius-lg) py-(--space-4) text-center border border-terracotta/15 transition-all active:scale-[0.99] mt-(--space-2)"
        >
          <span className="text-sm text-terracotta font-[family-name:var(--font-body)] font-medium">
            Cerrar el día
          </span>
        </button>
      )}

      <ReflectionModal
        open={reflectionOpen}
        onClose={() => setReflectionOpen(false)}
        planDate={planDate}
      />

      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}

const energyDotColorsCard: Record<string, string> = {
  low: "bg-[var(--energy-low)]",
  medium: "bg-amarillo",
  high: "bg-rojo",
};

function getCapturedTimeStatus(scheduledAt: string): { label: string; color: string; isNow: boolean } {
  const now = new Date();
  const scheduled = new Date(scheduledAt);
  const diffMin = Math.round((scheduled.getTime() - now.getTime()) / 60000);

  if (diffMin <= -5) {
    return { label: "Atrasada", color: "text-amarillo", isNow: false };
  }
  if (diffMin >= -5 && diffMin <= 30) {
    return { label: "Ahora", color: "text-verde", isNow: true };
  }
  if (diffMin < 60) {
    return { label: `En ${diffMin} min`, color: "text-gris/60", isNow: false };
  }
  const hours = Math.floor(diffMin / 60);
  return { label: `En ${hours}h`, color: "text-gris/60", isNow: false };
}

function CapturedTaskCard({
  task,
  projectName,
}: {
  task: {
    id: string;
    title: string;
    energy_level: "low" | "medium" | "high";
    estimated_minutes: number | null;
    scheduled_at: string | null;
    category: string;
  };
  projectName?: string;
}) {
  const timeStatus = task.scheduled_at ? getCapturedTimeStatus(task.scheduled_at) : null;
  const scheduledLabel = task.scheduled_at
    ? new Date(task.scheduled_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false })
    : null;

  return (
    <div className={`rounded-(--radius-md) p-(--space-3) flex items-center gap-(--space-3) border ${
      timeStatus?.isNow
        ? "bg-bg-card border-verde/40 shadow-[0_0_16px_rgba(52,211,153,0.15)]"
        : "bg-bg-card/60 border-blanco/[0.04]"
    }`}>
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${energyDotColorsCard[task.energy_level] ?? "bg-gris/40"}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-blanco truncate font-[family-name:var(--font-body)]">{task.title}</p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {scheduledLabel && (
            <span className="text-xs text-gris">{scheduledLabel}</span>
          )}
          {timeStatus && (
            <span className={`text-xs font-medium ${timeStatus.color}`}>
              {scheduledLabel ? "·" : ""} {timeStatus.label}
            </span>
          )}
          {projectName && (
            <>
              <span className="text-gris/30">·</span>
              <span className="text-xs text-azul/70">{projectName}</span>
            </>
          )}
          {task.estimated_minutes && (
            <>
              <span className="text-gris/30">·</span>
              <span className="text-xs text-gris/60">{task.estimated_minutes}m</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
