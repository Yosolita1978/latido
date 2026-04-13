"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface DeferredTaskCardProps {
  taskId: string;
  title: string;
  projectName?: string;
  category: string;
  energyLevel: string;
  estimatedMinutes: number | null;
  deferredCount: number;
  timezone: string;
}

const energyDotColors: Record<string, string> = {
  low: "bg-[var(--energy-low)]",
  medium: "bg-amarillo",
  high: "bg-rojo",
};

const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function getRecentDays(timezone: string): { label: string; date: Date }[] {
  const nowStr = new Date().toLocaleDateString("en-CA", { timeZone: timezone });
  const today = new Date(nowStr + "T12:00:00");
  const days: { label: string; date: Date }[] = [];

  for (let i = 0; i <= 6; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    let label: string;
    if (i === 0) label = "Hoy";
    else if (i === 1) label = "Ayer";
    else label = dayNames[d.getDay()];
    days.push({ label, date: d });
  }

  return days;
}

export function DeferredTaskCard({
  taskId,
  title,
  projectName,
  category,
  energyLevel,
  estimatedMinutes,
  deferredCount,
  timezone,
}: DeferredTaskCardProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [animating, setAnimating] = useState<"complete" | "remove" | null>(null);
  const [hidden, setHidden] = useState(false);

  async function handleComplete(completedDate: Date) {
    setAnimating("complete");
    try {
      const response = await fetch("/api/tasks/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: taskId,
          status: "completed",
          actual_minutes: estimatedMinutes ?? 30,
          completed_at: completedDate.toISOString(),
        }),
      });
      if (!response.ok) throw new Error(`Error ${response.status}`);
      setTimeout(() => {
        setHidden(true);
        router.refresh();
      }, 300);
    } catch {
      setAnimating(null);
    }
  }

  async function handleRemove() {
    setAnimating("remove");
    try {
      const response = await fetch("/api/tasks/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: taskId,
          status: "inbox",
        }),
      });
      if (!response.ok) throw new Error(`Error ${response.status}`);
      setTimeout(() => {
        setHidden(true);
        router.refresh();
      }, 300);
    } catch {
      setAnimating(null);
    }
  }

  if (hidden) return null;

  const recentDays = getRecentDays(timezone);

  return (
    <div
      className={`
        bg-bg-card rounded-(--radius-md) overflow-hidden border border-amarillo/[0.06] transition-all duration-300
        ${animating === "complete" ? "opacity-30 scale-95" : ""}
        ${animating === "remove" ? "opacity-0 scale-95" : ""}
      `}
    >
      {/* Main card — tap to expand */}
      <button
        onClick={() => { setExpanded(!expanded); setShowDayPicker(false); }}
        className="w-full text-left p-(--space-3) flex items-center gap-(--space-3)"
      >
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${energyDotColors[energyLevel] ?? "bg-amarillo"}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-blanco truncate">{title}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-gris">
              {projectName ?? category}
            </span>
            {estimatedMinutes && (
              <>
                <span className="text-gris/30">·</span>
                <span className="text-xs text-gris/60">{estimatedMinutes}m</span>
              </>
            )}
            {deferredCount > 1 && (
              <>
                <span className="text-gris/30">·</span>
                <span className="text-xs text-amarillo/60">{deferredCount}x diferida</span>
              </>
            )}
          </div>
        </div>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          className={`text-gris/30 transition-transform duration-200 flex-shrink-0 ${expanded ? "rotate-180" : ""}`}
        >
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {/* Expanded actions */}
      {expanded && (
        <div className="px-(--space-3) pb-(--space-3) animate-fade-in">
          {showDayPicker ? (
            <div className="flex flex-col gap-(--space-2)">
              <span className="text-xs text-gris font-[family-name:var(--font-body)]">¿Cuándo la hiciste?</span>
              <div className="flex flex-wrap gap-(--space-2)">
                {recentDays.map(({ label, date }) => (
                  <button
                    key={label}
                    onClick={() => handleComplete(date)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium bg-bg-card-elevated text-gris border border-blanco/[0.06] transition-all active:bg-verde/15 active:text-verde active:border-verde/20"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-(--space-2)">
              <button
                onClick={() => setShowDayPicker(true)}
                className="flex-1 min-h-[44px] rounded-(--radius-md) bg-verde/10 text-verde text-sm font-semibold transition-all active:bg-verde/20 border border-verde/10"
              >
                Hecho
              </button>
              <button
                onClick={handleRemove}
                className="min-h-[44px] w-11 rounded-(--radius-md) bg-blanco/[0.03] text-gris flex items-center justify-center transition-all active:bg-blanco/[0.06] border border-blanco/[0.04]"
                aria-label="Mover a bandeja"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
